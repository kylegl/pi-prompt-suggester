import type { PromptSuggesterConfig } from "../../config/types.js";
import type { SeedArtifact } from "../../domain/seed.js";
import type { SuggestionMetadata, SuggestionResult, SuggestionUsage, TurnContext } from "../../domain/suggestion.js";
import type { ModelInvocationSettings } from "../ports/model-client.js";
import type { SteeringSlice } from "../../domain/steering.js";
import type { ModelClient } from "../ports/model-client.js";
import type { PromptContextBuilder } from "./prompt-context-builder.js";
import type { TranscriptPromptContextBuilder } from "./transcript-prompt-context-builder.js";
import { accumulateUsage } from "../../domain/usage.js";

function normalizeSuggestion(value: string, maxChars: number): string {
	const normalizedLineEndings = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
	const trimmedTrailing = normalizedLineEndings
		.split("\n")
		.map((line) => line.trimEnd())
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
	return trimmedTrailing.length > maxChars ? trimmedTrailing.slice(0, maxChars).trimEnd() : trimmedTrailing;
}

function stableSamplePercent(seed: string): number {
	let hash = 0;
	for (let i = 0; i < seed.length; i += 1) {
		hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
	}
	return hash % 100;
}

const DISALLOWED_META_PATTERNS = [
	/\/(?:reload|suggester\b|suggesterSettings\b)/i,
	/\.pi\//i,
	/events?\.ndjson/i,
	/\bfallbackReason\b/i,
	/\bsession id\b/i,
	/\brequestedStrategy\b/i,
	/\btrace only\b/i,
	/\b(?:trace|instrument|instrumentation|debug|debugging)\b/i,
	/\b(?:showSuggestion|clearSuggestion|GhostSuggestionEditor|PiSuggestionSink|getGhostState)\b/i,
	/\b(?:provider\.payload|panel lines rendered|runtime state|UI wiring|agent_end)\b/i,
	/\b(?:inspect|check|capture|validate)\b.{0,40}\b(?:logs?|events?|payload|session id|fallbackReason|runtime|render(?:ing)?|wiring)\b/i,
];

function isDisallowedMetaSuggestion(value: string): boolean {
	const normalized = value.trim();
	if (!normalized) return false;
	return DISALLOWED_META_PATTERNS.some((pattern) => pattern.test(normalized));
}

function accumulateOptionalUsage(
	current: SuggestionUsage | undefined,
	usage: SuggestionUsage | undefined,
): SuggestionUsage | undefined {
	if (!current) return usage;
	return accumulateUsage(current, usage);
}

interface GeneratedSuggestion {
	text: string;
	usage?: SuggestionUsage;
	metadata: SuggestionMetadata;
}

export interface SuggestionEngineDeps {
	config: PromptSuggesterConfig;
	modelClient: ModelClient;
	promptContextBuilder: PromptContextBuilder;
	transcriptPromptContextBuilder?: TranscriptPromptContextBuilder;
}

export class SuggestionEngine {
	public constructor(private readonly deps: SuggestionEngineDeps) {}

	public async suggest(
		turn: TurnContext,
		seed: SeedArtifact | null,
		steering: SteeringSlice,
		settings?: ModelInvocationSettings,
		overrideConfig?: PromptSuggesterConfig,
	): Promise<SuggestionResult> {
		const config = overrideConfig ?? this.deps.config;
		if (config.suggestion.fastPathContinueOnError && turn.status !== "success") {
			return {
				kind: "suggestion",
				text: "continue",
				metadata: {
					requestedStrategy: config.suggestion.strategy,
					strategy: "compact",
					fallbackReason: "fast_path_continue",
				},
			};
		}

		const raw = await this.generateWithBestAvailableStrategy(turn, seed, steering, settings, config);
		const normalized = normalizeSuggestion(raw.text, config.suggestion.maxSuggestionChars);
		if (!normalized || normalized === config.suggestion.noSuggestionToken) {
			return this.toNoSuggestion(config, raw.usage, raw.metadata);
		}

		if (isDisallowedMetaSuggestion(normalized)) {
			if (raw.metadata.strategy === "transcript-steering") {
				const fallback = await this.generateCompactSuggestion(turn, seed, steering, settings, config, {
					requestedStrategy: raw.metadata.requestedStrategy,
					fallbackReason: "transcript_disallowed_meta_output",
					contextUsagePercent: raw.metadata.contextUsagePercent,
					transcriptMessageCount: raw.metadata.transcriptMessageCount,
					transcriptCharCount: raw.metadata.transcriptCharCount,
				});
				const fallbackNormalized = normalizeSuggestion(fallback.text, config.suggestion.maxSuggestionChars);
				if (
					fallbackNormalized &&
					fallbackNormalized !== config.suggestion.noSuggestionToken &&
					!isDisallowedMetaSuggestion(fallbackNormalized)
				) {
					return {
						kind: "suggestion",
						text: fallbackNormalized,
						usage: accumulateOptionalUsage(raw.usage, fallback.usage),
						metadata: fallback.metadata,
					};
				}
				return this.toNoSuggestion(config, accumulateOptionalUsage(raw.usage, fallback.usage), fallback.metadata);
			}

			return this.toNoSuggestion(config, raw.usage, {
				...raw.metadata,
				fallbackReason: raw.metadata.fallbackReason ?? "disallowed_meta_output",
			});
		}

		return {
			kind: "suggestion",
			text: normalized,
			usage: raw.usage,
			metadata: raw.metadata,
		};
	}

	private toNoSuggestion(
		config: PromptSuggesterConfig,
		usage: SuggestionUsage | undefined,
		metadata: SuggestionMetadata,
	): SuggestionResult {
		return {
			kind: "no_suggestion",
			text: config.suggestion.noSuggestionToken,
			usage,
			metadata,
		};
	}

	private async generateWithBestAvailableStrategy(
		turn: TurnContext,
		seed: SeedArtifact | null,
		steering: SteeringSlice,
		settings: ModelInvocationSettings | undefined,
		config: PromptSuggesterConfig,
	): Promise<GeneratedSuggestion> {
		const requestedStrategy = config.suggestion.strategy;
		if (requestedStrategy === "transcript-steering" && this.deps.transcriptPromptContextBuilder) {
			const sampledOut =
				config.suggestion.transcriptRolloutPercent < 100 &&
				stableSamplePercent(turn.turnId || turn.sourceLeafId) >= config.suggestion.transcriptRolloutPercent;
			if (sampledOut) {
				return await this.generateCompactSuggestion(turn, seed, steering, settings, config, {
					requestedStrategy,
					sampledOut: true,
					fallbackReason: "transcript_rollout_skip",
				});
			}

			try {
				const transcriptContext = this.deps.transcriptPromptContextBuilder.build(seed, steering, config);
				const overContextLimit =
					typeof transcriptContext.contextUsagePercent === "number" &&
					transcriptContext.contextUsagePercent > config.suggestion.transcriptMaxContextPercent;
				if (overContextLimit) {
					return await this.generateCompactSuggestion(turn, seed, steering, settings, config, {
						requestedStrategy,
						fallbackReason: "transcript_context_limit",
						contextUsagePercent: transcriptContext.contextUsagePercent,
						transcriptMessageCount: transcriptContext.transcriptMessageCount,
						transcriptCharCount: transcriptContext.transcriptCharCount,
					});
				}
				const result = await this.deps.modelClient.generateSuggestion(transcriptContext, settings);
				return {
					text: result.text,
					usage: result.usage,
					metadata: {
						requestedStrategy,
						strategy: "transcript-steering",
						contextUsagePercent: transcriptContext.contextUsagePercent,
						transcriptMessageCount: transcriptContext.transcriptMessageCount,
						transcriptCharCount: transcriptContext.transcriptCharCount,
					},
				};
			} catch (error) {
				return await this.generateCompactSuggestion(turn, seed, steering, settings, config, {
					requestedStrategy,
					fallbackReason: `transcript_error:${(error as Error).message}`,
				});
			}
		}

		return await this.generateCompactSuggestion(turn, seed, steering, settings, config, {
			requestedStrategy,
		});
	}

	private async generateCompactSuggestion(
		turn: TurnContext,
		seed: SeedArtifact | null,
		steering: SteeringSlice,
		settings: ModelInvocationSettings | undefined,
		config: PromptSuggesterConfig,
		metadata: Omit<SuggestionMetadata, "strategy">,
	): Promise<GeneratedSuggestion> {
		const context = this.deps.promptContextBuilder.build(turn, seed, steering, config);
		const result = await this.deps.modelClient.generateSuggestion(context, settings);
		return {
			text: result.text,
			usage: result.usage,
			metadata: {
				...metadata,
				strategy: "compact",
			},
		};
	}
}

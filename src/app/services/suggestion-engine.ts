import type { AutoprompterConfig } from "../../config/types.js";
import type { SeedArtifact } from "../../domain/seed.js";
import type { SuggestionResult, TurnContext } from "../../domain/suggestion.js";
import type { SteeringSlice } from "../../domain/steering.js";
import type { ModelClient } from "../ports/model-client.js";
import type { PromptContextBuilder } from "./prompt-context-builder.js";

function normalizeSuggestion(value: string, maxChars: number): string {
	const flattened = value.replace(/\s+/g, " ").trim();
	return flattened.length > maxChars ? flattened.slice(0, maxChars).trim() : flattened;
}

export interface SuggestionEngineDeps {
	config: AutoprompterConfig;
	modelClient: ModelClient;
	promptContextBuilder: PromptContextBuilder;
}

export class SuggestionEngine {
	public constructor(private readonly deps: SuggestionEngineDeps) {}

	public async suggest(
		turn: TurnContext,
		seed: SeedArtifact | null,
		steering: SteeringSlice,
	): Promise<SuggestionResult> {
		if (this.deps.config.suggestion.fastPathContinueOnError && (turn.status === "error" || turn.status === "aborted")) {
			return {
				kind: "suggestion",
				text: "continue",
			};
		}

		const context = this.deps.promptContextBuilder.build(turn, seed, steering);
		const raw = await this.deps.modelClient.generateSuggestion(context);
		const normalized = normalizeSuggestion(raw, this.deps.config.suggestion.maxSuggestionChars);
		if (!normalized || normalized === this.deps.config.suggestion.noSuggestionToken) {
			return {
				kind: "no_suggestion",
				text: this.deps.config.suggestion.noSuggestionToken,
			};
		}

		return {
			kind: "suggestion",
			text: normalized,
		};
	}
}

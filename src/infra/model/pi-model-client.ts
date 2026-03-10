import { complete, type UserMessage } from "@mariozechner/pi-ai";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { ModelClient } from "../../app/ports/model-client.js";
import type { SuggestionPromptContext } from "../../app/services/prompt-context-builder.js";
import type { SeedArtifact, SeedDraft } from "../../domain/seed.js";
import { renderSeederPrompt } from "../../prompts/seeder-template.js";
import { renderSuggestionPrompt } from "../../prompts/suggestion-template.js";

export interface RuntimeContextProvider {
	getContext(): ExtensionContext | undefined;
}

function extractText(content: unknown): string {
	if (!Array.isArray(content)) return "";
	return content
		.map((block) => {
			if (block && typeof block === "object" && "type" in block && (block as { type?: string }).type === "text") {
				return String((block as { text?: unknown }).text ?? "");
			}
			return "";
		})
		.join("\n")
		.trim();
}

function parseJsonObject(text: string): Record<string, unknown> {
	const trimmed = text.trim();
	try {
		return JSON.parse(trimmed) as Record<string, unknown>;
	} catch {
		const match = trimmed.match(/\{[\s\S]*\}/);
		if (!match) throw new Error("Model did not return JSON");
		return JSON.parse(match[0]) as Record<string, unknown>;
	}
}

function coerceStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.map((entry) => String(entry)).map((entry) => entry.trim()).filter(Boolean);
}

function coerceSeedDraft(payload: Record<string, unknown>): SeedDraft {
	const keyFiles = Array.isArray(payload.keyFiles)
		? payload.keyFiles
				.map((entry) => {
					if (!entry || typeof entry !== "object") return null;
					const path = String((entry as { path?: unknown }).path ?? "").trim();
					const whyImportant = String((entry as { whyImportant?: unknown }).whyImportant ?? "").trim();
					if (!path) return null;
					return { path, whyImportant: whyImportant || "High-signal file" };
				})
				.filter((entry): entry is { path: string; whyImportant: string } => entry !== null)
		: [];

	return {
		projectIntentSummary: String(payload.projectIntentSummary ?? "").trim(),
		topObjectives: coerceStringArray(payload.topObjectives),
		constraints: coerceStringArray(payload.constraints),
		keyFiles,
		openQuestions: coerceStringArray(payload.openQuestions),
		reseedNotes: String(payload.reseedNotes ?? "").trim() || undefined,
	};
}

export class PiModelClient implements ModelClient {
	public constructor(private readonly runtime: RuntimeContextProvider) {}

	public async generateSeed(input: {
		reseedTrigger: import("../../domain/seed.js").ReseedTrigger;
		repositoryContext: string;
		previousSeed: SeedArtifact | null;
	}): Promise<SeedDraft> {
		const responseText = await this.completePrompt(renderSeederPrompt(input));
		const parsed = coerceSeedDraft(parseJsonObject(responseText));
		if (!parsed.projectIntentSummary) {
			throw new Error("Seeder model returned an empty projectIntentSummary");
		}
		return parsed;
	}

	public async generateSuggestion(context: SuggestionPromptContext): Promise<string> {
		return await this.completePrompt(renderSuggestionPrompt(context));
	}

	private async completePrompt(prompt: string): Promise<string> {
		const ctx = this.runtime.getContext();
		if (!ctx?.model) {
			throw new Error("No active model available for autoprompter");
		}

		const apiKey = await ctx.modelRegistry.getApiKey(ctx.model);
		const userMessage: UserMessage = {
			role: "user",
			content: [{ type: "text", text: prompt }],
			timestamp: Date.now(),
		};

		const response = await complete(
			ctx.model,
			{
				systemPrompt:
					"You are the internal model used by pi-autoprompter. Follow the user prompt exactly and return only the requested format.",
				messages: [userMessage],
			},
			{ apiKey },
		);
		const text = extractText(response.content);
		if (!text) throw new Error("Model returned empty text");
		return text;
	}
}

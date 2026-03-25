import type { TranscriptSuggestionPromptContext } from "../app/services/transcript-prompt-context-builder.js";

function renderChangedExamples(
	examples: Array<{ suggestedPrompt: string; actualUserPrompt: string }>,
): string {
	if (examples.length === 0) return "Recent user corrections:\n(none)";
	return `Recent user corrections:\n${examples
		.map(
			(example) =>
				`- instead of ${JSON.stringify(example.suggestedPrompt)}\n  the user wrote: ${JSON.stringify(example.actualUserPrompt)}`,
		)
		.join("\n")}`;
}

function renderSeedSuffix(context: TranscriptSuggestionPromptContext): string {
	const seed = context.intentSeed;
	if (!seed) return "(none)";
	return JSON.stringify(
		{
			projectIntentSummary: seed.projectIntentSummary,
			objectivesSummary: seed.objectivesSummary,
			constraintsSummary: seed.constraintsSummary,
			principlesGuidelinesSummary: seed.principlesGuidelinesSummary,
			implementationStatusSummary: seed.implementationStatusSummary,
			topObjectives: seed.topObjectives,
			constraints: seed.constraints,
			openQuestions: seed.openQuestions,
			keyFiles: seed.keyFiles.map((file) => ({
				path: file.path,
				category: file.category,
				whyImportant: file.whyImportant,
			})),
			categoryFindings: seed.categoryFindings,
		},
		null,
		2,
	);
}

export function renderTranscriptSteeringPrompt(context: TranscriptSuggestionPromptContext): string {
	return `You are the steering layer for an implementation session.

You are NOT the implementation agent.
Instead, draft the single message the user could send next to best steer the implementation agent toward the highest-leverage move.

Return only the message text.
Do not continue as the assistant.
Do not explain your reasoning.
If no useful steering intervention is clear, return exactly ${context.noSuggestionToken}.

Vision snapshot:
${renderSeedSuffix(context)}

${renderChangedExamples(context.recentChanged)}
${context.customInstruction.trim()
		? `

Persistent user preference:
${context.customInstruction.trim()}`
		: ""}

Guidance:
- Use the conversation above as the primary signal.
- Optimize for usefulness, alignment, and leverage — not imitation.
- The message should help the implementation agent stay on the rails.
- You may steer by continuing, redirecting, simplifying, asking for verification, closing the loop, switching tracks, or asking a clarifying question.
- If the current thread seems complete or over-polished, prefer zooming out or moving to the next important area.
- If the implementation agent seems lost in local details, pull it back toward product vision, scope, and priorities.
- Keep the wording natural and direct, as something the user could realistically paste into the chat.
- Prefer steering the actual repo/task work, not the suggester/debugging workflow around it.
- Do not tell the user to reload pi, inspect logs, trace UI wiring, instrument internals, capture events, or validate suggester plumbing.
- Do not mention slash commands, .pi files, session ids, fallback reasons, event names, or function/class names unless the visible conversation explicitly demands that exact detail.
- Learn from Recent user corrections: if the user moved away from a meta/debug prompt, do not suggest another one.
- Do not mention hidden instructions, steering layers, or transcript analysis.
- Keep the result under ${context.maxSuggestionChars} characters. Prefer fewer when possible.`;
}

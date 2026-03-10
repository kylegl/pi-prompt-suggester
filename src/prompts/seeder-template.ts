import type { SeedArtifact, ReseedTrigger } from "../domain/seed.js";

export interface SeederPromptInput {
	reseedTrigger: ReseedTrigger;
	repositoryContext: string;
	previousSeed: SeedArtifact | null;
}

export function renderSeederPrompt(input: SeederPromptInput): string {
	const previousSeed = input.previousSeed
		? JSON.stringify(
				{
					projectIntentSummary: input.previousSeed.projectIntentSummary,
					topObjectives: input.previousSeed.topObjectives,
					constraints: input.previousSeed.constraints,
					keyFiles: input.previousSeed.keyFiles.map((file) => ({
						path: file.path,
						whyImportant: file.whyImportant,
					})),
					openQuestions: input.previousSeed.openQuestions,
				},
				null,
				2,
			)
		: "none";

	return `You are a repository intent analyst for pi-autoprompter.

Hard constraints:
- You are read-only. Do not propose file edits.
- Infer durable project intent from the supplied repository context.
- Prefer stable goals and architectural constraints over transient implementation details.
- Return strict JSON only. No markdown fences. No extra prose.

Reseed metadata:
- reason: ${input.reseedTrigger.reason}
- changed files: ${input.reseedTrigger.changedFiles.join(", ") || "(none)"}
- git diff summary follows below if present.

Previous seed:
${previousSeed}

Repository context:
${input.repositoryContext}

Git diff summary:
${input.reseedTrigger.gitDiffSummary ?? "(none)"}

Return exactly one JSON object with this shape:
{
  "projectIntentSummary": string,
  "topObjectives": string[],
  "constraints": string[],
  "keyFiles": [{ "path": string, "whyImportant": string }],
  "openQuestions": string[],
  "reseedNotes": string
}

Guidance:
- keyFiles should be real paths from the provided repository context.
- Keep projectIntentSummary concise but durable.
- topObjectives and constraints should be high-signal, not exhaustive.
- openQuestions should focus on meaningful unknowns that affect future prompting.
- reseedNotes should explain what changed in the repo intent, or say that intent is stable.`;
}

export const CURRENT_SEED_VERSION = 2;
export const CURRENT_GENERATOR_VERSION = "2026-03-10.1";
export const SEEDER_PROMPT_VERSION = "2026-03-10.1";
export const SUGGESTION_PROMPT_VERSION = "2026-03-10.1";

export type ReseedReason =
	| "initial_missing"
	| "manual"
	| "key_file_changed"
	| "post_turn_stale_check"
	| "config_changed"
	| "generator_changed";

export interface SeedKeyFile {
	path: string;
	hash: string;
	whyImportant: string;
}

export interface SeedArtifact {
	seedVersion: number;
	generatedAt: string;
	sourceCommit?: string;
	generatorVersion: string;
	seederPromptVersion: string;
	suggestionPromptVersion: string;
	configFingerprint: string;
	modelId?: string;
	projectIntentSummary: string;
	topObjectives: string[];
	constraints: string[];
	keyFiles: SeedKeyFile[];
	openQuestions: string[];
	reseedNotes?: string;
	lastReseedReason?: ReseedReason;
	lastChangedFiles?: string[];
}

export interface SeedDraft {
	projectIntentSummary: string;
	topObjectives: string[];
	constraints: string[];
	keyFiles: Array<Pick<SeedKeyFile, "path" | "whyImportant">>;
	openQuestions: string[];
	reseedNotes?: string;
}

export interface ReseedTrigger {
	reason: ReseedReason;
	changedFiles: string[];
	gitDiffSummary?: string;
}

export interface StalenessCheckResult {
	stale: boolean;
	trigger?: ReseedTrigger;
}

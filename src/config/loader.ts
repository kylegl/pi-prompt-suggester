import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AutoprompterConfig } from "./types.js";
import { DEFAULT_CONFIG, validateConfig } from "./schema.js";

export interface ConfigLoader {
	load(): Promise<AutoprompterConfig>;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge<T>(base: T, override: unknown): T {
	if (!isObject(base) || !isObject(override)) {
		return (override as T) ?? base;
	}

	const result: Record<string, unknown> = { ...base };
	for (const [key, value] of Object.entries(override)) {
		const existing = result[key];
		if (isObject(existing) && isObject(value)) {
			result[key] = deepMerge(existing, value);
		} else if (value !== undefined) {
			result[key] = value;
		}
	}
	return result as T;
}

async function readJsonIfExists(filePath: string): Promise<unknown | undefined> {
	try {
		const raw = await fs.readFile(filePath, "utf8");
		return JSON.parse(raw);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
		throw new Error(`Failed to load config ${filePath}: ${(error as Error).message}`);
	}
}

function parseBoolean(value: string | undefined): boolean | undefined {
	if (value === undefined) return undefined;
	if (["1", "true", "yes", "on"].includes(value.toLowerCase())) return true;
	if (["0", "false", "no", "off"].includes(value.toLowerCase())) return false;
	return undefined;
}

function parseInteger(value: string | undefined): number | undefined {
	if (value === undefined) return undefined;
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function envOverrides(): Partial<AutoprompterConfig> {
	const enabled = parseBoolean(process.env.PI_AUTOPROMPTER_RESEED_ENABLED);
	const checkOnStart = parseBoolean(process.env.PI_AUTOPROMPTER_CHECK_ON_SESSION_START);
	const checkAfterTurn = parseBoolean(process.env.PI_AUTOPROMPTER_CHECK_AFTER_EVERY_TURN);
	const maxFiles = parseInteger(process.env.PI_AUTOPROMPTER_SEED_MAX_FILES);
	const maxContext = parseInteger(process.env.PI_AUTOPROMPTER_SEED_MAX_REPOSITORY_CONTEXT_CHARS);
	const maxAssistantTurnChars = parseInteger(process.env.PI_AUTOPROMPTER_SUGGESTION_MAX_ASSISTANT_TURN_CHARS);
	const loggingLevel = process.env.PI_AUTOPROMPTER_LOG_LEVEL;
	const noSuggestionToken = process.env.PI_AUTOPROMPTER_NO_SUGGESTION_TOKEN;

	return {
		seed: {
			...DEFAULT_CONFIG.seed,
			...(maxFiles !== undefined ? { maxFiles } : {}),
			...(maxContext !== undefined ? { maxRepositoryContextChars: maxContext } : {}),
		},
		reseed: {
			...DEFAULT_CONFIG.reseed,
			...(enabled !== undefined ? { enabled } : {}),
			...(checkOnStart !== undefined ? { checkOnSessionStart: checkOnStart } : {}),
			...(checkAfterTurn !== undefined ? { checkAfterEveryTurn: checkAfterTurn } : {}),
		},
		suggestion: {
			...DEFAULT_CONFIG.suggestion,
			...(noSuggestionToken !== undefined ? { noSuggestionToken } : {}),
			...(maxAssistantTurnChars !== undefined ? { maxAssistantTurnChars } : {}),
		},
		logging: {
			...DEFAULT_CONFIG.logging,
			...(loggingLevel !== undefined ? { level: loggingLevel as AutoprompterConfig["logging"]["level"] } : {}),
		},
	};
}

export class FileConfigLoader implements ConfigLoader {
	public constructor(
		private readonly cwd: string = process.cwd(),
		private readonly homeDir: string = os.homedir(),
	) {}

	public async load(): Promise<AutoprompterConfig> {
		const userPath = path.join(this.homeDir, ".pi", "autoprompter", "config.json");
		const projectPath = path.join(this.cwd, ".pi", "autoprompter", "config.json");

		const [userConfig, projectConfig] = await Promise.all([readJsonIfExists(userPath), readJsonIfExists(projectPath)]);
		const merged = deepMerge(
			deepMerge(deepMerge(DEFAULT_CONFIG, userConfig), projectConfig),
			envOverrides(),
		);

		if (!validateConfig(merged)) {
			throw new Error(
				`Invalid autoprompter config. Checked defaults + ${userPath} + ${projectPath} + PI_AUTOPROMPTER_* overrides.`,
			);
		}
		return merged;
	}
}

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeOverrideConfig, validateConfig } from "../../dist/config/schema.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const defaultConfig = JSON.parse(
	await readFile(path.join(repoRoot, "config", "prompt-suggester.config.json"), "utf8"),
);

test("validateConfig accepts shipped defaults", () => {
	assert.equal(validateConfig(defaultConfig), true);
});

test("validateConfig rejects unknown keys and invalid values", () => {
	assert.equal(validateConfig({ ...defaultConfig, extra: true }), false);
	assert.equal(
		validateConfig({
			...defaultConfig,
			suggestion: { ...defaultConfig.suggestion, maxSuggestionChars: 0 },
		}),
		false,
	);
});

test("normalizeOverrideConfig drops invalid fields and preserves valid overrides", () => {
	const { config, changed } = normalizeOverrideConfig(
		{
			schemaVersion: defaultConfig.schemaVersion,
			suggestion: {
				maxSuggestionChars: 333,
				maxRecentUserPrompts: -5,
				unknown: true,
			},
			logging: "bad",
			extra: 1,
		},
		defaultConfig,
	);

	assert.equal(changed, true);
	assert.deepEqual(config, {
		schemaVersion: defaultConfig.schemaVersion,
		suggestion: {
			maxSuggestionChars: 333,
		},
	});
});

import test from "node:test";
import assert from "node:assert/strict";
import { toSuggestionUsage } from "../../../dist/infra/model/pi-model-client.js";

function createModel(provider, id, cost) {
	return {
		provider,
		id,
		name: `${provider}/${id}`,
		api: "openai-responses",
		baseUrl: "https://example.com",
		reasoning: true,
		input: ["text"],
		cost,
		contextWindow: 128000,
		maxTokens: 32000,
	};
}

test("toSuggestionUsage preserves reported provider cost when present", () => {
	const model = createModel("openai", "gpt-test", {
		input: 2,
		output: 8,
		cacheRead: 0.2,
		cacheWrite: 0,
	});
	const usage = toSuggestionUsage(
		{
			input: 100,
			output: 50,
			cacheRead: 10,
			cacheWrite: 0,
			totalTokens: 160,
			cost: { input: 0.1, output: 0.2, cacheRead: 0.01, cacheWrite: 0, total: 0.31 },
		},
		model,
		[model],
	);

	assert.equal(usage.costTotal, 0.31);
});

test("toSuggestionUsage falls back to sibling model pricing when configured model cost is zero", () => {
	const codexModel = createModel("openai-codex", "gpt-5.3-codex-spark", {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
	});
	const pricedModel = createModel("openai", "gpt-5.3-codex-spark", {
		input: 1.75,
		output: 14,
		cacheRead: 0.175,
		cacheWrite: 0,
	});
	const usage = toSuggestionUsage(
		{
			input: 1000000,
			output: 1000000,
			cacheRead: 1000000,
			cacheWrite: 0,
			totalTokens: 3000000,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		codexModel,
		[codexModel, pricedModel],
	);

	assert.equal(usage.costTotal, 15.925);
});

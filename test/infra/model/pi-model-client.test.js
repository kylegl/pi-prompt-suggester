import test from "node:test";
import assert from "node:assert/strict";
import { PiModelClient } from "../../../dist/infra/model/pi-model-client.js";
import { registerApiProvider, unregisterApiProviders } from "../../../node_modules/@mariozechner/pi-ai/dist/api-registry.js";

function createClient() {
	return new PiModelClient({
		getContext() {
			return undefined;
		},
	});
}

function createRuntimeWithModel(model) {
	return {
		getContext() {
			return {
				model,
				modelRegistry: {
					getAll() {
						return [model];
					},
					async getApiKeyAndHeaders(requestedModel) {
						assert.equal(requestedModel, model);
						return { ok: true };
					},
				},
			};
		},
	};
}

function createSuggestionContext() {
	return {
		latestAssistantTurn: "I can do that.",
		turnStatus: "success",
		intentSeed: null,
		recentUserPrompts: ["Fix the tests"],
		toolSignals: [],
		touchedFiles: [],
		unresolvedQuestions: [],
		recentChanged: [],
		customInstruction: "",
		noSuggestionToken: "[no suggestion]",
		maxSuggestionChars: 200,
	};
}

function registerTestProvider(response) {
	const api = `test-api-${Math.random().toString(36).slice(2)}`;
	const sourceId = `test-provider-${Math.random().toString(36).slice(2)}`;
	registerApiProvider(
		{
			api,
			stream() {
				throw new Error("stream should not be used in these tests");
			},
			streamSimple() {
				return {
					async result() {
						return response;
					},
				};
			},
		},
		sourceId,
	);
	return {
		sourceId,
		model: {
			api,
			provider: "test",
			id: "model-1",
			name: "model-1",
			baseUrl: "http://localhost",
			reasoning: false,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 1000,
			maxTokens: 1000,
		},
		unregister() {
			unregisterApiProviders(sourceId);
		},
	};
}

const model = { provider: "openai", id: "gpt-5" };

test("PiModelClient resolves auth via getApiKeyAndHeaders when available", async () => {
	const client = createClient();
	const auth = await client.resolveRequestAuth(model, {
		async getApiKeyAndHeaders(requestedModel) {
			assert.equal(requestedModel, model);
			return {
				ok: true,
				apiKey: "token-123",
				headers: { "x-test": "1" },
			};
		},
		async getApiKey() {
			throw new Error("fallback should not be used");
		},
	});

	assert.deepEqual(auth, {
		apiKey: "token-123",
		headers: { "x-test": "1" },
	});
});

test("PiModelClient accepts header-only auth results from getApiKeyAndHeaders", async () => {
	const client = createClient();
	const auth = await client.resolveRequestAuth(model, {
		async getApiKeyAndHeaders() {
			return {
				ok: true,
				headers: { Authorization: "Bearer delegated" },
			};
		},
	});

	assert.deepEqual(auth, {
		apiKey: undefined,
		headers: { Authorization: "Bearer delegated" },
	});
});

test("PiModelClient falls back to getApiKey for older ModelRegistry versions", async () => {
	const client = createClient();
	const auth = await client.resolveRequestAuth(model, {
		async getApiKey(requestedModel) {
			assert.equal(requestedModel, model);
			return "legacy-token";
		},
	});

	assert.deepEqual(auth, {
		apiKey: "legacy-token",
	});
});

test("PiModelClient surfaces ModelRegistry auth errors", async () => {
	const client = createClient();
	await assert.rejects(
		() => client.resolveRequestAuth(model, {
			async getApiKeyAndHeaders() {
				return { ok: false, error: "missing auth" };
			},
		}),
		/missing auth/,
	);
});

test("PiModelClient allows empty text for suggestions", async (t) => {
	const provider = registerTestProvider({
		content: [{ type: "text", text: "   " }],
		usage: { input: 1, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 1, cost: { total: 0 } },
	});
	t.after(() => provider.unregister());
	const client = new PiModelClient(createRuntimeWithModel(provider.model));

	const result = await client.generateSuggestion(createSuggestionContext());

	assert.equal(result.text, "");
	assert.equal(typeof result.usage?.totalTokens, "number");
});

test("PiModelClient still rejects empty text for seeder", async (t) => {
	const provider = registerTestProvider({
		content: [{ type: "text", text: "   " }],
		usage: { input: 1, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 1, cost: { total: 0 } },
	});
	t.after(() => provider.unregister());
	const client = new PiModelClient(createRuntimeWithModel(provider.model));

	await assert.rejects(
		() =>
			client.generateSeed({
				reseedTrigger: { reason: "manual", changedFiles: [] },
				previousSeed: null,
			}),
		/Model returned empty text/,
	);
});

import test from "node:test";
import assert from "node:assert/strict";
import { PiModelClient } from "../../../dist/infra/model/pi-model-client.js";

function createClient() {
	return new PiModelClient({
		getContext() {
			return undefined;
		},
	});
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

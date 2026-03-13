import test from "node:test";
import assert from "node:assert/strict";
import { SessionStateStore } from "../../../dist/infra/pi/session-state-store.js";
import { INITIAL_RUNTIME_STATE } from "../../../dist/domain/state.js";

function createInMemorySessionManager() {
	return {
		getBranch() {
			return [];
		},
		getEntries() {
			return [];
		},
		getSessionFile() {
			return undefined;
		},
		getSessionId() {
			return "test/session";
		},
		getLeafId() {
			return "leaf-1";
		},
		getCwd() {
			return process.cwd();
		},
	};
}

test("SessionStateStore persists save/usage state for in-memory sessions", async () => {
	const store = new SessionStateStore(process.cwd(), () => createInMemorySessionManager());
	await store.save({
		...INITIAL_RUNTIME_STATE,
		lastSuggestion: {
			text: "Go ahead.",
			shownAt: "2026-03-13T12:00:00.000Z",
			turnId: "turn-1",
			sourceLeafId: "leaf-1",
		},
	});
	await store.recordUsage("suggester", {
		inputTokens: 10,
		outputTokens: 5,
		cacheReadTokens: 1,
		cacheWriteTokens: 0,
		totalTokens: 16,
		costTotal: 0.02,
	});

	const state = await store.load();
	assert.equal(state.lastSuggestion?.text, "Go ahead.");
	assert.equal(state.suggestionUsage.calls, 1);
	assert.equal(state.suggestionUsage.inputTokens, 10);
	assert.equal(state.seederUsage.calls, 0);
});

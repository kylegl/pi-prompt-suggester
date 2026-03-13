import test from "node:test";
import assert from "node:assert/strict";
import { renderSuggestionPrompt } from "../../dist/prompts/suggestion-template.js";

const baseContext = {
	turnStatus: "success",
	abortContextNote: undefined,
	intentSeed: null,
	recentUserPrompts: ["fix the failing tests"],
	toolSignals: ["edited src/index.ts"],
	touchedFiles: ["src/index.ts"],
	unresolvedQuestions: [],
	recentChanged: [],
	latestAssistantTurn: "I can fix the failing tests and then commit.",
	maxSuggestionChars: 200,
	noSuggestionToken: "[no suggestion]",
	customInstruction: "",
};

test("renderSuggestionPrompt omits custom instruction block when blank", () => {
	const prompt = renderSuggestionPrompt(baseContext);
	assert.equal(prompt.includes("CustomSuggesterInstruction:"), false);
});

test("renderSuggestionPrompt includes semantic-restatement guardrails", () => {
	const prompt = renderSuggestionPrompt(baseContext);
	assert.match(prompt, /prefer a bare affirmation/i);
	assert.match(prompt, /must add new semantic content/i);
	assert.match(prompt, /prefer affirmation only/i);
});

test("renderSuggestionPrompt includes labeled custom instruction block when present", () => {
	const prompt = renderSuggestionPrompt({
		...baseContext,
		customInstruction: "Keep replies extremely terse.",
	});
	assert.match(prompt, /Follow CustomSuggesterInstruction strictly/);
	assert.match(prompt, /CustomSuggesterInstruction:/);
	assert.match(prompt, /Treat them as high priority/);
	assert.match(prompt, /Keep replies extremely terse\./);
});

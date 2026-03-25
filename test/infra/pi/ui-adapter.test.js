import test from "node:test";
import assert from "node:assert/strict";
import { PiSuggestionSink, refreshSuggesterUi } from "../../../dist/infra/pi/ui-adapter.js";

function createTheme() {
	return {
		fg(_name, text) {
			return text;
		},
	};
}

test("PiSuggestionSink keeps ghost suggestions even before idle flips", async () => {
	const runtime = {
		epoch: 1,
		suggestion: undefined,
		panelSuggestionStatus: undefined,
		panelUsageStatus: undefined,
		getContext() {
			return {
				hasUI: true,
				ui: {
					getEditorText() {
						return "";
					},
					setWidget() {},
					setStatus() {},
					theme: createTheme(),
				},
				isIdle() {
					return false;
				},
				hasPendingMessages() {
					return true;
				},
			};
		},
		getEpoch() {
			return this.epoch;
		},
		getSuggestion() {
			return this.suggestion;
		},
		setSuggestion(text) {
			this.suggestion = text;
		},
		getPanelSuggestionStatus() {
			return this.panelSuggestionStatus;
		},
		setPanelSuggestionStatus(text) {
			this.panelSuggestionStatus = text;
		},
		getPanelUsageStatus() {
			return this.panelUsageStatus;
		},
		setPanelUsageStatus(text) {
			this.panelUsageStatus = text;
		},
		getPanelLogStatus() {
			return undefined;
		},
		setPanelLogStatus() {},
		getSuggesterModelDisplay() {
			return undefined;
		},
		prefillOnlyWhenEditorEmpty: true,
	};

	const sink = new PiSuggestionSink(runtime);
	await sink.showSuggestion("hello world", { generationId: 1 });

	assert.equal(runtime.suggestion, "hello world");
	assert.match(runtime.panelSuggestionStatus, /Space accepts/);
});

test("PiSuggestionSink retains suggestions even when the editor text is temporarily incompatible", async () => {
	const runtime = {
		epoch: 1,
		suggestion: undefined,
		panelSuggestionStatus: undefined,
		panelUsageStatus: undefined,
		getContext() {
			return {
				hasUI: true,
				ui: {
					getEditorText() {
						return "previous prompt still in editor";
					},
					setWidget() {},
					setStatus() {},
					theme: createTheme(),
				},
				isIdle() {
					return true;
				},
				hasPendingMessages() {
					return false;
				},
			};
		},
		getEpoch() {
			return this.epoch;
		},
		getSuggestion() {
			return this.suggestion;
		},
		setSuggestion(text) {
			this.suggestion = text;
		},
		getPanelSuggestionStatus() {
			return this.panelSuggestionStatus;
		},
		setPanelSuggestionStatus(text) {
			this.panelSuggestionStatus = text;
		},
		getPanelUsageStatus() {
			return this.panelUsageStatus;
		},
		setPanelUsageStatus(text) {
			this.panelUsageStatus = text;
		},
		getPanelLogStatus() {
			return undefined;
		},
		setPanelLogStatus() {},
		getSuggesterModelDisplay() {
			return undefined;
		},
		prefillOnlyWhenEditorEmpty: true,
	};

	const sink = new PiSuggestionSink(runtime);
	await sink.showSuggestion("hello world", { generationId: 1 });

	assert.equal(runtime.suggestion, "hello world");
	assert.match(runtime.panelSuggestionStatus, /ghost hidden/);
});

test("refreshSuggesterUi still renders the panel when a suggestion exists", () => {
	let lastWidget;
	const ctx = {
		hasUI: true,
		ui: {
			setStatus() {},
			setWidget(key, content) {
				lastWidget = { key, content };
			},
			theme: createTheme(),
		},
		isIdle() {
			return false;
		},
		hasPendingMessages() {
			return true;
		},
	};
	const runtime = {
		getContext() {
			return ctx;
		},
		getPanelSuggestionStatus() {
			return "✦ prompt suggestion · Space accepts";
		},
		getPanelUsageStatus() {
			return "suggester usage: ↑10 ↓5 R2 $0.001 (1 sugg, 0 seed)";
		},
		getPanelLogStatus() {
			return undefined;
		},
	};

	refreshSuggesterUi(runtime);

	assert.equal(lastWidget?.key, "suggester-panel");
	assert.equal(typeof lastWidget?.content, "function");
	const rendered = lastWidget.content(null, createTheme()).render(80);
	assert.equal(rendered.some((line) => line.includes("✦ prompt suggestion · Space accepts")), true);
	assert.equal(rendered.some((line) => line.includes("suggester usage: ↑10 ↓5 R2 $0.001 (1 sugg, 0 seed)")), true);
});

test("PiSuggestionSink writes usage into the panel instead of the footer status line", async () => {
	const statusCalls = [];
	const runtime = {
		epoch: 1,
		panelUsageStatus: undefined,
		getContext() {
			return {
				hasUI: true,
				ui: {
					setStatus(key, value) {
						statusCalls.push([key, value]);
					},
					setWidget() {},
					theme: createTheme(),
				},
			};
		},
		getEpoch() {
			return this.epoch;
		},
		getSuggestion() {
			return undefined;
		},
		setSuggestion() {},
		getPanelSuggestionStatus() {
			return undefined;
		},
		setPanelSuggestionStatus() {},
		getPanelUsageStatus() {
			return this.panelUsageStatus;
		},
		setPanelUsageStatus(text) {
			this.panelUsageStatus = text;
		},
		getPanelLogStatus() {
			return undefined;
		},
		setPanelLogStatus() {},
		getSuggesterModelDisplay() {
			return "(openai) gpt-5 • high";
		},
		prefillOnlyWhenEditorEmpty: true,
	};

	const sink = new PiSuggestionSink(runtime);
	await sink.setUsage({
		suggester: { calls: 1, inputTokens: 10, outputTokens: 5, cacheReadTokens: 2, cacheWriteTokens: 0, totalTokens: 15, costTotal: 0.001 },
		seeder: { calls: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 0, costTotal: 0 },
	});

	assert.match(runtime.panelUsageStatus, /suggester usage:/);
	assert.equal(statusCalls.some(([key]) => key === "suggester-usage"), true);
});

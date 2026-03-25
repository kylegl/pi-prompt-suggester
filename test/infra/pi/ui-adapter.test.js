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
		getSuggestion() {
			return "show the actual suggestion text";
		},
		getPanelSuggestionStatus() {
			return "✦ prompt suggestion · Space accepts";
		},
		getPanelLogStatus() {
			return undefined;
		},
	};

	refreshSuggesterUi(runtime);

	assert.equal(lastWidget?.key, "suggester-panel");
	assert.equal(typeof lastWidget?.content, "function");
	const rendered = lastWidget.content(null, createTheme()).render(80);
	assert.equal(rendered.some((line) => line.includes("show the actual suggestion text")), true);
});

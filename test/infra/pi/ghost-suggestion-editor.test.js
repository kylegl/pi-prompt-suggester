import test from "node:test";
import assert from "node:assert/strict";
import { GhostSuggestionEditor } from "../../../dist/infra/pi/ghost-suggestion-editor.js";

function createHistoryStore() {
	let state = { entries: [], index: -1 };
	return {
		get() {
			return { entries: [...state.entries], index: state.index };
		},
		set(next) {
			state = { entries: [...next.entries], index: next.index };
		},
	};
}

function createEditor(store, text = "") {
	const tui = {
		terminal: { rows: 24 },
		requestRender() {},
	};
	const theme = {
		borderColor(text) {
			return text;
		},
	};
	const keybindings = {
		matches() {
			return false;
		},
	};

	const editor = new GhostSuggestionEditor(
		tui,
		theme,
		keybindings,
		() => undefined,
		() => 0,
		() => store.get(),
		(state) => store.set(state),
	);
	editor.setText(text);
	return editor;
}

test("restores submitted prompt history after ghost editor swaps", () => {
	const store = createHistoryStore();
	const firstEditor = createEditor(store);

	firstEditor.addToHistory("older prompt");
	firstEditor.addToHistory("latest prompt");

	const swappedEditor = createEditor(store);
	swappedEditor.handleInput("\x1b[A");

	assert.equal(swappedEditor.getText(), "latest prompt");
});

test("preserves active history navigation state across ghost editor swaps", () => {
	const store = createHistoryStore();
	const firstEditor = createEditor(store);

	firstEditor.addToHistory("older prompt");
	firstEditor.addToHistory("latest prompt");
	firstEditor.handleInput("\x1b[A");
	assert.equal(firstEditor.getText(), "latest prompt");

	const swappedEditor = createEditor(store, firstEditor.getText());
	swappedEditor.handleInput("\x1b[B");

	assert.equal(swappedEditor.getText(), "");
});

import test from "node:test";
import assert from "node:assert/strict";
import { getGhostEditorSyncAction } from "../../../dist/infra/pi/ghost-editor-installation.js";

test("ghost editor installs when ghost mode is active and no installation exists", () => {
	assert.equal(
		getGhostEditorSyncAction({ state: undefined, displayMode: "ghost", sessionFile: "/tmp/session.json" }),
		"install",
	);
});

test("ghost editor stays installed across context refreshes for the same session", () => {
	assert.equal(
		getGhostEditorSyncAction({
			state: { sessionFile: "/tmp/session.json" },
			displayMode: "ghost",
			sessionFile: "/tmp/session.json",
		}),
		"noop",
	);
});

test("ghost editor uninstalls when switching to widget mode", () => {
	assert.equal(
		getGhostEditorSyncAction({
			state: { sessionFile: "/tmp/session.json" },
			displayMode: "widget",
			sessionFile: "/tmp/session.json",
		}),
		"uninstall",
	);
});

test("ghost editor reinstalls when ghost mode is active for a different session", () => {
	assert.equal(
		getGhostEditorSyncAction({
			state: { sessionFile: "/tmp/old-session.json" },
			displayMode: "ghost",
			sessionFile: "/tmp/new-session.json",
		}),
		"install",
	);
});

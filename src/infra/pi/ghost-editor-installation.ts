import type { SuggestionDisplayMode } from "../../config/types.js";
import { usesGhostEditor } from "./suggestion-display-mode.js";

export interface GhostEditorInstallState {
	sessionFile: string | null;
}

export function getGhostEditorSyncAction(params: {
	state: GhostEditorInstallState | undefined;
	displayMode: SuggestionDisplayMode;
	sessionFile: string | null;
}): "install" | "uninstall" | "noop" {
	const { state, displayMode, sessionFile } = params;
	if (!usesGhostEditor(displayMode)) {
		return state ? "uninstall" : "noop";
	}
	if (state?.sessionFile === sessionFile) {
		return "noop";
	}
	return "install";
}

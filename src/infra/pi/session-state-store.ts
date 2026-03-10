import type { ExtensionAPI, SessionEntry } from "@mariozechner/pi-coding-agent";
import type { StateStore } from "../../app/ports/state-store.js";
import { CURRENT_RUNTIME_STATE_VERSION, INITIAL_RUNTIME_STATE, type RuntimeState } from "../../domain/state.js";

const STATE_CUSTOM_TYPE = "autoprompter-state";

interface BranchReadableSessionManager {
	getBranch(): SessionEntry[];
}

function extractState(entries: SessionEntry[]): RuntimeState {
	let latest: RuntimeState | undefined;
	for (const entry of entries) {
		if (entry.type === "custom" && entry.customType === STATE_CUSTOM_TYPE) {
			latest = entry.data as RuntimeState;
		}
	}
	if (!latest) return { ...INITIAL_RUNTIME_STATE };
	return {
		stateVersion: CURRENT_RUNTIME_STATE_VERSION,
		lastSuggestion: latest.lastSuggestion,
		steeringHistory: Array.isArray(latest.steeringHistory) ? latest.steeringHistory : [],
	};
}

export class SessionStateStore implements StateStore {
	public constructor(
		private readonly pi: ExtensionAPI,
		private readonly getSessionManager: () => BranchReadableSessionManager | undefined,
	) {}

	public async load(): Promise<RuntimeState> {
		const sessionManager = this.getSessionManager();
		if (!sessionManager) return { ...INITIAL_RUNTIME_STATE };
		return extractState(sessionManager.getBranch());
	}

	public async save(state: RuntimeState): Promise<void> {
		this.pi.appendEntry<RuntimeState>(STATE_CUSTOM_TYPE, {
			stateVersion: CURRENT_RUNTIME_STATE_VERSION,
			lastSuggestion: state.lastSuggestion,
			steeringHistory: state.steeringHistory,
		});
	}
}

export { STATE_CUSTOM_TYPE };

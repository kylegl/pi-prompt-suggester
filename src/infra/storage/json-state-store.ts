import { promises as fs } from "node:fs";
import type { StateStore } from "../../app/ports/state-store.js";
import { CURRENT_RUNTIME_STATE_VERSION, INITIAL_RUNTIME_STATE, type RuntimeState } from "../../domain/state.js";
import { atomicWriteJson } from "./atomic-write.js";

export class JsonStateStore implements StateStore {
	public constructor(private readonly filePath: string) {}

	public async load(): Promise<RuntimeState> {
		try {
			const raw = await fs.readFile(this.filePath, "utf8");
			const parsed = JSON.parse(raw) as RuntimeState;
			return this.normalize(parsed);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") return { ...INITIAL_RUNTIME_STATE };
			throw new Error(`Failed to read state file ${this.filePath}: ${(error as Error).message}`);
		}
	}

	public async save(state: RuntimeState): Promise<void> {
		await atomicWriteJson(this.filePath, this.normalize(state));
	}

	private normalize(state: RuntimeState): RuntimeState {
		return {
			stateVersion: CURRENT_RUNTIME_STATE_VERSION,
			lastSuggestion: state.lastSuggestion,
			steeringHistory: Array.isArray(state.steeringHistory) ? state.steeringHistory : [],
		};
	}
}

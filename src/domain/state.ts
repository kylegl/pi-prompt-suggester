import type { SteeringEvent } from "./steering.js";

export const CURRENT_RUNTIME_STATE_VERSION = 2;

export interface LastSuggestionState {
	text: string;
	shownAt: string;
	turnId: string;
	sourceLeafId: string;
}

export interface RuntimeState {
	stateVersion: number;
	lastSuggestion?: LastSuggestionState;
	steeringHistory: SteeringEvent[];
}

export const INITIAL_RUNTIME_STATE: RuntimeState = {
	stateVersion: CURRENT_RUNTIME_STATE_VERSION,
	steeringHistory: [],
};

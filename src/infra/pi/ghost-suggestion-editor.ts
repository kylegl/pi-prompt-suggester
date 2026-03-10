import { CustomEditor } from "@mariozechner/pi-coding-agent";
import { Key, matchesKey, truncateToWidth } from "@mariozechner/pi-tui";

const GHOST_COLOR = "\x1b[38;5;244m";
const RESET = "\x1b[0m";
const END_CURSOR = /\x1b\[7m \x1b\[0m/;

interface GhostState {
	text: string;
	suggestion: string;
	suffix: string;
}

export class GhostSuggestionEditor extends CustomEditor {
	public constructor(
		tui: ConstructorParameters<typeof CustomEditor>[0],
		theme: ConstructorParameters<typeof CustomEditor>[1],
		keybindings: ConstructorParameters<typeof CustomEditor>[2],
		private readonly getSuggestion: () => string | undefined,
	) {
		super(tui, theme, keybindings);
	}

	public handleInput(data: string): void {
		const ghost = this.getGhostState();
		// Accept ghost suggestion with Space when the editor is still empty.
		// Tab is already used by pi for completion/navigation.
		if (ghost && ghost.text.length === 0 && matchesKey(data, Key.space)) {
			this.setText(ghost.suggestion);
			return;
		}
		super.handleInput(data);
	}

	public render(width: number): string[] {
		const lines = super.render(width);
		const ghost = this.getGhostState();
		if (!ghost) return lines;
		if (lines.length < 3) return lines;

		const contentLineIndex = 1;
		const line = lines[contentLineIndex];
		if (!line || !END_CURSOR.test(line)) return lines;

		lines[contentLineIndex] = truncateToWidth(
			line.replace(END_CURSOR, (match) => `${match}${GHOST_COLOR}${ghost.suffix}${RESET}`),
			width,
			"",
		);
		return lines;
	}

	private getGhostState(): GhostState | undefined {
		const suggestion = this.getSuggestion()?.trim();
		if (!suggestion) return undefined;
		const text = this.getText();
		const cursor = this.getCursor();
		if (text.includes("\n")) return undefined;
		if (cursor.line !== 0 || cursor.col !== text.length) return undefined;
		if (!suggestion.startsWith(text)) return undefined;
		const suffix = suggestion.slice(text.length);
		if (!suffix) return undefined;
		return { text, suggestion, suffix };
	}
}

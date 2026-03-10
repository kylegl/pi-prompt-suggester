import { CustomEditor } from "@mariozechner/pi-coding-agent";
import { truncateToWidth } from "@mariozechner/pi-tui";

const GHOST_COLOR = "\x1b[38;5;244m";
const RESET = "\x1b[0m";
const END_CURSOR = /\x1b\[7m \x1b\[0m/;

export class GhostSuggestionEditor extends CustomEditor {
	public constructor(
		tui: ConstructorParameters<typeof CustomEditor>[0],
		theme: ConstructorParameters<typeof CustomEditor>[1],
		keybindings: ConstructorParameters<typeof CustomEditor>[2],
		private readonly getSuggestion: () => string | undefined,
	) {
		super(tui, theme, keybindings);
	}

	public render(width: number): string[] {
		const lines = super.render(width);
		const suggestion = this.getSuggestion()?.trim();
		if (!suggestion) return lines;

		const text = this.getText();
		const cursor = this.getCursor();
		if (text.includes("\n")) return lines;
		if (cursor.line !== 0 || cursor.col !== text.length) return lines;
		if (!suggestion.startsWith(text)) return lines;

		const suffix = suggestion.slice(text.length);
		if (!suffix) return lines;
		if (lines.length < 3) return lines;

		const contentLineIndex = 1;
		const line = lines[contentLineIndex];
		if (!line || !END_CURSOR.test(line)) return lines;

		lines[contentLineIndex] = truncateToWidth(
			line.replace(END_CURSOR, (match) => `${match}${GHOST_COLOR}${suffix}${RESET}`),
			width,
			"",
		);
		return lines;
	}
}

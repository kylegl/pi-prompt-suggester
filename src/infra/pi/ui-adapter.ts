import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { SuggestionSink } from "../../app/orchestrators/turn-end.js";

export interface UiContextLike {
	getContext(): ExtensionContext | undefined;
	getEpoch(): number;
	prefillOnlyWhenEditorEmpty: boolean;
}

export class PiSuggestionSink implements SuggestionSink {
	public constructor(private readonly runtime: UiContextLike) {}

	public async showSuggestion(text: string, options?: { restore?: boolean; generationId?: number }): Promise<void> {
		if (options?.generationId !== undefined && options.generationId !== this.runtime.getEpoch()) return;
		const ctx = this.runtime.getContext();
		if (!ctx?.hasUI) return;
		const theme = ctx.ui.theme;
		const editorText = ctx.ui.getEditorText().trim();
		const canPrefill =
			ctx.isIdle() &&
			!ctx.hasPendingMessages() &&
			(!this.runtime.prefillOnlyWhenEditorEmpty || editorText.length === 0);

		ctx.ui.setStatus("autoprompter", theme.fg("accent", options?.restore ? "✦ restored prompt suggestion" : "✦ prompt suggestion"));
		if (canPrefill) {
			ctx.ui.setEditorText(text);
			ctx.ui.setWidget("autoprompter", undefined);
			return;
		}

		ctx.ui.setWidget(
			"autoprompter",
			[
				`${theme.fg("accent", "Suggested next prompt")}`,
				text,
				theme.fg("dim", "(editor not empty, so suggestion was shown as a widget instead of overwriting text)"),
			],
			{ placement: "belowEditor" },
		);
	}

	public async clearSuggestion(options?: { generationId?: number }): Promise<void> {
		if (options?.generationId !== undefined && options.generationId !== this.runtime.getEpoch()) return;
		const ctx = this.runtime.getContext();
		if (!ctx?.hasUI) return;
		ctx.ui.setWidget("autoprompter", undefined);
		ctx.ui.setStatus("autoprompter", undefined);
	}
}

import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import type { SuggestionSink } from "../../app/orchestrators/turn-end.js";
import type { SuggestionUsageStats } from "../../domain/state.js";
import { formatTokens } from "./display.js";
import type { UiContextLike } from "./ui-context.js";

function formatUsage(
	usage: { suggester: SuggestionUsageStats; seeder: SuggestionUsageStats },
	suggesterModelDisplay: string | undefined,
): string {
	const combinedInput = usage.suggester.inputTokens + usage.seeder.inputTokens;
	const combinedOutput = usage.suggester.outputTokens + usage.seeder.outputTokens;
	const combinedCacheRead = usage.suggester.cacheReadTokens + usage.seeder.cacheReadTokens;
	const combinedCost = usage.suggester.costTotal + usage.seeder.costTotal;
	const suffix = suggesterModelDisplay ? `, suggester: ${suggesterModelDisplay}` : "";
	return `suggester usage: ↑${formatTokens(combinedInput)} ↓${formatTokens(combinedOutput)} R${formatTokens(combinedCacheRead)} $${combinedCost.toFixed(3)} (${usage.suggester.calls} sugg, ${usage.seeder.calls} seed)${suffix}`;
}

function formatPanelLog(
	ctx: ExtensionContext,
	status: { level: "debug" | "info" | "warn" | "error"; text: string },
): string {
	const theme = ctx.ui.theme;
	if (status.level === "error") return theme.fg("error", status.text);
	if (status.level === "warn") return theme.fg("warning", status.text);
	if (status.level === "debug") return theme.fg("dim", status.text);
	return theme.fg("muted", status.text);
}

export function refreshSuggesterUi(runtime: UiContextLike): void {
	const ctx = runtime.getContext();
	if (!ctx?.hasUI) return;

	ctx.ui.setStatus("suggester", undefined);
	ctx.ui.setStatus("suggester-events", undefined);

	const suggestionStatus = runtime.getPanelSuggestionStatus();
	const logStatus = runtime.getPanelLogStatus();
	if (!suggestionStatus && !logStatus) {
		ctx.ui.setWidget("suggester-panel", undefined);
		return;
	}

	ctx.ui.setWidget(
		"suggester-panel",
		(_tui, theme) => ({
			invalidate() {},
			render(width: number): string[] {
				const parts: string[] = [];
				if (suggestionStatus) parts.push(theme.fg("accent", suggestionStatus));
				if (logStatus) parts.push(formatPanelLog(ctx, logStatus));
				const line = parts.join(" · ");
				const truncated = truncateToWidth(line, Math.max(10, width), "", true);
				const pad = " ".repeat(Math.max(0, width - visibleWidth(truncated)));
				return [truncated + pad];
			},
		}),
		{ placement: "belowEditor" },
	);
}

export class PiSuggestionSink implements SuggestionSink {
	public constructor(private readonly runtime: UiContextLike) {}

	public async showSuggestion(text: string, options?: { restore?: boolean; generationId?: number }): Promise<void> {
		if (options?.generationId !== undefined && options.generationId !== this.runtime.getEpoch()) return;
		const ctx = this.runtime.getContext();
		if (!ctx?.hasUI) return;

		const editorText = ctx.ui.getEditorText();
		const trimmedEditorText = editorText.trim();
		const isMultilineSuggestion = text.includes("\n");
		const prefixCompatible = !editorText.includes("\n") && text.startsWith(editorText);
		const canGhostInEditor = isMultilineSuggestion
			? trimmedEditorText.length === 0
			: this.runtime.prefillOnlyWhenEditorEmpty
				? trimmedEditorText.length === 0
				: trimmedEditorText.length === 0 || prefixCompatible;

		this.runtime.setSuggestion(text);

		const statusLabel = options?.restore ? "✦ restored prompt suggestion" : "✦ prompt suggestion";
		const statusHint = canGhostInEditor ? " · Space accepts" : " · ghost hidden";
		this.runtime.setPanelSuggestionStatus(`${statusLabel}${statusHint}`);
		refreshSuggesterUi(this.runtime);
	}

	public async clearSuggestion(options?: { generationId?: number }): Promise<void> {
		if (options?.generationId !== undefined && options.generationId !== this.runtime.getEpoch()) return;
		this.runtime.setSuggestion(undefined);
		this.runtime.setPanelSuggestionStatus(undefined);
		refreshSuggesterUi(this.runtime);
	}

	public async setUsage(usage: { suggester: SuggestionUsageStats; seeder: SuggestionUsageStats }): Promise<void> {
		const ctx = this.runtime.getContext();
		if (!ctx?.hasUI) return;
		if (usage.suggester.calls <= 0 && usage.seeder.calls <= 0) {
			ctx.ui.setStatus("suggester-usage", undefined);
			return;
		}
		ctx.ui.setStatus(
			"suggester-usage",
			ctx.ui.theme.fg("dim", formatUsage(usage, this.runtime.getSuggesterModelDisplay())),
		);
	}
}

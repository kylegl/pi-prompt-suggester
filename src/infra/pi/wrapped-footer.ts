import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { ExtensionContext, ReadonlyFooterDataProvider } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@mariozechner/pi-tui";
import { formatTokens } from "./display.js";

function sanitizeStatusText(text: string): string {
	return text
		.replace(/[\r\n\t]/g, " ")
		.replace(/ +/g, " ")
		.trim();
}

function getUsageTotals(ctx: ExtensionContext): {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cost: number;
} {
	let input = 0;
	let output = 0;
	let cacheRead = 0;
	let cacheWrite = 0;
	let cost = 0;
	for (const entry of ctx.sessionManager.getEntries()) {
		if (entry.type !== "message" || entry.message.role !== "assistant") continue;
		const message = entry.message as AssistantMessage;
		input += message.usage.input;
		output += message.usage.output;
		cacheRead += message.usage.cacheRead;
		cacheWrite += message.usage.cacheWrite;
		cost += message.usage.cost.total;
	}
	return { input, output, cacheRead, cacheWrite, cost };
}

function buildPathLine(ctx: ExtensionContext, footerData: ReadonlyFooterDataProvider, width: number): string {
	let pwd = ctx.sessionManager.getCwd() || process.cwd();
	const home = process.env.HOME || process.env.USERPROFILE;
	if (home && pwd.startsWith(home)) pwd = `~${pwd.slice(home.length)}`;
	const branch = footerData.getGitBranch();
	if (branch) pwd = `${pwd} (${branch})`;
	const sessionName = ctx.sessionManager.getSessionName();
	if (sessionName) pwd = `${pwd} • ${sessionName}`;
	return truncateToWidth(ctx.ui.theme.fg("dim", pwd), width, ctx.ui.theme.fg("dim", "..."));
}

function buildStatsLine(ctx: ExtensionContext, footerData: ReadonlyFooterDataProvider, width: number): string {
	const usage = getUsageTotals(ctx);
	const statsParts: string[] = [];
	if (usage.input) statsParts.push(`↑${formatTokens(usage.input)}`);
	if (usage.output) statsParts.push(`↓${formatTokens(usage.output)}`);
	if (usage.cacheRead) statsParts.push(`R${formatTokens(usage.cacheRead)}`);
	if (usage.cacheWrite) statsParts.push(`W${formatTokens(usage.cacheWrite)}`);
	if (usage.cost) statsParts.push(`$${usage.cost.toFixed(3)}`);

	const contextUsage = ctx.getContextUsage();
	const contextWindow = contextUsage?.contextWindow ?? ctx.model?.contextWindow ?? 0;
	const contextPercent = contextUsage?.percent;
	const contextDisplay =
		contextPercent === null || contextPercent === undefined
			? `?/${formatTokens(contextWindow)}`
			: `${contextPercent.toFixed(1)}%/${formatTokens(contextWindow)}`;
	if ((contextPercent ?? 0) > 90) statsParts.push(ctx.ui.theme.fg("error", contextDisplay));
	else if ((contextPercent ?? 0) > 70) statsParts.push(ctx.ui.theme.fg("warning", contextDisplay));
	else statsParts.push(contextDisplay);

	let left = statsParts.join(" ");
	if (!left) left = "-";
	let leftWidth = visibleWidth(left);
	if (leftWidth > width) {
		left = truncateToWidth(left, width, "...");
		leftWidth = visibleWidth(left);
	}

	const model = ctx.model;
	const baseModelName = model?.id || "no-model";
	let right = baseModelName;
	if (footerData.getAvailableProviderCount() > 1 && model) right = `(${model.provider}) ${baseModelName}`;
	const rightWidth = visibleWidth(right);
	if (leftWidth + 2 + rightWidth <= width) {
		const padding = " ".repeat(Math.max(1, width - leftWidth - rightWidth));
		return ctx.ui.theme.fg("dim", left) + ctx.ui.theme.fg("dim", `${padding}${right}`);
	}
	const truncatedRight = truncateToWidth(right, Math.max(0, width - leftWidth - 1), "");
	const padding = " ".repeat(Math.max(1, width - leftWidth - visibleWidth(truncatedRight)));
	return ctx.ui.theme.fg("dim", left) + ctx.ui.theme.fg("dim", `${padding}${truncatedRight}`);
}

function buildWrappedStatusLines(ctx: ExtensionContext, footerData: ReadonlyFooterDataProvider, width: number): string[] {
	const priority = (key: string): number => {
		if (key === "suggester") return 0;
		if (key === "suggester-usage") return 1;
		if (key === "suggester-events") return 99;
		if (key.startsWith("suggester")) return 2;
		return 10;
	};

	const statuses = Array.from(footerData.getExtensionStatuses().entries())
		.map(([key, text]) => ({ key, text: sanitizeStatusText(text) }))
		.filter((item) => item.text.length > 0)
		.sort((a, b) => {
			const pa = priority(a.key);
			const pb = priority(b.key);
			if (pa !== pb) return pa - pb;
			return a.key.localeCompare(b.key);
		});
	if (statuses.length === 0) return [];

	const maxLines = 3;
	const lines: string[] = [];
	for (const status of statuses) {
		const wrapped = wrapTextWithAnsi(status.text, Math.max(10, width));
		for (const line of wrapped) {
			lines.push(line);
			if (lines.length === maxLines) {
				lines[maxLines - 1] = truncateToWidth(lines[maxLines - 1], width, ctx.ui.theme.fg("dim", "..."));
				return lines;
			}
		}
	}
	return lines;
}

export function installWrappedFooter(ctx: ExtensionContext): void {
	if (!ctx.hasUI) return;
	ctx.ui.setFooter((tui, _theme, footerData) => {
		const unSubBranch = footerData.onBranchChange(() => tui.requestRender());
		return {
			dispose: unSubBranch,
			invalidate() {},
			render: (width: number) => {
				const lines = [buildPathLine(ctx, footerData, width), buildStatsLine(ctx, footerData, width)];
				return [...lines, ...buildWrappedStatusLines(ctx, footerData, width)];
			},
		};
	});
}

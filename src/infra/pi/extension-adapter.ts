import type {
	AgentEndEvent,
	ExtensionAPI,
	ExtensionCommandContext,
	ExtensionContext,
	InputEvent,
	SessionForkEvent,
	SessionStartEvent,
	SessionSwitchEvent,
	SessionTreeEvent,
} from "@mariozechner/pi-coding-agent";
import { buildTurnContext } from "../../app/services/conversation-signals.js";

export interface ExtensionWiring {
	onSessionStart: (ctx: ExtensionContext) => Promise<void>;
	onAgentEnd: (turn: ReturnType<typeof buildTurnContext>, ctx: ExtensionContext) => Promise<void>;
	onUserSubmit: (event: InputEvent, ctx: ExtensionContext) => Promise<void>;
	onReseedCommand: (ctx: ExtensionCommandContext) => Promise<void>;
	onStatusCommand: (ctx: ExtensionCommandContext) => Promise<void>;
	onClearCommand: (ctx: ExtensionCommandContext) => Promise<void>;
}

async function handleSessionEvent(
	ctx: ExtensionContext,
	handler: (ctx: ExtensionContext) => Promise<void>,
): Promise<void> {
	await handler(ctx);
}

export class PiExtensionAdapter {
	public constructor(
		private readonly pi: ExtensionAPI,
		private readonly wiring: ExtensionWiring,
	) {}

	public register(): void {
		this.pi.on("session_start", async (_event: SessionStartEvent, ctx) => {
			await handleSessionEvent(ctx, this.wiring.onSessionStart);
		});
		this.pi.on("session_tree", async (_event: SessionTreeEvent, ctx) => {
			await handleSessionEvent(ctx, this.wiring.onSessionStart);
		});
		this.pi.on("session_fork", async (_event: SessionForkEvent, ctx) => {
			await handleSessionEvent(ctx, this.wiring.onSessionStart);
		});
		this.pi.on("session_switch", async (_event: SessionSwitchEvent, ctx) => {
			await handleSessionEvent(ctx, this.wiring.onSessionStart);
		});

		this.pi.on("agent_end", async (event: AgentEndEvent, ctx) => {
			const branchEntries = ctx.sessionManager.getBranch();
			const branchMessages = branchEntries
				.filter((entry): entry is typeof branchEntries[number] & { type: "message" } => entry.type === "message")
				.map((entry) => entry.message);
			const turn = buildTurnContext({
				turnId: ctx.sessionManager.getLeafId() ?? `turn-${Date.now()}`,
				sourceLeafId: ctx.sessionManager.getLeafId() ?? `turn-${Date.now()}`,
				messagesFromPrompt: event.messages,
				branchMessages,
				occurredAt: new Date().toISOString(),
			});
			await this.wiring.onAgentEnd(turn, ctx);
		});

		this.pi.on("input", async (event: InputEvent, ctx) => {
			await this.wiring.onUserSubmit(event, ctx);
			return { action: "continue" };
		});

		this.pi.registerCommand("autoprompter", {
			description: "autoprompter controls: status | reseed | clear",
			handler: async (args, ctx) => {
				const subcommand = args.trim().split(/\s+/)[0] || "status";
				if (subcommand === "reseed") {
					await this.wiring.onReseedCommand(ctx);
					return;
				}
				if (subcommand === "clear") {
					await this.wiring.onClearCommand(ctx);
					return;
				}
				await this.wiring.onStatusCommand(ctx);
			},
		});
	}
}

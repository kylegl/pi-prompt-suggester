import type { Logger } from "../../app/ports/logger.js";

type Level = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<Level, number> = {
	debug: 10,
	info: 20,
	warn: 30,
	error: 40,
};

export class ConsoleLogger implements Logger {
	public constructor(private readonly level: Level = "info") {}

	public debug(message: string, meta?: Record<string, unknown>): void {
		this.log("debug", message, meta);
	}

	public info(message: string, meta?: Record<string, unknown>): void {
		this.log("info", message, meta);
	}

	public warn(message: string, meta?: Record<string, unknown>): void {
		this.log("warn", message, meta);
	}

	public error(message: string, meta?: Record<string, unknown>): void {
		this.log("error", message, meta);
	}

	private log(level: Level, message: string, meta?: Record<string, unknown>): void {
		if (LEVEL_ORDER[level] < LEVEL_ORDER[this.level]) return;
		const payload = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
		const line = `[pi-autoprompter:${level}] ${message}${payload}`;
		if (level === "error") console.error(line);
		else if (level === "warn") console.warn(line);
		else console.log(line);
	}
}

import type { ExtensionContext } from "@mariozechner/pi-coding-agent";

export class RuntimeRef {
	private currentContext: ExtensionContext | undefined;
	private generationEpoch = 0;
	private currentSuggestion: string | undefined;

	public setContext(ctx: ExtensionContext): void {
		this.currentContext = ctx;
	}

	public getContext(): ExtensionContext | undefined {
		return this.currentContext;
	}

	public bumpEpoch(): number {
		this.generationEpoch += 1;
		return this.generationEpoch;
	}

	public getEpoch(): number {
		return this.generationEpoch;
	}

	public setSuggestion(text: string | undefined): void {
		this.currentSuggestion = text?.trim() || undefined;
	}

	public getSuggestion(): string | undefined {
		return this.currentSuggestion;
	}
}

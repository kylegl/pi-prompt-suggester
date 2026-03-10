import { promises as fs } from "node:fs";
import path from "node:path";
import type { AutoprompterConfig } from "../../config/types.js";
import type { SeedArtifact, ReseedTrigger } from "../../domain/seed.js";

const IGNORED_DIRS = new Set([".git", "node_modules", ".pi", "dist", "build", "coverage"]);

export interface RepositoryContextBuildResult {
	repositoryContext: string;
	discoveredFiles: string[];
	defaultKeyFiles: string[];
}

function truncate(value: string, maxChars: number): string {
	if (value.length <= maxChars) return value;
	return `${value.slice(0, maxChars)}\n...[truncated]`;
}

function globToRegExp(glob: string): RegExp {
	const escaped = glob
		.replace(/[.+^${}()|[\]\\]/g, "\\$&")
		.replace(/\*\*/g, "::DOUBLE_STAR::")
		.replace(/\*/g, "[^/]*")
		.replace(/::DOUBLE_STAR::/g, ".*");
	return new RegExp(`^${escaped}$`);
}

function matchesAnyGlob(filePath: string, globs: string[]): boolean {
	return globs.some((glob) => globToRegExp(glob).test(filePath));
}

async function exists(filePath: string): Promise<boolean> {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}

async function walkFiles(root: string, currentRelative = ""): Promise<string[]> {
	const absolute = path.join(root, currentRelative);
	const entries = await fs.readdir(absolute, { withFileTypes: true });
	const files: string[] = [];
	for (const entry of entries) {
		if (entry.name.startsWith(".")) {
			if (entry.name !== ".github") continue;
		}
		if (entry.isDirectory()) {
			if (IGNORED_DIRS.has(entry.name)) continue;
			files.push(...(await walkFiles(root, path.join(currentRelative, entry.name))));
		} else if (entry.isFile()) {
			files.push(path.normalize(path.join(currentRelative, entry.name)));
		}
	}
	return files;
}

function scoreFile(filePath: string, trigger: ReseedTrigger, previousSeed: SeedArtifact | null): number {
	let score = 0;
	if (filePath === "README.md") score += 100;
	if (filePath === "vision.md") score += 100;
	if (filePath === "package.json") score += 80;
	if (filePath.startsWith("docs/")) score += 60;
	if (filePath === "src/index.ts") score += 50;
	if (filePath.endsWith(".md")) score += 20;
	if (trigger.changedFiles.includes(filePath)) score += 40;
	if (previousSeed?.keyFiles.some((file) => file.path === filePath)) score += 30;
	return score;
}

async function renderTree(root: string, maxDepth: number, currentRelative = "", depth = 0): Promise<string[]> {
	if (depth > maxDepth) return [];
	const absolute = path.join(root, currentRelative);
	const entries = await fs.readdir(absolute, { withFileTypes: true });
	const lines: string[] = [];
	for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
		if (entry.name.startsWith(".") && entry.name !== ".github") continue;
		if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;
		const relative = path.join(currentRelative, entry.name);
		lines.push(`${"  ".repeat(depth)}${entry.isDirectory() ? "📁" : "📄"} ${relative}`);
		if (entry.isDirectory()) {
			lines.push(...(await renderTree(root, maxDepth, relative, depth + 1)));
		}
	}
	return lines;
}

export class RepositoryContextBuilder {
	public constructor(
		private readonly cwd: string,
		private readonly config: AutoprompterConfig,
	) {}

	public async build(trigger: ReseedTrigger, previousSeed: SeedArtifact | null): Promise<RepositoryContextBuildResult> {
		const allFiles = await walkFiles(this.cwd);
		const defaultKeyFiles = allFiles.filter((file) => matchesAnyGlob(file, this.config.seed.keyFileGlobs)).slice(0, 64);
		const ranked = allFiles
			.map((file) => ({ file, score: scoreFile(file, trigger, previousSeed) }))
			.sort((a, b) => b.score - a.score || a.file.localeCompare(b.file))
			.map(({ file }) => file);

		const selected = Array.from(new Set([...defaultKeyFiles, ...ranked])).slice(0, this.config.seed.maxFiles);
		const treeLines = await renderTree(this.cwd, 2);
		const sections: string[] = [
			`Repository root: ${this.cwd}`,
			`Top-level tree:\n${treeLines.join("\n") || "(empty)"}`,
			`Trigger reason: ${trigger.reason}`,
			`Changed files: ${trigger.changedFiles.join(", ") || "(none)"}`,
		];

		for (const file of selected) {
			const absolute = path.join(this.cwd, file);
			if (!(await exists(absolute))) continue;
			const raw = await fs.readFile(absolute, "utf8");
			sections.push(`=== ${file} ===\n${truncate(raw, this.config.seed.maxFileChars)}`);
			const combined = sections.join("\n\n");
			if (combined.length > this.config.seed.maxRepositoryContextChars) {
				sections.pop();
				break;
			}
		}

		if (previousSeed) {
			sections.push(
				`Previous intent summary:\n${previousSeed.projectIntentSummary}\nObjectives: ${previousSeed.topObjectives.join(" | ")}\nConstraints: ${previousSeed.constraints.join(" | ")}`,
			);
		}

		if (trigger.gitDiffSummary) {
			sections.push(`Git diff summary:\n${truncate(trigger.gitDiffSummary, this.config.seed.maxDiffChars)}`);
		}

		return {
			repositoryContext: truncate(sections.join("\n\n"), this.config.seed.maxRepositoryContextChars),
			discoveredFiles: allFiles,
			defaultKeyFiles,
		};
	}
}

export { matchesAnyGlob };

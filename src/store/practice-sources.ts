import fs from "node:fs";
import path from "node:path";
import { PRACTICE_FILES } from "../../config.ts";
import type { PracticeFlagEvent } from "../core/practice/contracts.ts";

export interface SourceChunkRecord {
	id: string;
	sourceId: string;
	url: string;
	title?: string;
	text: string;
	fetchedAt: string;
}

export interface SourceCacheFile {
	chunks: SourceChunkRecord[];
}

export type SourceTrustMap = Record<string, number>;

function ensureParent(file: string): void {
	fs.mkdirSync(path.dirname(file), { recursive: true });
}

export function readSourceCache(): SourceCacheFile {
	try {
		const raw = fs.readFileSync(PRACTICE_FILES.sourceCache, "utf-8");
		return JSON.parse(raw) as SourceCacheFile;
	} catch {
		return { chunks: [] };
	}
}

export function writeSourceCache(cache: SourceCacheFile): void {
	ensureParent(PRACTICE_FILES.sourceCache);
	fs.writeFileSync(PRACTICE_FILES.sourceCache, JSON.stringify(cache, null, 2));
}

export function readSourceTrust(): SourceTrustMap {
	try {
		const raw = fs.readFileSync(PRACTICE_FILES.sourceTrust, "utf-8");
		return JSON.parse(raw) as SourceTrustMap;
	} catch {
		return {};
	}
}

export function writeSourceTrust(map: SourceTrustMap): void {
	ensureParent(PRACTICE_FILES.sourceTrust);
	fs.writeFileSync(PRACTICE_FILES.sourceTrust, JSON.stringify(map, null, 2));
}

export function appendFlagEvent(event: PracticeFlagEvent): void {
	ensureParent(PRACTICE_FILES.flagEvents);
	fs.appendFileSync(PRACTICE_FILES.flagEvents, `${JSON.stringify(event)}\n`);
}

export function readFlagEvents(): PracticeFlagEvent[] {
	try {
		const raw = fs.readFileSync(PRACTICE_FILES.flagEvents, "utf-8");
		return raw
			.split("\n")
			.filter(Boolean)
			.map((line) => JSON.parse(line) as PracticeFlagEvent);
	} catch {
		return [];
	}
}

export function appendSourcedBuildLog(line: Record<string, unknown>): void {
	ensureParent(PRACTICE_FILES.sourcedBuildLog);
	fs.appendFileSync(PRACTICE_FILES.sourcedBuildLog, `${JSON.stringify(line)}\n`);
}

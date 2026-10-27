import fs from "node:fs";
import path from "node:path";
import { PRACTICE_FILES } from "../../config.ts";
import { readDemoMedia } from "../practice/demo/load.ts";
import type {
	PracticeAnswerEvent,
	PracticeEntry,
	PracticeEntryDecisionEvent,
	PracticeSubject,
} from "../core/practice/contracts.ts";
import { migratePracticeEntries } from "../core/practice/entry-migrate.ts";

function readJsonl<T>(file: string): T[] {
	let raw: string;
	try {
		raw = fs.readFileSync(file, "utf-8");
	} catch {
		return [];
	}
	const out: T[] = [];
	for (const line of raw.split("\n")) {
		const t = line.trim();
		if (!t) continue;
		try {
			out.push(JSON.parse(t) as T);
		} catch {
			// skip corrupt
		}
	}
	return out;
}

function appendJsonl<T>(file: string, row: T): void {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.appendFileSync(file, `${JSON.stringify(row)}\n`, "utf-8");
}

function writeJson<T>(file: string, value: T): void {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, JSON.stringify(value, null, "\t"), "utf-8");
}

function readJson<T>(file: string, fallback: T): T {
	try {
		return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
	} catch {
		return fallback;
	}
}

export const practiceStore = {
	readSubjects(): PracticeSubject[] {
		return readJson<PracticeSubject[]>(PRACTICE_FILES.subjects, []);
	},
	writeSubjects(subjects: PracticeSubject[]): void {
		writeJson(PRACTICE_FILES.subjects, subjects);
	},
	readEntries(): PracticeEntry[] {
		return migratePracticeEntries(readJsonl<PracticeEntry>(PRACTICE_FILES.entries));
	},
	writeEntries(entries: PracticeEntry[]): void {
		fs.mkdirSync(path.dirname(PRACTICE_FILES.entries), { recursive: true });
		fs.writeFileSync(
			PRACTICE_FILES.entries,
			entries.map((e) => JSON.stringify(e)).join("\n") + (entries.length ? "\n" : ""),
			"utf-8",
		);
	},
	appendAnswerEvent(event: PracticeAnswerEvent): void {
		appendJsonl(PRACTICE_FILES.answerEvents, event);
	},
	readAnswerEvents(): PracticeAnswerEvent[] {
		return readJsonl<PracticeAnswerEvent>(PRACTICE_FILES.answerEvents);
	},
	appendEntryDecision(event: PracticeEntryDecisionEvent): void {
		appendJsonl(PRACTICE_FILES.entryDecisions, event);
	},
	readEntryDecisions(): PracticeEntryDecisionEvent[] {
		return readJsonl<PracticeEntryDecisionEvent>(PRACTICE_FILES.entryDecisions);
	},
	mediaPath(token: string): string {
		const safe = token.replace(/[^a-zA-Z0-9._-]/g, "_");
		return path.join(PRACTICE_FILES.mediaDir, safe);
	},
	mediaExists(token: string): boolean {
		if (token.startsWith("inline:")) return true;
		if (readDemoMedia(token)) return true;
		return fs.existsSync(practiceStore.mediaPath(token));
	},
	writeMedia(token: string, bytes: Buffer): void {
		fs.mkdirSync(PRACTICE_FILES.mediaDir, { recursive: true });
		fs.writeFileSync(practiceStore.mediaPath(token), bytes);
	},
	readMedia(token: string): { bytes: Buffer; contentType: string } | null {
		if (!token.startsWith("inline:")) {
			const demo = readDemoMedia(token);
			if (demo) return demo;
		}
		if (token.startsWith("inline:")) {
			const b64 = token.slice("inline:".length);
			const bytes = Buffer.from(b64, "base64url");
			const text = bytes.toString("utf-8");
			return { bytes, contentType: text.startsWith("<svg") ? "image/svg+xml" : "application/octet-stream" };
		}
		const file = practiceStore.mediaPath(token);
		if (!fs.existsSync(file)) return null;
		const bytes = fs.readFileSync(file);
		const ext = path.extname(file).toLowerCase();
		const contentType =
			ext === ".svg"
				? "image/svg+xml"
				: ext === ".png"
					? "image/png"
					: ext === ".jpg" || ext === ".jpeg"
						? "image/jpeg"
						: ext === ".webp"
							? "image/webp"
							: "application/octet-stream";
		return { bytes, contentType };
	},
};

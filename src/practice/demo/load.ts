import fs from "node:fs";
import type { PracticeDailyItem, PracticeSubject } from "../../core/practice/contracts.ts";
import { DEMO_FIXTURE_DIR, DEMO_MEDIA_DIR, DEMO_SUBJECT_ID } from "./paths.ts";

let cachedSubject: PracticeSubject | null = null;
let cachedDeck: PracticeDailyItem[] | null = null;

function readJson<T>(file: string, fallback: T): T {
	try {
		return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
	} catch {
		return fallback;
	}
}

export function loadDemoSubject(): PracticeSubject {
	if (!cachedSubject) {
		cachedSubject = readJson<PracticeSubject>(`${DEMO_FIXTURE_DIR}/subject.json`, {
			subjectId: DEMO_SUBJECT_ID,
			title: "Try the quiz",
			enabled: true,
			dailyCards: 0,
			itemKinds: [],
			sandbox: true,
		});
	}
	return cachedSubject;
}

export function loadDemoDeck(): PracticeDailyItem[] {
	if (!cachedDeck) {
		cachedDeck = readJson<PracticeDailyItem[]>(`${DEMO_FIXTURE_DIR}/deck.json`, []);
	}
	return cachedDeck;
}

export function findDemoCard(cardId: string): PracticeDailyItem | undefined {
	return loadDemoDeck().find((c) => c.id === cardId);
}

export function readDemoMedia(token: string): { bytes: Buffer; contentType: string } | null {
	const safe = token.replace(/[^a-zA-Z0-9._-]/g, "_");
	const file = `${DEMO_MEDIA_DIR}/${safe}`;
	if (!fs.existsSync(file)) return null;
	const bytes = fs.readFileSync(file);
	const contentType = safe.endsWith(".svg") ? "image/svg+xml" : "application/octet-stream";
	return { bytes, contentType };
}

export function isDemoMediaToken(token: string): boolean {
	return readDemoMedia(token) !== null;
}

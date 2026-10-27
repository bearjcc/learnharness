/**
 * Practice quiz engine contracts (Choice app) — pure types, browser-safe.
 */

export type PracticeEntryType = "term" | "fact" | "groove" | "visual" | string;

export type PracticeEntryStatus = "pending" | "confirmed" | "retired";

export type PracticeEntryOrigin =
	| { kind: "manual" }
	| { kind: "import" }
	| { kind: "graph"; propositionId: string }
	| { kind: "commons"; pageTitle: string };

export type PracticeMediaKind = "svg" | "png" | "jpg" | "jpeg" | "webp" | "audio";

export interface PracticeMediaAttribution {
	sourceUrl?: string;
	author?: string;
	license?: string;
}

/** `ref` is a media token (filename under practice/media). */
export interface PracticeMediaRef {
	kind: PracticeMediaKind;
	ref: string;
	attribution?: PracticeMediaAttribution;
}

export interface PracticeFsrsState {
	due: string;
	stability: number;
	difficulty: number;
	scheduled_days: number;
	learning_steps: number;
	reps: number;
	lapses: number;
	state: number;
	last_review?: string;
}

export interface PracticeSubject {
	subjectId: string;
	title: string;
	enabled: boolean;
	/** Target count for the daily build. */
	dailyCards: number;
	itemKinds: string[];
	/** Built queue served to Choice (ISO date + items). */
	dailyQueueDate?: string;
	dailyQueue?: PracticeDailyItem[];
}

export interface PracticeEntry {
	subjectId: string;
	entryId: string;
	type: PracticeEntryType;
	front: string;
	back: string;
	aliases?: string[];
	tags?: string[];
	media?: PracticeMediaRef;
	origin: PracticeEntryOrigin;
	propositionId?: string;
	status: PracticeEntryStatus;
	fsrs?: PracticeFsrsState;
}

export interface PracticeDailyItem {
	id: string;
	kind: string;
	subjectId: string;
	entryId: string;
	correctOptionId: string;
	optionIds: string[];
	prompt: PracticeRenderPart[];
	options: PracticeOptionPart[];
	explain?: string;
	tags?: string[];
}

export type PracticeRenderPart =
	| { type: "text"; text: string }
	| { type: "image"; token: string }
	| { type: "audio"; token: string };

export type PracticeOptionPart =
	| { id: string; type: "text"; text: string }
	| { id: string; type: "image"; token: string }
	| { id: string; type: "audio"; token: string };

export interface PracticePickCard {
	id: string;
	kind: "pick";
	subject: string;
	prompt: { text?: string; image?: string; audio?: string };
	options: Array<{ id: string; text?: string; image?: string; audio?: string }>;
	answer: string;
	explain?: string;
	tags?: string[];
}

export interface PracticeAnswerEvent {
	event_id: string;
	card_id: string;
	subject: string;
	picked?: string;
	correct?: boolean;
	ms?: number;
	at?: string;
	undo?: boolean;
}

export interface PracticeEntryDecisionEvent {
	event_id: string;
	entry_id: string;
	value: "keep" | "reject";
}

export interface GrooveGrid {
	stepsPerBar: number;
	bars: number;
	instruments: Record<string, boolean[][]>;
}

/** Bulk import row (POST /api/entries/import). */
export interface PracticeImportEntry {
	subjectId: string;
	entryId?: string;
	type: PracticeEntryType;
	front: string;
	back: string;
	aliases?: string[];
	tags?: string[];
	media?: PracticeMediaRef;
	/** Fetch and cache from Wikimedia Commons / Wikipedia. */
	commons?: { pageTitle: string };
}

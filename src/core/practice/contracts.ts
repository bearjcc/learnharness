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

/** Named visual style for an entry (e.g. outline, locator). */
export type PracticeMediaVariantMap = Record<string, PracticeMediaRef>;

/** Per-subject mix of media variants for image-based items. */
export interface PracticeMediaVariantConfig {
	/** Variant keys enabled for this subject (e.g. `outline`, `locator`). */
	enabled: string[];
	/** Relative weights; omitted keys default to 1. */
	weights?: Record<string, number>;
	/** Optional distractor bias for visual entries. */
	distractorBias?: "tags" | "similar-size" | "similar-shape";
}

export type EntryField = "front" | "back" | "media";

export interface PracticeFacet {
	field: EntryField;
	valueKind: "text" | "image" | "audio";
	lang?: string;
	mediaVariant?: string;
}

export type PracticeSourceKind = "wikipedia" | "site" | "pdf" | "builtin";

export interface PracticeSourceBase {
	id: string;
	label?: string;
	/** Cache refresh interval in hours (default 168). */
	ttlHours?: number;
}

export interface PracticeWikipediaSource extends PracticeSourceBase {
	kind: "wikipedia";
	language?: string;
	pages?: string[];
	categories?: string[];
}

export interface PracticeSiteSource extends PracticeSourceBase {
	kind: "site";
	allowDomains: string[];
	seedUrls?: string[];
	sitemapUrl?: string;
}

export interface PracticePdfSource extends PracticeSourceBase {
	kind: "pdf";
	/** Path relative to LH_DATA_DIR or absolute. */
	path: string;
}

export interface PracticeBuiltinSource extends PracticeSourceBase {
	kind: "builtin";
	/** e.g. geography, grooves, latin-phrases */
	builtinId: string;
}

export type PracticeSourceConfig =
	| PracticeWikipediaSource
	| PracticeSiteSource
	| PracticePdfSource
	| PracticeBuiltinSource;

export interface PracticeEntryCitation {
	sourceId: string;
	url?: string;
	quote: string;
}

export interface PracticeCardSource {
	url: string;
	label: string;
}

export interface PracticeFlagEvent {
	event_id: string;
	card_id: string;
	subject: string;
	entry_id?: string;
	source_id?: string;
	at: string;
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
	/** Enabled media variant keys and mix weights for visual pick items. */
	mediaVariants?: PracticeMediaVariantConfig;
	/** Sandbox deck: no FSRS, stats, or graph; full deck served on every today fetch. */
	sandbox?: boolean;
	/** BCP-47 or short codes for translation picks (e.g. front `la`, back `en`). */
	sideLanguages?: { front?: string; back?: string };
	/** Optional shape checks on text options. */
	formHeuristic?: { maxWordCountRatio?: number };
	/** Mix of entry-sourced vs model-invented wrong answers (weights). */
	distractors?: { fromEntries: number; invented: number };
	/** Reject invented distractors above this embedding cosine similarity (default 0.85). */
	embeddingMaxSimilarity?: number;
	/** Verified sources for auto-sourced quiz items (see docs/practice.md). */
	sources?: PracticeSourceConfig[];
	/** When false (default), sourced items auto-confirm; when true, pending/confirm flow applies. */
	requireReview?: boolean;
	/** Local model id for citation support judge (defaults to writer model). */
	judgeModel?: string;
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
	/** Legacy single asset; treated as variant `default` when `variants` is omitted. */
	media?: PracticeMediaRef;
	/** Named media assets (outline, locator, …). */
	variants?: PracticeMediaVariantMap;
	origin: PracticeEntryOrigin;
	propositionId?: string;
	status: PracticeEntryStatus;
	fsrs?: PracticeFsrsState;
	/** Pending import: front is a topic hint; back is not trusted until sourced. */
	topicOnly?: boolean;
	citation?: PracticeEntryCitation;
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
	/** Media variant used for all images in this item (image-pick / label-pick). */
	mediaVariant?: string;
	/** Shown in Choice after answer (link to verified source). */
	source?: PracticeCardSource;
	citationSourceId?: string;
}

export type PracticeRenderPart =
	| { type: "text"; text: string; facet?: PracticeFacet }
	| { type: "image"; token: string; facet?: PracticeFacet }
	| { type: "audio"; token: string; facet?: PracticeFacet };

export type PracticeOptionSource = "entry" | "invented";

export type PracticeOptionPart =
	| { id: string; type: "text"; text: string; facet?: PracticeFacet; source?: PracticeOptionSource }
	| { id: string; type: "image"; token: string; facet?: PracticeFacet; source?: PracticeOptionSource }
	| { id: string; type: "audio"; token: string; facet?: PracticeFacet; source?: PracticeOptionSource };

export interface PracticePickCard {
	id: string;
	kind: "pick";
	subject: string;
	prompt: { text?: string; image?: string; audio?: string };
	options: Array<{ id: string; text?: string; image?: string; audio?: string }>;
	answer: string;
	explain?: string;
	tags?: string[];
	source?: PracticeCardSource;
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
	/** User-reported bad card (retires entry, lowers source trust). */
	flag?: "bad";
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
	variants?: PracticeMediaVariantMap;
	/** Fetch and cache from Wikimedia Commons / Wikipedia. */
	commons?: { pageTitle: string };
}

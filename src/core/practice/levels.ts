import type {
	PracticeAnswerEvent,
	PracticeEntry,
	PracticeLevelUnlockRule,
	PracticeSubject,
} from "./contracts.ts";

export interface PracticeLevelProgress {
	currentLevel: number;
	unlockedLevels: number[];
}

export function entryLevel(entry: PracticeEntry): number {
	return entry.level ?? 1;
}

function ruleSatisfied(
	subjectId: string,
	rule: PracticeLevelUnlockRule,
	entries: PracticeEntry[],
	answers: PracticeAnswerEvent[],
): boolean {
	const pool = entries.filter((e) => e.status === "confirmed" && entryLevel(e) === rule.fromLevel);
	if (!pool.length) return false;

	let ok = false;
	if (rule.stableFraction !== undefined) {
		const minDays = rule.minStabilityDays ?? 3;
		const stableCount = pool.filter((e) => (e.fsrs?.stability ?? 0) >= minDays).length;
		ok = stableCount / pool.length >= rule.stableFraction;
	}
	if (!ok && rule.minCorrectAnswers !== undefined && rule.minCorrectAnswers > 0) {
		const entryIds = new Set(pool.map((e) => e.entryId));
		const correct = answers.filter(
			(a) =>
				a.subject === subjectId &&
				a.correct &&
				!a.undo &&
				a.entry_id &&
				entryIds.has(a.entry_id),
		).length;
		ok = correct >= rule.minCorrectAnswers;
	}
	return ok;
}

export function computePracticeLevelProgress(
	subject: PracticeSubject,
	entries: PracticeEntry[],
	answers: PracticeAnswerEvent[] = [],
): PracticeLevelProgress {
	const rules = [...(subject.levels?.rules ?? [])].sort((a, b) => a.unlockLevel - b.unlockLevel);
	const unlocked = new Set<number>([1]);
	for (const rule of rules) {
		if (ruleSatisfied(subject.subjectId, rule, entries, answers)) unlocked.add(rule.unlockLevel);
	}
	if (!rules.length) {
		const maxEntry = Math.max(1, ...entries.map(entryLevel));
		for (let lvl = 1; lvl <= maxEntry; lvl++) unlocked.add(lvl);
	}
	const unlockedLevels = [...unlocked].sort((a, b) => a - b);
	const currentLevel = unlockedLevels.at(-1) ?? 1;
	return { currentLevel, unlockedLevels };
}

export function entryAllowedForDeal(
	entry: PracticeEntry,
	progress: PracticeLevelProgress,
	subject: PracticeSubject,
	seed: string,
): boolean {
	const lvl = entryLevel(entry);
	if (lvl <= progress.currentLevel) return true;
	const previewLevel = progress.currentLevel + 1;
	if (lvl !== previewLevel) return false;
	const share = subject.levels?.previewNextLevelShare ?? 0;
	if (share <= 0) return false;
	let h = 2166136261;
	for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
	const roll = (h >>> 0) / 2 ** 32;
	return roll < share;
}

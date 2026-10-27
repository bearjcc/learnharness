import { createEmptyCard, fsrs, type Card, Rating, type Grade } from "ts-fsrs";
import type { PracticeEntry, PracticeFsrsState } from "./contracts.ts";

const scheduler = fsrs();

export function defaultFsrsState(now = new Date()): PracticeFsrsState {
	return cardToState(createEmptyCard(now));
}

function cardToState(card: Card): PracticeFsrsState {
	return {
		due: card.due.toISOString(),
		stability: card.stability,
		difficulty: card.difficulty,
		scheduled_days: card.scheduled_days,
		learning_steps: card.learning_steps,
		reps: card.reps,
		lapses: card.lapses,
		state: card.state,
		...(card.last_review ? { last_review: card.last_review.toISOString() } : {}),
	};
}

function stateToCard(state: PracticeFsrsState): Card {
	return {
		due: new Date(state.due),
		stability: state.stability,
		difficulty: state.difficulty,
		scheduled_days: state.scheduled_days,
		learning_steps: state.learning_steps,
		reps: state.reps,
		lapses: state.lapses,
		state: state.state,
		elapsed_days: 0,
		...(state.last_review ? { last_review: new Date(state.last_review) } : {}),
	};
}

export function fsrsDue(entry: PracticeEntry, now = new Date()): boolean {
	const state = entry.fsrs ?? defaultFsrsState(now);
	return new Date(state.due).getTime() <= now.getTime();
}

export function applyFsrsReview(
	entry: PracticeEntry,
	correct: boolean,
	now = new Date(),
): PracticeFsrsState {
	const card = stateToCard(entry.fsrs ?? defaultFsrsState(now));
	const grade: Grade = correct ? Rating.Good : Rating.Again;
	const result = scheduler.next(card, now, grade);
	return cardToState(result.card);
}

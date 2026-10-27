import type { PracticeDailyItem, PracticePickCard, PracticeOptionPart, PracticeRenderPart } from "./contracts.ts";

function partToPrompt(parts: PracticeRenderPart[]): PracticePickCard["prompt"] {
	const out: PracticePickCard["prompt"] = {};
	for (const p of parts) {
		if (p.type === "text" && !out.text) out.text = p.text;
		if (p.type === "image" && !out.image) out.image = p.token;
		if (p.type === "audio" && !out.audio) out.audio = p.token;
	}
	return out;
}

function optionToApi(opt: PracticeOptionPart): PracticePickCard["options"][number] {
	if (opt.type === "text") return { id: opt.id, text: opt.text };
	if (opt.type === "image") return { id: opt.id, image: opt.token };
	return { id: opt.id, audio: opt.token };
}

export function dailyItemToPickCard(item: PracticeDailyItem): PracticePickCard {
	return {
		id: item.id,
		kind: "pick",
		subject: item.subjectId,
		prompt: partToPrompt(item.prompt),
		options: item.options.map(optionToApi),
		answer: item.correctOptionId,
		...(item.explain ? { explain: item.explain } : {}),
		...(item.tags?.length ? { tags: item.tags } : {}),
	};
}

/** Mixed stack: ~5 cards per subject run. */
export function mixedCardStack(
	bySubject: Map<string, PracticeDailyItem[]>,
	runSize = 5,
): PracticeDailyItem[] {
	const subjects = [...bySubject.keys()].sort();
	const out: PracticeDailyItem[] = [];
	for (const subjectId of subjects) {
		const items = bySubject.get(subjectId) ?? [];
		for (let i = 0; i < items.length; i += runSize) {
			out.push(...items.slice(i, i + runSize));
		}
	}
	return out;
}

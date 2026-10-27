import type { PracticeEntry, PracticeSubject } from "./contracts.ts";

export interface IdentityPromptPlan {
	prompt: string;
	explain: string;
	/** When set, distractors must not share this group (group-level identity question). */
	excludeGroup?: string;
}

function flagGroupLevel(entry: PracticeEntry): boolean {
	if (entry.identityScope === "entry") return false;
	if (entry.identityScope === "group") return true;
	return Boolean(entry.group && entry.groupLabel);
}

export function identityPromptFor(
	kind: string,
	subject: PracticeSubject,
	entry: PracticeEntry,
): IdentityPromptPlan {
	const explain = entry.explain?.trim() || entry.back.trim() || "";
	const excludeGroup = flagGroupLevel(entry) ? entry.group : undefined;

	if (kind === "image-pick") {
		if (subject.subjectId === "drums" && entry.tags?.includes("drum-key")) {
			return { prompt: `Which note is the ${entry.front}?`, explain, excludeGroup };
		}
		if (subject.subjectId === "flags" || entry.type === "visual") {
			const name = flagGroupLevel(entry) ? (entry.groupLabel ?? entry.front) : entry.front;
			const prompt = flagGroupLevel(entry)
				? `Which is the flag of ${name}?`
				: `Which is the ${entry.front}?`;
			return { prompt, explain: flagGroupLevel(entry) ? "" : explain, excludeGroup };
		}
		return { prompt: "Which country is this?", explain, excludeGroup };
	}

	if (kind === "label-pick") {
		if (subject.subjectId === "drums" && entry.tags?.includes("drum-key")) {
			return { prompt: "Which drum is this?", explain, excludeGroup };
		}
		if (subject.subjectId === "flags") {
			return { prompt: "Which flag is shown?", explain: "", excludeGroup };
		}
		return { prompt: "Which country is this?", explain, excludeGroup };
	}

	if (kind === "term-pick") {
		return {
			prompt: `What does "${entry.front}" mean?`,
			explain: entry.back.trim(),
			excludeGroup,
		};
	}

	if (kind === "meaning-pick") {
		return {
			prompt: `Which term means: ${entry.back}?`,
			explain: entry.front.trim(),
			excludeGroup,
		};
	}

	if (kind === "groove-id") {
		return { prompt: "Which groove is this?", explain, excludeGroup };
	}

	return { prompt: entry.front, explain, excludeGroup };
}

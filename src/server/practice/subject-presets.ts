import type { PracticeSubject } from "../../core/practice/contracts.ts";

/** Default subject configs merged when absent from disk (not persisted). */
export const PRACTICE_SUBJECT_PRESETS: PracticeSubject[] = [
	{
		subjectId: "latin",
		title: "Latin phrases",
		enabled: false,
		dailyCards: 10,
		itemKinds: ["term-pick", "meaning-pick"],
		sideLanguages: { front: "la", back: "en" },
		sources: [
			{
				kind: "wikipedia",
				id: "latin-wiki",
				label: "Wikipedia Latin phrases",
				pages: [
					"List of Latin phrases (A)",
					"List of Latin phrases (B)",
					"List of Latin phrases (C)",
					"List of Latin phrases (D)",
					"List of Latin phrases (E)",
					"List of Latin phrases (F)",
					"List of Latin phrases (G)",
					"List of Latin phrases (H)",
					"List of Latin phrases (I)",
					"List of Latin phrases (L)",
					"List of Latin phrases (M)",
					"List of Latin phrases (N)",
					"List of Latin phrases (O)",
					"List of Latin phrases (P)",
					"List of Latin phrases (Q)",
					"List of Latin phrases (R)",
					"List of Latin phrases (S)",
					"List of Latin phrases (T)",
					"List of Latin phrases (U)",
					"List of Latin phrases (V)",
				],
			},
		],
		requireReview: false,
	},
	{
		subjectId: "geography",
		title: "Geography",
		enabled: false,
		dailyCards: 10,
		itemKinds: ["image-pick", "label-pick"],
		mediaVariants: {
			enabled: ["outline", "locator"],
			weights: { outline: 1, locator: 1 },
			distractorBias: "tags",
		},
		sources: [{ kind: "builtin", id: "geo-ne", builtinId: "geography", label: "Natural Earth" }],
		requireReview: false,
	},
	{
		subjectId: "drums",
		title: "Drum grooves",
		enabled: false,
		dailyCards: 8,
		itemKinds: ["groove-id"],
		sources: [
			{ kind: "builtin", id: "grooves-lib", builtinId: "grooves", label: "Groove library" },
			{
				kind: "wikipedia",
				id: "drums-wiki",
				pages: ["Drum kit", "Percussion notation"],
			},
		],
		requireReview: false,
	},
	{
		subjectId: "js-ts",
		title: "JavaScript & TypeScript",
		enabled: false,
		dailyCards: 10,
		itemKinds: ["fact-pick", "term-pick"],
		sources: [
			{
				kind: "site",
				id: "mdn",
				label: "MDN",
				allowDomains: ["developer.mozilla.org"],
				seedUrls: ["https://developer.mozilla.org/en-US/docs/Web/JavaScript"],
			},
			{
				kind: "site",
				id: "w3schools",
				label: "W3Schools",
				allowDomains: ["w3schools.com"],
				seedUrls: ["https://www.w3schools.com/js/"],
			},
		],
		requireReview: false,
	},
	{
		subjectId: "flags",
		title: "Flags of the South Pacific",
		enabled: true,
		dailyCards: 10,
		itemKinds: ["image-pick", "label-pick"],
		mediaVariants: { enabled: ["flag"], weights: { flag: 1 }, distractorBias: "tags" },
		sources: [
			{
				kind: "wikipedia",
				id: "flags-wiki",
				label: "Wikipedia Oceania",
				pages: ["Oceania", "Flags of Oceania"],
			},
		],
		requireReview: false,
	},
];

export function mergeSubjectPresets(subjects: PracticeSubject[]): PracticeSubject[] {
	const map = new Map(subjects.map((s) => [s.subjectId, s]));
	for (const preset of PRACTICE_SUBJECT_PRESETS) {
		if (!map.has(preset.subjectId)) map.set(preset.subjectId, preset);
		else {
			const cur = map.get(preset.subjectId)!;
			map.set(preset.subjectId, {
				...preset,
				...cur,
				sources: cur.sources ?? preset.sources,
				mediaVariants: cur.mediaVariants ?? preset.mediaVariants,
				itemKinds: cur.itemKinds.length ? cur.itemKinds : preset.itemKinds,
			});
		}
	}
	return [...map.values()];
}

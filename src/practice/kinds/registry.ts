import type { ItemKindPlugin } from "./types.ts";
import { termPickKind } from "./term-pick.ts";
import { meaningPickKind } from "./meaning-pick.ts";
import { factPickKind } from "./fact-pick.ts";
import { grooveIdKind } from "./groove-id.ts";
import { imagePickKind } from "./image-pick.ts";
import { labelPickKind } from "./label-pick.ts";

export const PRACTICE_KINDS: ItemKindPlugin[] = [
	termPickKind,
	meaningPickKind,
	factPickKind,
	grooveIdKind,
	imagePickKind,
	labelPickKind,
];

export function kindFor(entry: { type: string; media?: unknown }, kindId: string): ItemKindPlugin | undefined {
	const plugin = PRACTICE_KINDS.find((k) => k.kind === kindId);
	if (!plugin) return undefined;
	return plugin.appliesTo(entry as import("../../core/practice/contracts.ts").PracticeEntry) ? plugin : undefined;
}

export function applicableKinds(entry: import("../../core/practice/contracts.ts").PracticeEntry): ItemKindPlugin[] {
	return PRACTICE_KINDS.filter((k) => k.appliesTo(entry));
}

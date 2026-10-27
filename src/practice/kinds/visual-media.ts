import type { PracticeEntry } from "../../core/practice/contracts.ts";
import { DEFAULT_MEDIA_VARIANT, listEntryMediaVariants, mediaTokenForVariant } from "../../core/practice/media-variants.ts";

export function visualEntryHasImage(entry: PracticeEntry): boolean {
	return listEntryMediaVariants(entry).some((v) => mediaTokenForVariant(entry, v) !== null);
}

export function imageTokenForEntry(entry: PracticeEntry, mediaVariant: string): string | null {
	return mediaTokenForVariant(entry, mediaVariant);
}

export { DEFAULT_MEDIA_VARIANT };

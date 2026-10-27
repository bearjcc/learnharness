import type { EntryField } from "./contracts.ts";

export const KIND_OPTION_FIELD: Record<string, EntryField> = {
	"term-pick": "back",
	"meaning-pick": "front",
	"fact-pick": "back",
	"label-pick": "front",
	"image-pick": "media",
	"groove-id": "front",
};

export function optionFieldForKind(kind: string): EntryField | undefined {
	return KIND_OPTION_FIELD[kind];
}

export function optionTextFieldForKind(kind: string): "front" | "back" | undefined {
	const f = KIND_OPTION_FIELD[kind];
	return f === "front" || f === "back" ? f : undefined;
}

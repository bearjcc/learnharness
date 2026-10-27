export const IDENTITY_ITEM_KINDS = new Set([
	"image-pick",
	"label-pick",
	"term-pick",
	"meaning-pick",
	"groove-id",
]);

export function isIdentityItemKind(kind: string): boolean {
	return IDENTITY_ITEM_KINDS.has(kind);
}

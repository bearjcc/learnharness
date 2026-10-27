export function schemaWithInventedDistractors(
	base: Record<string, unknown>,
	inventedCount: number,
): Record<string, unknown> {
	if (inventedCount <= 0) return base;
	const properties = {
		...(base.properties as Record<string, unknown>),
		inventedDistractors: {
			type: "array",
			items: { type: "string" },
			minItems: inventedCount,
			maxItems: inventedCount,
			description: "Plausible wrong answers; same language/register as the correct option.",
		},
	};
	const required = [...((base.required as string[]) ?? []), "inventedDistractors"];
	return { ...base, properties, required };
}

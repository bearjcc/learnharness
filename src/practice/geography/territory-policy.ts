/** Per-ISO_A3 rules for distant territories (mainland / largest-part focus). */
export interface TerritoryPolicy {
	/** Keep only the N largest polygons by area. */
	maxParts?: number;
	/** Drop polygons below this fraction of the largest part's area. */
	minAreaFraction?: number;
}

const MAINLAND_ONLY: TerritoryPolicy = { maxParts: 1, minAreaFraction: 0.02 };

export const TERRITORY_POLICY: Record<string, TerritoryPolicy> = {
	USA: MAINLAND_ONLY,
	FRA: MAINLAND_ONLY,
	NOR: MAINLAND_ONLY,
	NZL: MAINLAND_ONLY,
	GBR: { maxParts: 2, minAreaFraction: 0.02 },
	DNK: MAINLAND_ONLY,
	NLD: MAINLAND_ONLY,
	PRT: MAINLAND_ONLY,
	ESP: MAINLAND_ONLY,
};

export function policyForIso(isoA3: string): TerritoryPolicy {
	return TERRITORY_POLICY[isoA3] ?? { minAreaFraction: 0.02 };
}

import { readSourceTrust, writeSourceTrust } from "../../../store/practice-sources.ts";

const DEFAULT_TRUST = 1;
const MIN_TRUST = 0.05;
const FLAG_PENALTY = 0.15;

export function trustForSource(sourceId: string): number {
	const map = readSourceTrust();
	return map[sourceId] ?? DEFAULT_TRUST;
}

export function adjustTrust(sourceId: string, delta: number): number {
	const map = readSourceTrust();
	const next = Math.max(MIN_TRUST, Math.min(1, (map[sourceId] ?? DEFAULT_TRUST) + delta));
	map[sourceId] = next;
	writeSourceTrust(map);
	return next;
}

export function penalizeSource(sourceId: string): number {
	return adjustTrust(sourceId, -FLAG_PENALTY);
}

/** Weight sources by trust for retrieval ordering. */
export function trustWeight(sourceId: string): number {
	return trustForSource(sourceId);
}

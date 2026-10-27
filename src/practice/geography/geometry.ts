import { geoArea } from "d3-geo";
import type { Geometry, MultiPolygon, Polygon, Position } from "geojson";
import type { TerritoryPolicy } from "./territory-policy.ts";

type Ring = Position[];
type PolygonCoords = Ring[];
type MultiPolygonCoords = PolygonCoords[];

function ringArea(ring: Ring): number {
	let sum = 0;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const pi = ring[i];
		const pj = ring[j];
		if (!pi || !pj) continue;
		sum += ((pj[0] ?? 0) - (pi[0] ?? 0)) * ((pj[1] ?? 0) + (pi[1] ?? 0));
	}
	return Math.abs(sum);
}

function polygonArea(coords: PolygonCoords): number {
	if (!coords[0]) return 0;
	let a = Math.abs(ringArea(coords[0]));
	for (let i = 1; i < coords.length; i++) {
		const ring = coords[i];
		if (ring) a -= Math.abs(ringArea(ring));
	}
	return a;
}

function partsFromGeometry(geometry: Geometry): PolygonCoords[] {
	if (geometry.type === "Polygon") return [geometry.coordinates];
	if (geometry.type === "MultiPolygon") return geometry.coordinates;
	return [];
}

function geometryFromParts(parts: PolygonCoords[]): Geometry | null {
	if (!parts.length) return null;
	if (parts.length === 1) return { type: "Polygon", coordinates: parts[0]! };
	return { type: "MultiPolygon", coordinates: parts as MultiPolygonCoords };
}

export function filterCountryGeometry(geometry: Geometry, policy: TerritoryPolicy): Geometry | null {
	const parts = partsFromGeometry(geometry)
		.map((coords) => ({ coords, a: polygonArea(coords) }))
		.filter((p) => p.a > 0)
		.sort((a, b) => b.a - a.a);
	if (!parts.length) return null;
	const largest = parts[0]!.a;
	const minFrac = policy.minAreaFraction ?? 0.02;
	let kept = parts.filter((p) => p.a >= largest * minFrac);
	if (policy.maxParts !== undefined) kept = kept.slice(0, policy.maxParts);
	return geometryFromParts(kept.map((p) => p.coords));
}

export function sphericalArea(geometry: Geometry): number {
	return geoArea(geometry);
}

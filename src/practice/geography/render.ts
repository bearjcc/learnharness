import {
	geoAzimuthalEqualArea,
	geoBounds,
	geoCentroid,
	geoPath,
	type GeoGeometryObjects,
} from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { filterCountryGeometry, sphericalArea } from "./geometry.ts";
import { policyForIso } from "./territory-policy.ts";

export const GEO_TILE_PX = 160;
const PAD = 8;
const SEA = "#ffffff";
const TARGET_FILL = "#1a1a1a";
const NEIGHBOR_FILL = "#d4d4d4";

function preparedGeometry(geometry: Geometry, isoA3: string): Geometry | null {
	return filterCountryGeometry(geometry, policyForIso(isoA3));
}

function svgShell(paths: string[], sea = SEA): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${GEO_TILE_PX}" height="${GEO_TILE_PX}" viewBox="0 0 ${GEO_TILE_PX} ${GEO_TILE_PX}"><rect width="100%" height="100%" fill="${sea}"/>${paths.join("")}</svg>`;
}

export function renderCountryOutlineSvg(geometry: Geometry, isoA3: string): string {
	const geom = preparedGeometry(geometry, isoA3);
	if (!geom) return svgShell([]);
	const centroid = geoCentroid(geom);
	const projection = geoAzimuthalEqualArea().rotate([-centroid[0], -centroid[1]]);
	projection.fitExtent([[PAD, PAD], [GEO_TILE_PX - PAD, GEO_TILE_PX - PAD]], geom as GeoGeometryObjects);
	const path = geoPath(projection);
	const d = path(geom as GeoGeometryObjects);
	if (!d) return svgShell([]);
	return svgShell([`<path fill="${TARGET_FILL}" stroke="none" d="${d}"/>`]);
}

function expandedBounds(bounds: [[number, number], [number, number]], factor: number): [[number, number], [number, number]] {
	const [[x0, y0], [x1, y1]] = bounds;
	const cx = (x0 + x1) / 2;
	const cy = (y0 + y1) / 2;
	const w = (x1 - x0) * factor;
	const h = (y1 - y0) * factor;
	return [[cx - w / 2, cy - h / 2], [cx + w / 2, cy + h / 2]];
}

function boundsSpan(bounds: [[number, number], [number, number]]): number {
	return Math.max(bounds[1][0] - bounds[0][0], bounds[1][1] - bounds[0][1]);
}

/** Target country width as a fraction of the inner tile (15–30% per product spec). */
function targetWidthFraction(spanDeg: number): number {
	if (spanDeg < 2) return 0.17;
	if (spanDeg < 4) return 0.2;
	if (spanDeg > 40) return 0.15;
	if (spanDeg > 22) return 0.17;
	return 0.24;
}

function boundsOverlap(
	a: [[number, number], [number, number]],
	b: [[number, number], [number, number]],
): boolean {
	return a[0][0] <= b[1][0] && a[1][0] >= b[0][0] && a[0][1] <= b[1][1] && a[1][1] >= b[0][1];
}

function fitLocatorProjection(
	focus: Geometry,
	focusBounds: [[number, number], [number, number]],
	tilePx: number,
	pad: number,
): { projection: ReturnType<typeof geoAzimuthalEqualArea>; viewBounds: [[number, number], [number, number]] } {
	const centroid = geoCentroid(focus);
	const span = boundsSpan(focusBounds);
	const targetFrac = targetWidthFraction(span);
	const inner = tilePx - 2 * pad;
	const box = inner * targetFrac;
	const x0 = (tilePx - box) / 2;
	const y0 = (tilePx - box) / 2;
	const projection = geoAzimuthalEqualArea().rotate([-centroid[0], -centroid[1]]);
	projection.fitExtent([[x0, y0], [x0 + box, y0 + box]], focus as GeoGeometryObjects);
	const viewExpand = Math.min(10, Math.max(2.8, 0.9 / targetFrac));
	const viewBounds = expandedBounds(focusBounds, viewExpand);
	return { projection, viewBounds };
}

export function renderCountryLocatorSvg(
	target: Geometry,
	isoA3: string,
	world: FeatureCollection,
): string {
	const focus = preparedGeometry(target, isoA3);
	if (!focus) return svgShell([]);
	const focusBounds = geoBounds(focus);
	const { projection, viewBounds } = fitLocatorProjection(focus, focusBounds, GEO_TILE_PX, PAD);

	const neighbors = world.features.filter((f) => {
		if (!f.geometry) return false;
		const b = geoBounds(f.geometry);
		return boundsOverlap(viewBounds, b);
	});
	const path = geoPath(projection);
	const paths: string[] = [];
	for (const f of neighbors) {
		if (!f.geometry) continue;
		const isTarget = f.properties?.isoA3 === isoA3;
		if (isTarget) continue;
		const d = path(f as Feature);
		if (!d) continue;
		paths.push(`<path fill="${NEIGHBOR_FILL}" stroke="none" d="${d}"/>`);
	}
	const targetFeat = neighbors.find((f) => f.properties?.isoA3 === isoA3) ?? {
		type: "Feature" as const,
		properties: { isoA3 },
		geometry: focus,
	};
	const targetD = path(targetFeat as Feature);
	if (targetD) {
		paths.push(`<path fill="${TARGET_FILL}" stroke="none" d="${targetD}"/>`);
	}
	return svgShell(paths);
}

export function geographyTags(geometry: Geometry, isoA3: string): string[] {
	const geom = preparedGeometry(geometry, isoA3);
	if (!geom) return [`geo-iso:${isoA3}`];
	const a = sphericalArea(geom);
	const b = geoBounds(geom);
	const w = b[1][0] - b[0][0];
	const h = b[1][1] - b[0][1];
	const aspect = h > 0 ? w / h : 1;
	return [`geo-iso:${isoA3}`, `geo-area:${a.toFixed(6)}`, `geo-aspect:${aspect.toFixed(4)}`, "geography"];
}

export const NATURAL_EARTH_ATTRIBUTION = {
	license: "Public domain (Natural Earth)",
	sourceUrl: "https://www.naturalearthdata.com/",
};

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
const PAD = 10;
const FILL = "#1a1a1a";
const NEIGHBOR_FILL = "#c8c8c8";

function preparedGeometry(geometry: Geometry, isoA3: string): Geometry | null {
	return filterCountryGeometry(geometry, policyForIso(isoA3));
}

function svgShell(paths: string[]): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${GEO_TILE_PX}" height="${GEO_TILE_PX}" viewBox="0 0 ${GEO_TILE_PX} ${GEO_TILE_PX}">${paths.join("")}</svg>`;
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
	return svgShell([`<path fill="${FILL}" stroke="none" d="${d}"/>`]);
}

function expandedBounds(bounds: [[number, number], [number, number]], factor: number): [[number, number], [number, number]] {
	const [[x0, y0], [x1, y1]] = bounds;
	const cx = (x0 + x1) / 2;
	const cy = (y0 + y1) / 2;
	const w = (x1 - x0) * factor;
	const h = (y1 - y0) * factor;
	return [[cx - w / 2, cy - h / 2], [cx + w / 2, cy + h / 2]];
}

function boundsOverlap(
	a: [[number, number], [number, number]],
	b: [[number, number], [number, number]],
): boolean {
	return a[0][0] <= b[1][0] && a[1][0] >= b[0][0] && a[0][1] <= b[1][1] && a[1][1] >= b[0][1];
}

export function renderCountryLocatorSvg(
	target: Geometry,
	isoA3: string,
	world: FeatureCollection,
): string {
	const focus = preparedGeometry(target, isoA3);
	if (!focus) return svgShell([]);
	const focusBounds = geoBounds(focus);
	const viewBounds = expandedBounds(focusBounds, 2.8);
	const neighbors = world.features.filter((f) => {
		if (!f.geometry) return false;
		const b = geoBounds(f.geometry);
		return boundsOverlap(viewBounds, b);
	});
	const collection: FeatureCollection = {
		type: "FeatureCollection",
		features: neighbors,
	};
	const centroid = geoCentroid(focus);
	const projection = geoAzimuthalEqualArea().rotate([-centroid[0], -centroid[1]]);
	projection.fitExtent([[PAD, PAD], [GEO_TILE_PX - PAD, GEO_TILE_PX - PAD]], collection);
	const path = geoPath(projection);
	const paths: string[] = [];
	for (const f of neighbors) {
		if (!f.geometry) continue;
		const d = path(f as Feature);
		if (!d) continue;
		const isTarget = f.properties?.isoA3 === isoA3;
		paths.push(`<path fill="${isTarget ? FILL : NEIGHBOR_FILL}" stroke="none" d="${d}"/>`);
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

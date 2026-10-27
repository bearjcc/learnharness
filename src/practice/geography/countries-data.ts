import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import worldCountries from "world-countries";
import type { Topology } from "topojson-specification";
import countries10m from "world-atlas/countries-10m.json" with { type: "json" };
import countries50m from "world-atlas/countries-50m.json" with { type: "json" };

export interface CountryRecord {
	isoA3: string;
	nameEn: string;
	nameNative: string;
	geometry: Geometry;
}

const NAME_ALIASES: Record<string, string> = {
	"Czechia": "Czech Republic",
	"United States of America": "United States",
	"Dem. Rep. Congo": "Democratic Republic of the Congo",
	"Dominican Rep.": "Dominican Republic",
	"Central African Rep.": "Central African Republic",
	"Eq. Guinea": "Equatorial Guinea",
	"Bosnia and Herz.": "Bosnia and Herzegovina",
	"Solomon Is.": "Solomon Islands",
	"W. Sahara": "Western Sahara",
};

function featuresFrom(topo: Topology): Feature[] {
	const obj = topo.objects.countries;
	if (!obj) return [];
	const fc = feature(topo, obj) as unknown as FeatureCollection;
	return fc.features;
}

function nativeName(meta: (typeof worldCountries)[number]): string {
	const native = meta.name.native;
	const first = Object.values(native)[0];
	return first?.common ?? first?.official ?? meta.name.common;
}

function matchMeta(topoName: string): (typeof worldCountries)[number] | undefined {
	const name = NAME_ALIASES[topoName] ?? topoName;
	return worldCountries.find(
		(c) =>
			c.name.common === name ||
			c.name.official === name ||
			c.altSpellings?.includes(name) ||
			c.cca3 === name,
	);
}

function byIso(features: Feature[]): Map<string, Feature> {
	const map = new Map<string, Feature>();
	for (const f of features) {
		const topoName = String(f.properties?.name ?? "");
		const meta = matchMeta(topoName);
		if (!meta || !f.geometry) continue;
		const iso = meta.cca3;
		const enriched: Feature = {
			type: "Feature",
			properties: { ...f.properties, isoA3: iso, nameEn: meta.name.common },
			geometry: f.geometry,
		};
		map.set(iso, enriched);
	}
	return map;
}

let catalogCache: CountryRecord[] | null = null;
let worldCache: FeatureCollection | null = null;

export function loadWorldFeatureCollection(): FeatureCollection {
	if (worldCache) return worldCache;
	const f50 = byIso(featuresFrom(countries50m as unknown as Topology));
	const f10 = byIso(featuresFrom(countries10m as unknown as Topology));
	for (const [iso, feat] of f10) {
		if (!f50.has(iso)) f50.set(iso, feat);
	}
	worldCache = { type: "FeatureCollection", features: [...f50.values()] };
	return worldCache;
}

export function loadCountryCatalog(): CountryRecord[] {
	if (catalogCache) return catalogCache;
	const world = loadWorldFeatureCollection();
	catalogCache = worldCountries
		.filter((c) => c.status === "officially-assigned" && c.cca3 && c.cca3.length === 3)
		.map((meta) => {
			const feat = world.features.find((f) => f.properties?.isoA3 === meta.cca3);
			if (!feat?.geometry) return null;
			return {
				isoA3: meta.cca3,
				nameEn: meta.name.common,
				nameNative: nativeName(meta),
				geometry: feat.geometry,
			};
		})
		.filter((r): r is CountryRecord => r !== null)
		.sort((a, b) => a.nameEn.localeCompare(b.nameEn));
	return catalogCache;
}

export function countryByIso(isoA3: string): CountryRecord | undefined {
	return loadCountryCatalog().find((c) => c.isoA3 === isoA3);
}

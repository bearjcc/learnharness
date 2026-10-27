import { Resvg } from "@resvg/resvg-js";
import type { PracticeEntry } from "../../core/practice/contracts.ts";
import { practiceStore } from "../../store/practice.ts";
import { loadCountryCatalog, loadWorldFeatureCollection } from "./countries-data.ts";
import {
	GEO_TILE_PX,
	NATURAL_EARTH_ATTRIBUTION,
	geographyTags,
	renderCountryLocatorSvg,
	renderCountryOutlineSvg,
} from "./render.ts";

export interface ImportGeographyOptions {
	subjectId: string;
	/** Entry status for bulk import (default pending). */
	status?: PracticeEntry["status"];
}

function writeSvgAndPng(tokenBase: string, svg: string): { svgToken: string; pngToken: string } {
	const svgToken = `${tokenBase}.svg`;
	const pngToken = `${tokenBase}.png`;
	practiceStore.writeMedia(svgToken, Buffer.from(svg, "utf-8"));
	const resvg = new Resvg(svg, { fitTo: { mode: "width", value: GEO_TILE_PX * 2 } });
	practiceStore.writeMedia(pngToken, Buffer.from(resvg.render().asPng()));
	return { svgToken, pngToken };
}

export function importGeographyCountries(options: ImportGeographyOptions): {
	imported: number;
	skipped: number;
} {
	const { subjectId, status = "pending" } = options;
	const world = loadWorldFeatureCollection();
	const catalog = loadCountryCatalog();
	const entries = practiceStore.readEntries();
	const existing = new Set(entries.filter((e) => e.subjectId === subjectId).map((e) => e.entryId));
	let imported = 0;
	let skipped = 0;

	for (const country of catalog) {
		const entryId = `geo_${country.isoA3}`;
		if (existing.has(entryId)) {
			skipped++;
			continue;
		}
		const outlineSvg = renderCountryOutlineSvg(country.geometry, country.isoA3);
		const locatorSvg = renderCountryLocatorSvg(country.geometry, country.isoA3, world);
		const outline = writeSvgAndPng(`geo-${country.isoA3}-outline`, outlineSvg);
		const locator = writeSvgAndPng(`geo-${country.isoA3}-locator`, locatorSvg);
		const attr = NATURAL_EARTH_ATTRIBUTION;
		entries.push({
			subjectId,
			entryId,
			type: "visual",
			front: country.nameEn,
			back: country.nameNative,
			tags: geographyTags(country.geometry, country.isoA3),
			variants: {
				outline: { kind: "svg", ref: outline.svgToken, attribution: attr },
				locator: { kind: "svg", ref: locator.svgToken, attribution: attr },
			},
			origin: { kind: "import" },
			status,
		});
		imported++;
	}
	practiceStore.writeEntries(entries);
	return { imported, skipped };
}

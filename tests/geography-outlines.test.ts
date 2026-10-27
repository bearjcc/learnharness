import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { countryByIso, loadCountryCatalog } from "../src/practice/geography/countries-data.ts";
import { loadWorldFeatureCollection } from "../src/practice/geography/countries-data.ts";
import { GEO_TILE_PX, renderCountryLocatorSvg, renderCountryOutlineSvg } from "../src/practice/geography/render.ts";

const SAMPLE_ISO = ["UKR", "CHL", "ITA", "JPN", "IDN"] as const;

describe("geography outlines", () => {
	it("loads about 200 countries", () => {
		const catalog = loadCountryCatalog();
		assert.ok(catalog.length >= 190);
		assert.ok(catalog.length <= 250);
	});

	for (const iso of SAMPLE_ISO) {
		it(`renders ${iso} outline and locator SVG paths`, () => {
			const country = countryByIso(iso);
			assert.ok(country);
			const world = loadWorldFeatureCollection();
			const outline = renderCountryOutlineSvg(country!.geometry, iso);
			const locator = renderCountryLocatorSvg(country!.geometry, iso, world);
			assert.match(outline, /<path[^>]+d="[^"]+"/);
			assert.match(locator, /<path[^>]+d="[^"]+"/);
			assert.match(outline, /width="160"/);
			assert.match(locator, /fill="#ffffff"/);
		});
	}

	it("centres Ukraine locator with target ~15–30% of tile width", () => {
		const country = countryByIso("UKR");
		assert.ok(country);
		const world = loadWorldFeatureCollection();
		const locator = renderCountryLocatorSvg(country!.geometry, "UKR", world);
		assert.match(locator, /fill="#1a1a1a"/);
		const inner = GEO_TILE_PX - 16;
		const pathMatch = locator.match(/fill="#1a1a1a"[^>]+d="([^"]+)"/);
		assert.ok(pathMatch);
		const nums = pathMatch[1].match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
		const xs = nums.filter((_, i) => i % 2 === 0);
		const minX = Math.min(...xs);
		const maxX = Math.max(...xs);
		const width = maxX - minX;
		const frac = width / inner;
		assert.ok(frac >= 0.12 && frac <= 0.35, `Ukraine width fraction ${frac.toFixed(3)}`);
		const midX = (minX + maxX) / 2;
		assert.ok(Math.abs(midX - GEO_TILE_PX / 2) < GEO_TILE_PX * 0.15, `centre offset ${midX}`);
	});
});

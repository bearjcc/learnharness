import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { countryByIso, loadCountryCatalog } from "../src/practice/geography/countries-data.ts";
import { loadWorldFeatureCollection } from "../src/practice/geography/countries-data.ts";
import { renderCountryLocatorSvg, renderCountryOutlineSvg } from "../src/practice/geography/render.ts";

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
		});
	}
});

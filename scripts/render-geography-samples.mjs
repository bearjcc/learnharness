import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { countryByIso } from "../src/practice/geography/countries-data.ts";
import { loadWorldFeatureCollection } from "../src/practice/geography/countries-data.ts";
import { GEO_TILE_PX, renderCountryLocatorSvg, renderCountryOutlineSvg } from "../src/practice/geography/render.ts";

const root = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(root, "..", "docs", "samples", "geography");
const samples = ["UKR", "CHL", "ITA", "JPN", "IDN"];

fs.mkdirSync(outDir, { recursive: true });
const world = loadWorldFeatureCollection();

for (const iso of samples) {
	const country = countryByIso(iso);
	if (!country) throw new Error(`missing ${iso}`);
	for (const [style, svg] of [
		["outline", renderCountryOutlineSvg(country.geometry, iso)],
		["locator", renderCountryLocatorSvg(country.geometry, iso, world)],
	]) {
		const base = `${iso.toLowerCase()}-${style}`;
		fs.writeFileSync(path.join(outDir, `${base}.svg`), svg);
		const png = new Resvg(svg, { fitTo: { mode: "width", value: GEO_TILE_PX * 2 } }).render().asPng();
		fs.writeFileSync(path.join(outDir, `${base}.png`), png);
		console.log("wrote", base);
	}
}

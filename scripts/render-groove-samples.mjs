import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { renderGrooveAbcToSvg } from "../src/practice/groove-render.ts";

const root = path.dirname(fileURLToPath(import.meta.url));
const abcDir = path.join(root, "..", "samples", "grooves");
const outDir = path.join(root, "..", "docs", "samples", "grooves");
fs.mkdirSync(outDir, { recursive: true });

for (const file of fs.readdirSync(abcDir).filter((f) => f.endsWith(".abc"))) {
	const abc = fs.readFileSync(path.join(abcDir, file), "utf-8");
	const svg = renderGrooveAbcToSvg(abc, 160);
	const base = file.replace(/\.abc$/, "");
	fs.writeFileSync(path.join(outDir, `${base}.svg`), svg);
	const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 320 } });
	const png = resvg.render().asPng();
	fs.writeFileSync(path.join(outDir, `${base}.png`), png);
	console.log("wrote", base);
}

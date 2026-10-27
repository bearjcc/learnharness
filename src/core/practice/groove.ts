import type { GrooveGrid } from "./contracts.ts";

export function parseGrooveGrid(raw: string): GrooveGrid | null {
	try {
		const parsed = JSON.parse(raw) as GrooveGrid;
		if (
			typeof parsed.stepsPerBar !== "number" ||
			typeof parsed.bars !== "number" ||
			!parsed.instruments ||
			typeof parsed.instruments !== "object"
		) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

/** Simple grid SVG (no external notation libs). */
export function renderGrooveSvg(grid: GrooveGrid): string {
	const stepW = 14;
	const rowH = 18;
	const names = Object.keys(grid.instruments).sort();
	const width = grid.stepsPerBar * grid.bars * stepW + 80;
	const height = names.length * rowH + 24;
	const lines: string[] = [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
		`<rect width="100%" height="100%" fill="#111"/>`,
	];
	let y = 12;
	for (const name of names) {
		lines.push(`<text x="4" y="${y + 12}" fill="#ccc" font-size="10" font-family="monospace">${name}</text>`);
		const hits = grid.instruments[name] ?? [];
		for (let bar = 0; bar < grid.bars; bar++) {
			for (let step = 0; step < grid.stepsPerBar; step++) {
				const on = hits[bar]?.[step];
				const x = 72 + (bar * grid.stepsPerBar + step) * stepW;
				lines.push(
					`<rect x="${x}" y="${y}" width="${stepW - 2}" height="${rowH - 4}" rx="2" fill="${on ? "#4ade80" : "#333"}"/>`,
				);
			}
		}
		y += rowH;
	}
	lines.push("</svg>");
	return lines.join("");
}

import { JSDOM } from "jsdom";
import abcjs from "abcjs";

const DEFAULT_WIDTH_PX = 160;
const PAPER_ID = "lh-groove-paper";
const INK = "#111111";

let paperHost: HTMLElement | null = null;

function ensureAbcDom(): void {
	if (paperHost) return;
	const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="${PAPER_ID}"></div></body></html>`);
	globalThis.window = dom.window as unknown as Window & typeof globalThis.window;
	globalThis.document = dom.window.document;
	paperHost = document.getElementById(PAPER_ID);
}

/** Quiz renders: no titles or composer lines that give away groove names. */
export function stripQuizAbc(abc: string): string {
	return abc
		.split("\n")
		.filter((line) => !/^\s*T:/i.test(line) && !/^\s*C:/i.test(line))
		.join("\n");
}

function finalizeGrooveSvg(svgHtml: string, widthPx: number): string {
	ensureAbcDom();
	const NS = "http://www.w3.org/2000/svg";
	const container = document.createElement("div");
	container.innerHTML = svgHtml.trim();
	const source = container.querySelector("svg");
	if (!source) return svgHtml;

	source.querySelectorAll("title, .abcjs-title, [data-name*='segno']").forEach((node) => node.remove());
	source.querySelectorAll("[fill='currentColor']").forEach((node) => node.setAttribute("fill", INK));
	source.querySelectorAll("[stroke='currentColor']").forEach((node) => node.setAttribute("stroke", INK));
	source.setAttribute("fill", INK);
	source.setAttribute("stroke", INK);

	const origW = Number.parseFloat(source.getAttribute("width") ?? "0") || widthPx;
	const origH = Number.parseFloat(source.getAttribute("height") ?? "0") || widthPx * 0.5;
	const pad = Math.max(6, widthPx * 0.05);
	const targetW = widthPx;
	const targetH = Math.max(Math.round((origH / origW) * targetW), Math.round(widthPx * 0.35));
	const scale = Math.min((targetW - 2 * pad) / origW, (targetH - 2 * pad) / origH);
	const offsetX = (targetW - origW * scale) / 2;
	const offsetY = (targetH - origH * scale) / 2;

	const out = document.createElementNS(NS, "svg");
	out.setAttribute("xmlns", NS);
	out.setAttribute("width", String(targetW));
	out.setAttribute("height", String(targetH));
	out.setAttribute("viewBox", `0 0 ${targetW} ${targetH}`);
	const bg = document.createElementNS(NS, "rect");
	bg.setAttribute("width", "100%");
	bg.setAttribute("height", "100%");
	bg.setAttribute("fill", "#ffffff");
	out.appendChild(bg);
	const g = document.createElementNS(NS, "g");
	g.setAttribute("transform", `translate(${offsetX},${offsetY}) scale(${scale})`);
	while (source.firstChild) g.appendChild(source.firstChild);
	out.appendChild(g);
	return out.outerHTML;
}

/** Render ABC drum notation to SVG (headless; abcjs + jsdom). */
export function renderGrooveAbcToSvg(abc: string, widthPx = DEFAULT_WIDTH_PX): string {
	ensureAbcDom();
	const host = paperHost ?? document.getElementById(PAPER_ID);
	if (!host) throw new Error("groove render host missing");
	host.innerHTML = "";
	const quizAbc = stripQuizAbc(abc);
	const staffwidth = Math.max(200, Math.round(widthPx * 1.6));
	abcjs.renderAbc(PAPER_ID, quizAbc, {
		responsive: "resize",
		staffwidth,
		paddingtop: 10,
		paddingbottom: 12,
		paddingleft: 10,
		paddingright: 14,
		add_classes: true,
	});
	const svg = host.querySelector("svg");
	if (!svg) {
		return `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="72"><rect width="100%" height="100%" fill="#fff"/></svg>`;
	}
	return finalizeGrooveSvg(svg.outerHTML, widthPx);
}

/** @deprecated use renderGrooveAbcToSvg */
export function renderGrooveSvg(abc: string, widthPx?: number): string {
	return renderGrooveAbcToSvg(abc, widthPx);
}

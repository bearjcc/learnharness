import { JSDOM } from "jsdom";
import abcjs from "abcjs";

const DEFAULT_WIDTH_PX = 160;
const PAPER_ID = "lh-groove-paper";

let paperHost: HTMLElement | null = null;

function ensureAbcDom(): void {
	if (paperHost) return;
	const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="${PAPER_ID}"></div></body></html>`);
	globalThis.window = dom.window as unknown as Window & typeof globalThis.window;
	globalThis.document = dom.window.document;
	paperHost = document.getElementById(PAPER_ID);
}

function fitSvgWidth(svgHtml: string, widthPx: number): string {
	const match = svgHtml.match(/viewBox="([^"]+)"/);
	if (!match?.[1]) return svgHtml;
	const parts = match[1].split(/\s+/).map(Number);
	if (parts.length < 4 || !parts[2]) return svgHtml;
	const vbW = parts[2];
	const vbH = parts[3] ?? widthPx;
	const height = Math.round((widthPx / vbW) * vbH);
	let out = svgHtml.replace(/<svg([^>]*)>/, (full, attrs: string) => {
		const hasXmlns = /\bxmlns=/.test(attrs);
		const xmlns = hasXmlns ? "" : ' xmlns="http://www.w3.org/2000/svg"';
		return `<svg${attrs}${xmlns} width="${widthPx}" height="${height}">`;
	});
	return out;
}

/** Render ABC drum notation to SVG (headless; abcjs + jsdom). */
export function renderGrooveAbcToSvg(abc: string, widthPx = DEFAULT_WIDTH_PX): string {
	ensureAbcDom();
	const host = paperHost ?? document.getElementById(PAPER_ID);
	if (!host) throw new Error("groove render host missing");
	host.innerHTML = "";
	const staffwidth = Math.max(180, Math.round(widthPx * 1.35));
	abcjs.renderAbc(PAPER_ID, abc, {
		responsive: "resize",
		staffwidth,
		paddingtop: 0,
		paddingbottom: 0,
		paddingleft: 0,
		paddingright: 0,
		add_classes: true,
	});
	const svg = host.querySelector("svg");
	if (!svg) {
		return `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="48"/>`;
	}
	return fitSvgWidth(svg.outerHTML, widthPx);
}

/** @deprecated use renderGrooveAbcToSvg */
export function renderGrooveSvg(abc: string, widthPx?: number): string {
	return renderGrooveAbcToSvg(abc, widthPx);
}

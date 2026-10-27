export interface AbcMeterInfo {
	meter: { num: number; den: number };
	defaultLength: { num: number; den: number };
	unitsPerBar: number;
}

export function parseAbcMeter(abc: string): AbcMeterInfo {
	const meterMatch = abc.match(/^M:(\d+)\/(\d+)/m);
	const lengthMatch = abc.match(/^L:(\d+)\/(\d+)/m);
	if (!meterMatch || !lengthMatch) {
		throw new Error("ABC missing M: or L: header");
	}
	const meter = { num: Number(meterMatch[1]), den: Number(meterMatch[2]) };
	const defaultLength = { num: Number(lengthMatch[1]), den: Number(lengthMatch[2]) };
	const unitsPerBar = (meter.num / meter.den) / (defaultLength.num / defaultLength.den);
	if (!Number.isFinite(unitsPerBar) || unitsPerBar <= 0) {
		throw new Error("invalid meter/default length");
	}
	return { meter, defaultLength, unitsPerBar };
}

function readDurationSuffix(
	text: string,
	start: number,
	baseUnits: number,
): { advance: number; units: number } {
	let i = start;
	if (text[i] === "/") {
		const denom = Number(text[i + 1]);
		if (!Number.isFinite(denom) || denom <= 0) throw new Error(`bad duration at ${text}`);
		return { advance: i + 2, units: baseUnits / denom };
	}
	let numStr = "";
	while (i < text.length && /\d/.test(text[i]!)) {
		numStr += text[i];
		i++;
	}
	const mult = numStr ? Number(numStr) : 1;
	return { advance: i, units: baseUnits * mult };
}

/** Duration of one bar segment in default-length units (L:). */
export function durationUnitsInBar(bar: string, _info: AbcMeterInfo): number {
	const trimmed = bar.trim();
	if (!trimmed) return 0;
	let total = 0;
	let i = 0;
	while (i < trimmed.length) {
		const ch = trimmed[i]!;
		if (ch === " " || ch === "\t") {
			i++;
			continue;
		}
		if (ch === "[") {
			const end = trimmed.indexOf("]", i);
			if (end < 0) throw new Error(`unclosed chord in bar: ${bar}`);
			const { advance, units } = readDurationSuffix(trimmed, end + 1, 1);
			total += units;
			i = advance;
			continue;
		}
		if (ch === "z") {
			const { advance, units } = readDurationSuffix(trimmed, i + 1, 1);
			total += units;
			i = advance;
			continue;
		}
		if (/[A-Ga-g]/.test(ch)) {
			const { advance, units } = readDurationSuffix(trimmed, i + 1, 1);
			total += units;
			i = advance;
			continue;
		}
		throw new Error(`unexpected token '${ch}' in bar: ${bar}`);
	}
	return total;
}

function splitBars(music: string): string[] {
	return music
		.split("|")
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

const HEADER_PREFIXES = ["X:", "M:", "L:", "K:", "%%", "T:", "C:"];

export function voiceLines(abc: string): { voice: number; bars: string[] }[] {
	const lines = abc.split("\n");
	const out: { voice: number; bars: string[] }[] = [];
	let currentVoice: number | null = null;
	const parts: string[] = [];

	const flush = () => {
		if (currentVoice === null || !parts.length) return;
		out.push({ voice: currentVoice, bars: splitBars(parts.join(" ")) });
		parts.length = 0;
	};

	for (const raw of lines) {
		const line = raw.trim();
		if (!line) continue;
		if (HEADER_PREFIXES.some((p) => line.startsWith(p))) continue;
		const vm = line.match(/^V:(\d+)\s*(.*)$/);
		if (vm) {
			flush();
			currentVoice = Number(vm[1]);
			if (vm[2]?.trim()) parts.push(vm[2].trim());
			continue;
		}
		if (currentVoice !== null) parts.push(line);
	}
	flush();
	return out;
}

export function assertGrooveBarsFitMeter(abc: string): void {
	const info = parseAbcMeter(abc);
	const voices = voiceLines(abc);
	if (!voices.length) throw new Error("no voice lines");
	for (const { voice, bars } of voices) {
		for (let i = 0; i < bars.length; i++) {
			const units = durationUnitsInBar(bars[i]!, info);
			if (Math.abs(units - info.unitsPerBar) > 1e-6) {
				throw new Error(
					`voice ${voice} bar ${i + 1}: ${units} units, expected ${info.unitsPerBar}`,
				);
			}
		}
	}
}

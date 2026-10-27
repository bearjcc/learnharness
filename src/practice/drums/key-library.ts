import fs from "node:fs";
import path from "node:path";
import { ROOT } from "../../../config.ts";

export interface DrumKeyVoiceDef {
	id: string;
	name: string;
	aliases: string[];
	/** Unique distractor identity (one voice per group). */
	group: string;
	/** Lower = lower on staff; used for neighbour distractor bias. */
	staffPos: number;
	explain: string;
	notationNote?: string;
	citation: { url: string; quote: string };
	abcFile: string;
}

export const DRUM_KEY_LIBRARY_DIR = path.join(ROOT, "samples", "drum-key");

export const DRUM_KEY_VOICES: DrumKeyVoiceDef[] = [
	{
		id: "bass-drum",
		name: "Bass drum",
		aliases: ["kick", "kick drum"],
		group: "voice:bass-drum",
		staffPos: 1,
		explain: "Bass drum on the lower staff space (F).",
		citation: {
			url: "https://en.wikipedia.org/wiki/Percussion_notation",
			quote: "The bass drum is typically notated in the lowest space of the staff.",
		},
		abcFile: "bass-drum.abc",
	},
	{
		id: "snare",
		name: "Snare drum",
		aliases: ["snare drum", "SN"],
		group: "voice:snare",
		staffPos: 5,
		explain: "Snare drum on the third space (C5).",
		citation: {
			url: "https://en.wikipedia.org/wiki/Drum_kit",
			quote: "The snare drum is usually placed on the middle line of the percussion staff.",
		},
		abcFile: "snare.abc",
	},
	{
		id: "closed-hihat",
		name: "Closed hi-hat",
		aliases: ["hi-hat", "closed hat"],
		group: "voice:closed-hihat",
		staffPos: 9,
		explain: "Closed hi-hat with an x notehead above the staff.",
		notationNote: "Use ^g (not ^^g) so %%percmap matches abcjs pitchesToPerc; x on G5.",
		citation: {
			url: "https://en.wikipedia.org/wiki/Percussion_notation",
			quote: "Hi-hat cymbals are often notated with x-shaped noteheads.",
		},
		abcFile: "closed-hihat.abc",
	},
	{
		id: "open-hihat",
		name: "Open hi-hat",
		aliases: ["open hat"],
		group: "voice:open-hihat",
		staffPos: 9,
		explain: "Open hi-hat: x notehead with open accent.",
		notationNote: "Uses abcjs !open! decoration instead of a hand-drawn circle.",
		citation: {
			url: "https://en.wikipedia.org/wiki/Percussion_notation",
			quote: "An open hi-hat is indicated with an open circle or open accent mark.",
		},
		abcFile: "open-hihat.abc",
	},
	{
		id: "hihat-foot",
		name: "Hi-hat foot",
		aliases: ["foot hi-hat", "hi-hat pedal"],
		group: "voice:hihat-foot",
		staffPos: 2,
		explain: "Foot hi-hat below the staff (D).",
		citation: {
			url: "https://en.wikipedia.org/wiki/Drum_kit",
			quote: "Foot-operated hi-hat closure is notated below the staff.",
		},
		abcFile: "hihat-foot.abc",
	},
	{
		id: "crash",
		name: "Crash cymbal",
		aliases: ["crash"],
		group: "voice:crash",
		staffPos: 10,
		explain: "Crash cymbal on a high ledger line (A).",
		citation: {
			url: "https://en.wikipedia.org/wiki/Percussion_notation",
			quote: "Crash cymbals are notated with x noteheads, often on ledger lines above the staff.",
		},
		abcFile: "crash.abc",
	},
	{
		id: "ride",
		name: "Ride cymbal",
		aliases: ["ride"],
		group: "voice:ride",
		staffPos: 8,
		explain: "Ride cymbal on the top staff line (F).",
		citation: {
			url: "https://en.wikipedia.org/wiki/Drum_kit",
			quote: "The ride cymbal is commonly written on the top line of the staff.",
		},
		abcFile: "ride.abc",
	},
	{
		id: "ride-bell",
		name: "Ride bell",
		aliases: ["bell"],
		group: "voice:ride-bell",
		staffPos: 8,
		explain: "Ride bell with a diamond notehead on the ride line.",
		notationNote: "Diamond head on ^f; same line as ride, different head.",
		citation: {
			url: "https://en.wikipedia.org/wiki/Percussion_notation",
			quote: "The bell of the ride cymbal may be notated with a diamond-shaped notehead.",
		},
		abcFile: "ride-bell.abc",
	},
	{
		id: "high-tom",
		name: "High tom",
		aliases: ["high tom-tom"],
		group: "voice:high-tom",
		staffPos: 7,
		explain: "High tom on E space.",
		citation: {
			url: "https://en.wikipedia.org/wiki/Drum_kit",
			quote: "Tom-toms are assigned ascending staff positions for higher pitches.",
		},
		abcFile: "high-tom.abc",
	},
	{
		id: "mid-tom",
		name: "Mid tom",
		aliases: ["middle tom", "mid tom-tom"],
		group: "voice:mid-tom",
		staffPos: 6,
		explain: "Mid tom on D space.",
		citation: {
			url: "https://en.wikipedia.org/wiki/Drum_kit",
			quote: "Tom-toms are assigned ascending staff positions for higher pitches.",
		},
		abcFile: "mid-tom.abc",
	},
	{
		id: "floor-tom",
		name: "Floor tom",
		aliases: ["low tom", "floor tom-tom"],
		group: "voice:floor-tom",
		staffPos: 3,
		explain: "Floor tom on A space.",
		citation: {
			url: "https://en.wikipedia.org/wiki/Drum_kit",
			quote: "The floor tom is notated lower on the staff than rack toms.",
		},
		abcFile: "floor-tom.abc",
	},
	{
		id: "cross-stick",
		name: "Cross-stick",
		aliases: ["side stick", "rim click"],
		group: "voice:cross-stick",
		staffPos: 5,
		explain: "Cross-stick on the snare line with an x notehead.",
		notationNote:
			"abcjs has no circle-x percmap token; we use x on C5 (distinct from snare, rimshot, and ghost).",
		citation: {
			url: "https://en.wikipedia.org/wiki/Percussion_notation",
			quote: "Cross-stick strokes are often shown with a special x or circle-x notehead on the snare line.",
		},
		abcFile: "cross-stick.abc",
	},
	{
		id: "rimshot",
		name: "Rimshot",
		aliases: ["rim shot"],
		group: "voice:rimshot",
		staffPos: 5,
		explain: "Rimshot on the snare line with a slash (rhythm) notehead.",
		notationNote: "Uses %%percmap … rhythm (abcjs slash heads).",
		citation: {
			url: "https://en.wikipedia.org/wiki/Percussion_notation",
			quote: "A rimshot combines stick on head and rim; notation varies by publisher.",
		},
		abcFile: "rimshot.abc",
	},
	{
		id: "ghost-snare",
		name: "Ghost snare",
		aliases: ["ghost note", "ghost stroke"],
		group: "voice:ghost-snare",
		staffPos: 5,
		explain: "Ghost snare: soft snare hit in parentheses.",
		notationNote: "ABC parentheses; abcjs ghost styling.",
		citation: {
			url: "https://en.wikipedia.org/wiki/Percussion_notation",
			quote: "Ghost notes are written smaller or in parentheses on the snare line.",
		},
		abcFile: "ghost-snare.abc",
	},
];

const ABC_HEADER = `M:4/4
L:1/4
K:perc
`;

export function readDrumKeyAbc(def: DrumKeyVoiceDef): string {
	return fs.readFileSync(path.join(DRUM_KEY_LIBRARY_DIR, def.abcFile), "utf-8");
}

export function drumKeyByEntryId(entryId: string): DrumKeyVoiceDef | undefined {
	const prefix = "drumkey_";
	if (!entryId.startsWith(prefix)) return undefined;
	return DRUM_KEY_VOICES.find((v) => v.id === entryId.slice(prefix.length));
}

export function drumKeyMediaToken(voiceId: string): string {
	return `drumkey_${voiceId}.svg`;
}

export function builtinDrumKeyCorpusText(): string {
	return DRUM_KEY_VOICES.map((v) => {
		const note = v.notationNote ? ` (${v.notationNote})` : "";
		return `${v.name}: ${v.explain}${note} — ${v.citation.quote}`;
	}).join("\n");
}

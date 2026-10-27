import fs from "node:fs";
import path from "node:path";
import { ROOT } from "../../../config.ts";

export interface CuratedGrooveDef {
	id: string;
	name: string;
	aliases: string[];
	/** Distractor equivalence (aliases share the groove id group). */
	group: string;
	explain: string;
	citation: {
		url: string;
		quote: string;
	};
	abcFile: string;
}

export const GROOVE_LIBRARY_DIR = path.join(ROOT, "samples", "grooves");

export const CURATED_GROOVE_LIBRARY: CuratedGrooveDef[] = [
	{
		id: "rock-beat",
		name: "Basic rock",
		aliases: ["rock beat", "backbeat"],
		group: "groove:rock-beat",
		explain: "Eighth-note hi-hats with kick on 1 and 3 and snare on 2 and 4.",
		citation: {
			url: "https://en.wikipedia.org/wiki/Rock_drumming",
			quote: "A basic rock drum pattern places the snare drum on beats 2 and 4 and the bass drum on beats 1 and 3.",
		},
		abcFile: "rock-beat.abc",
	},
	{
		id: "four-on-the-floor",
		name: "Four on the floor",
		aliases: ["disco", "four-on-the-floor", "4 on the floor"],
		group: "groove:four-on-the-floor",
		explain: "Bass drum on every quarter-note beat with offbeat hi-hat openings.",
		citation: {
			url: "https://en.wikipedia.org/wiki/Four_on_the_floor",
			quote: "Four-on-the-floor is a rhythm pattern in which the bass drum is struck on every beat.",
		},
		abcFile: "four-on-the-floor.abc",
	},
	{
		id: "half-time",
		name: "Half-time",
		aliases: ["half time feel"],
		group: "groove:half-time",
		explain: "Snare on beat 3 only; halftime rock or pop feel.",
		citation: {
			url: "https://en.wikipedia.org/wiki/Half-time_(music)",
			quote: "In half-time, the backbeat snare often moves to beat 3.",
		},
		abcFile: "half-time.abc",
	},
	{
		id: "shuffle-triplet",
		name: "Triplet shuffle",
		aliases: ["12/8 shuffle", "blues shuffle"],
		group: "groove:shuffle-triplet",
		explain: "Triplet or 12/8 shuffle with a swung ride or hat pattern.",
		citation: {
			url: "https://en.wikipedia.org/wiki/Shuffle_rhythm",
			quote: "A shuffle divides each beat into a triplet feel, often notated in 12/8.",
		},
		abcFile: "shuffle-triplet.abc",
	},
	{
		id: "reggae-one-drop",
		name: "Reggae one drop",
		aliases: ["one drop"],
		group: "groove:reggae-one-drop",
		explain: "Kick and rim emphasis on beat 1; snare often omitted or on 3.",
		citation: {
			url: "https://en.wikipedia.org/wiki/One_drop_rhythm",
			quote: "The one drop rhythm emphasizes beat 1 with the bass drum and de-emphasizes beat 3 on the snare.",
		},
		abcFile: "reggae-one-drop.abc",
	},
	{
		id: "train-beat",
		name: "Train beat",
		aliases: ["train groove", "country train"],
		group: "groove:train-beat",
		explain: "Constant snare or percussion chatter evoking a train.",
		citation: {
			url: "https://en.wikipedia.org/wiki/Train_beat",
			quote: "The train beat is a drum pattern with a steady snare or percussion pattern resembling a train.",
		},
		abcFile: "train-beat.abc",
	},
	{
		id: "bo-diddley",
		name: "Bo Diddley beat",
		aliases: ["Bo Diddley rhythm", "shave and a haircut"],
		group: "groove:bo-diddley",
		explain: "3+3+2 accent pattern (iconic rock and roll ostinato).",
		citation: {
			url: "https://en.wikipedia.org/wiki/Bo_Diddley_beat",
			quote: "The Bo Diddley beat is a syncopated 3-3-2 rhythm pattern.",
		},
		abcFile: "bo-diddley.abc",
	},
	{
		id: "motown-backbeat",
		name: "Motown backbeat",
		aliases: ["Motown groove"],
		group: "groove:motown-backbeat",
		explain: "Snare hits on all four quarter notes (driving Motown feel).",
		citation: {
			url: "https://en.wikipedia.org/wiki/Backbeat",
			quote: "A backbeat places rhythmic emphasis on beats 2 and 4 in 4/4 time.",
		},
		abcFile: "motown-backbeat.abc",
	},
	{
		id: "funk-sixteenth",
		name: "Basic funk (16ths)",
		aliases: ["funk groove", "sixteenth funk"],
		group: "groove:funk-sixteenth",
		explain: "Sixteenth-note hi-hat chatter with syncopated kick and snare.",
		citation: {
			url: "https://en.wikipedia.org/wiki/Funk_drumming",
			quote: "Funk drumming often uses sixteenth-note hi-hat patterns with syncopated bass drum.",
		},
		abcFile: "funk-sixteenth.abc",
	},
	{
		id: "bossa-nova",
		name: "Bossa nova",
		aliases: ["bossa"],
		group: "groove:bossa-nova",
		explain: "Brazilian bossa with cross-stick and characteristic kick syncopation.",
		citation: {
			url: "https://en.wikipedia.org/wiki/Bossa_nova",
			quote: "Bossa nova drumming combines a syncopated bass drum with a cross-stick or rim pattern.",
		},
		abcFile: "bossa-nova.abc",
	},
	{
		id: "swing-ride",
		name: "Basic swing ride",
		aliases: ["jazz swing", "swing ride pattern"],
		group: "groove:swing-ride",
		explain: "Ride cymbal swing pattern with feathered kick and snare on 2 and 4.",
		citation: {
			url: "https://en.wikipedia.org/wiki/Swing_(jazz_performance_style)",
			quote: "Swing drumming uses a ride cymbal pattern with a swung subdivision.",
		},
		abcFile: "swing-ride.abc",
	},
	{
		id: "punk-skank",
		name: "Punk skank beat",
		aliases: ["punk beat", "skank beat"],
		group: "groove:punk-skank",
		explain: "Driving eighth-note feel with aggressive kick and snare backbeat.",
		citation: {
			url: "https://en.wikipedia.org/wiki/Punk_rock",
			quote: "Punk drumming favors fast, straightforward rock beats with heavy backbeat.",
		},
		abcFile: "punk-skank.abc",
	},
	{
		id: "waltz-3-4",
		name: "Waltz (3/4)",
		aliases: ["3/4 waltz", "waltz groove"],
		group: "groove:waltz-3-4",
		explain: "Three-quarter time with bass on 1 and snare on 2 or 3.",
		citation: {
			url: "https://en.wikipedia.org/wiki/Waltz",
			quote: "A waltz is in 3/4 time with a strong accent on beat 1.",
		},
		abcFile: "waltz-3-4.abc",
	},
	{
		id: "metal-gallop",
		name: "Metal gallop",
		aliases: ["double-kick gallop", "gallop rhythm"],
		group: "groove:metal-gallop",
		explain: "Double-kick gallop (two quick bass drums leading into a downbeat).",
		citation: {
			url: "https://en.wikipedia.org/wiki/Heavy_metal_drumming",
			quote: "Metal drumming uses rapid double bass drum patterns including galloping rhythms.",
		},
		abcFile: "metal-gallop.abc",
	},
	{
		id: "second-line",
		name: "Second line",
		aliases: ["New Orleans second line", "second line groove"],
		group: "groove:second-line",
		explain: "New Orleans second-line snare syncopation with street-parade feel.",
		citation: {
			url: "https://en.wikipedia.org/wiki/Second_line_(parades)",
			quote: "Second line parades feature a distinctive New Orleans snare drum rhythm.",
		},
		abcFile: "second-line.abc",
	},
];

export function readGrooveAbc(def: CuratedGrooveDef): string {
	return fs.readFileSync(path.join(GROOVE_LIBRARY_DIR, def.abcFile), "utf-8");
}

export function grooveLibraryByEntryId(entryId: string): CuratedGrooveDef | undefined {
	const prefix = "groove_";
	if (!entryId.startsWith(prefix)) return undefined;
	return CURATED_GROOVE_LIBRARY.find((g) => g.id === entryId.slice(prefix.length));
}

export function builtinGroovesCorpusText(): string {
	return CURATED_GROOVE_LIBRARY
		.map((g) => {
			const abc = readGrooveAbc(g);
			return `${g.name} (${g.aliases.join(", ")}): ${g.explain}\n${abc}`;
		})
		.join("\n\n");
}

export function grooveLibraryByLabel(label: string): CuratedGrooveDef | undefined {
	const norm = label.trim().toLowerCase();
	return CURATED_GROOVE_LIBRARY.find(
		(g) =>
			g.name.toLowerCase() === norm ||
			g.id === norm ||
			g.aliases.some((a) => a.toLowerCase() === norm),
	);
}

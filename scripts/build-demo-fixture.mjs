import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { renderGrooveAbcToSvg } from "../src/practice/groove-render.ts";
import { countryByIso, loadWorldFeatureCollection } from "../src/practice/geography/countries-data.ts";
import { renderCountryLocatorSvg, renderCountryOutlineSvg } from "../src/practice/geography/render.ts";

const root = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(root, "..", "fixtures", "practice", "demo");
const mediaDir = path.join(fixtureDir, "media");
fs.mkdirSync(mediaDir, { recursive: true });

const rockAbc = fs.readFileSync(path.join(root, "..", "samples", "grooves", "rock-beat.abc"), "utf-8");
const grooveSvg = renderGrooveAbcToSvg(rockAbc, 160);
fs.writeFileSync(path.join(mediaDir, "demo-groove-rock.svg"), grooveSvg);

const world = loadWorldFeatureCollection();
for (const [iso, name] of [
	["FIN", "fin"],
	["NOR", "nor"],
	["SWE", "swe"],
	["DNK", "dnk"],
	["UKR", "ukr"],
	["POL", "pol"],
	["DEU", "deu"],
	["FRA", "fra"],
]) {
	const c = countryByIso(iso);
	if (!c) throw new Error(iso);
	const outline = renderCountryOutlineSvg(c.geometry, iso);
	const locator = renderCountryLocatorSvg(c.geometry, iso, world);
	fs.writeFileSync(path.join(mediaDir, `demo-${name}-outline.svg`), outline);
	fs.writeFileSync(path.join(mediaDir, `demo-${name}-locator.svg`), locator);
}

const subject = {
	subjectId: "demo",
	title: "Try the quiz",
	enabled: true,
	dailyCards: 0,
	itemKinds: [],
	sandbox: true,
};

const deck = [
	{
		id: "demo_card_term",
		kind: "term-pick",
		subjectId: "demo",
		entryId: "demo_term_1",
		correctOptionId: "demo_term_1",
		optionIds: ["demo_term_1", "demo_term_2"],
		prompt: [{ type: "text", text: "What does “aloha” most often mean?" }],
		options: [
			{ id: "demo_term_1", type: "text", text: "Hello / goodbye (a greeting)" },
			{ id: "demo_term_2", type: "text", text: "Thank you" },
		],
		explain: "“Aloha” is a Hawaiian greeting that can mean hello, goodbye, or love.",
	},
	{
		id: "demo_card_meaning",
		kind: "meaning-pick",
		subjectId: "demo",
		entryId: "demo_mean_1",
		correctOptionId: "demo_mean_1",
		optionIds: ["demo_mean_1", "demo_mean_2", "demo_mean_3", "demo_mean_4"],
		prompt: [{ type: "text", text: "Pick the word that matches this meaning:" }, { type: "text", text: "A young dog" }],
		options: [
			{ id: "demo_mean_1", type: "text", text: "Puppy" },
			{ id: "demo_mean_2", type: "text", text: "Kitten" },
			{ id: "demo_mean_3", type: "text", text: "Calf" },
			{ id: "demo_mean_4", type: "text", text: "Foal" },
		],
	},
	{
		id: "demo_card_fact",
		kind: "fact-pick",
		subjectId: "demo",
		entryId: "demo_fact_1",
		correctOptionId: "demo_fact_1",
		optionIds: ["demo_fact_1", "demo_fact_2", "demo_fact_3", "demo_fact_4"],
		prompt: [{ type: "text", text: "Which planet is known for its prominent ring system?" }],
		options: [
			{ id: "demo_fact_1", type: "text", text: "Saturn" },
			{ id: "demo_fact_2", type: "text", text: "Mars" },
			{ id: "demo_fact_3", type: "text", text: "Venus" },
			{ id: "demo_fact_4", type: "text", text: "Mercury" },
		],
		explain: "Saturn’s rings are made mostly of ice and rock particles.",
	},
	{
		id: "demo_card_groove",
		kind: "groove-id",
		subjectId: "demo",
		entryId: "demo_groove_1",
		correctOptionId: "demo_groove_1",
		optionIds: ["demo_groove_1", "demo_groove_2", "demo_groove_3", "demo_groove_4"],
		prompt: [
			{ type: "image", token: "demo-groove-rock.svg" },
			{ type: "text", text: "Name this drum pattern." },
		],
		options: [
			{ id: "demo_groove_1", type: "text", text: "Rock beat" },
			{ id: "demo_groove_2", type: "text", text: "Shuffle" },
			{ id: "demo_groove_3", type: "text", text: "Half-time" },
			{ id: "demo_groove_4", type: "text", text: "Four on the floor" },
		],
		explain: "A classic rock groove: hi-hat on 8ths, snare on 2 and 4, kick on 1 and 3.",
	},
	{
		id: "demo_card_image_outline",
		kind: "image-pick",
		subjectId: "demo",
		entryId: "demo_geo_fin",
		correctOptionId: "demo_geo_fin",
		optionIds: ["demo_geo_fin", "demo_geo_nor", "demo_geo_swe", "demo_geo_dnk"],
		mediaVariant: "outline",
		prompt: [{ type: "text", text: "Which country is this outline?" }],
		options: [
			{ id: "demo_geo_fin", type: "image", token: "demo-fin-outline.svg" },
			{ id: "demo_geo_nor", type: "image", token: "demo-nor-outline.svg" },
			{ id: "demo_geo_swe", type: "image", token: "demo-swe-outline.svg" },
			{ id: "demo_geo_dnk", type: "image", token: "demo-dnk-outline.svg" },
		],
	},
	{
		id: "demo_card_image_locator",
		kind: "image-pick",
		subjectId: "demo",
		entryId: "demo_geo_ukr",
		correctOptionId: "demo_geo_ukr",
		optionIds: ["demo_geo_ukr", "demo_geo_pol", "demo_geo_deu", "demo_geo_fra"],
		mediaVariant: "locator",
		prompt: [{ type: "text", text: "Which highlighted country is this?" }],
		options: [
			{ id: "demo_geo_ukr", type: "image", token: "demo-ukr-locator.svg" },
			{ id: "demo_geo_pol", type: "image", token: "demo-pol-locator.svg" },
			{ id: "demo_geo_deu", type: "image", token: "demo-deu-locator.svg" },
			{ id: "demo_geo_fra", type: "image", token: "demo-fra-locator.svg" },
		],
	},
	{
		id: "demo_card_label",
		kind: "label-pick",
		subjectId: "demo",
		entryId: "demo_label_1",
		correctOptionId: "demo_label_1",
		optionIds: ["demo_label_1", "demo_label_2", "demo_label_3", "demo_label_4"],
		mediaVariant: "outline",
		prompt: [{ type: "image", token: "demo-fin-outline.svg" }],
		options: [
			{ id: "demo_label_1", type: "text", text: "Finland" },
			{ id: "demo_label_2", type: "text", text: "Norway" },
			{ id: "demo_label_3", type: "text", text: "Sweden" },
			{ id: "demo_label_4", type: "text", text: "Denmark" },
		],
		explain: "The outline is Finland — lots of lakes and a long eastern border.",
	},
	{
		id: "demo_card_six",
		kind: "fact-pick",
		subjectId: "demo",
		entryId: "demo_six_1",
		correctOptionId: "demo_six_1",
		optionIds: ["demo_six_1", "demo_six_2", "demo_six_3", "demo_six_4", "demo_six_5", "demo_six_6"],
		prompt: [{ type: "text", text: "How many sides does a hexagon have?" }],
		options: [
			{ id: "demo_six_1", type: "text", text: "6" },
			{ id: "demo_six_2", type: "text", text: "5" },
			{ id: "demo_six_3", type: "text", text: "7" },
			{ id: "demo_six_4", type: "text", text: "8" },
			{ id: "demo_six_5", type: "text", text: "4" },
			{ id: "demo_six_6", type: "text", text: "10" },
		],
	},
];

fs.writeFileSync(path.join(fixtureDir, "subject.json"), JSON.stringify(subject, null, "\t") + "\n");
fs.writeFileSync(path.join(fixtureDir, "deck.json"), JSON.stringify(deck, null, "\t") + "\n");
console.log("demo fixture written", deck.length, "cards");

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { tableRowPassagesFromHtml } from "../src/server/practice/sources/wikipedia-parse.ts";

const FIXTURE = `
<table class="wikitable">
<tr><th>Latin</th><th>Translation</th><th>Notes</th></tr>
<tr><td>ad hoc</td><td>for this</td><td>Improvised.</td></tr>
<tr><td>de facto</td><td>in fact</td><td>Common law.</td></tr>
</table>`;

describe("Wikipedia parse table rows", () => {
	it("emits one passage per table row with pipe-separated columns", () => {
		const rows = tableRowPassagesFromHtml(FIXTURE, "latin-wiki", "https://example/wiki", "List (A)");
		assert.equal(rows.length, 2);
		assert.match(rows[0]!.text, /ad hoc \| for this/);
		assert.ok(rows.some((r) => r.text.includes("de facto")));
	});
});

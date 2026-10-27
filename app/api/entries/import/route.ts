import type { PracticeImportEntry } from "@/src/core";
import { importEntries } from "@/src/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
	const body = await request.json().catch(() => null);
	const rows = Array.isArray(body) ? body : (body as { entries?: PracticeImportEntry[] })?.entries;
	if (!Array.isArray(rows)) {
		return Response.json({ error: "expected array of entries" }, { status: 400 });
	}
	const result = await importEntries(rows);
	return Response.json(result);
}

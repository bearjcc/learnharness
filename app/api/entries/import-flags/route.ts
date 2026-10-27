import { importPacificFlags } from "@/src/practice/flags/import-pacific";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
	const body = (await request.json().catch(() => ({}))) as { subjectId?: string };
	const subjectId = body.subjectId?.trim() || "flags";
	const result = await importPacificFlags({ subjectId });
	return Response.json(result);
}

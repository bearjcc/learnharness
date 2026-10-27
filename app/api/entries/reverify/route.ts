import { reverifySubjectEntries } from "@/src/server/practice/reverify-entries";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
	const body = (await request.json().catch(() => null)) as { subjectId?: string } | null;
	const subjectId = body?.subjectId?.trim();
	if (!subjectId) {
		return Response.json({ error: "subjectId required" }, { status: 400 });
	}
	try {
		const result = await reverifySubjectEntries(subjectId);
		return Response.json(result);
	} catch (err) {
		const message = err instanceof Error ? err.message : "reverify failed";
		return Response.json({ error: message }, { status: 404 });
	}
}

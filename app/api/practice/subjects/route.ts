import { readSubjects, upsertSubject } from "@/src/server";
import type { PracticeSubject } from "@/src/core";

export const dynamic = "force-dynamic";

export async function GET() {
	return Response.json({ subjects: readSubjects() });
}

export async function PUT(request: Request) {
	const body = (await request.json().catch(() => null)) as PracticeSubject | null;
	if (!body?.subjectId || !body.title) {
		return Response.json({ error: "subjectId and title required" }, { status: 400 });
	}
	upsertSubject({
		subjectId: body.subjectId,
		title: body.title,
		enabled: body.enabled ?? true,
		dailyCards: body.dailyCards ?? 10,
		itemKinds: Array.isArray(body.itemKinds) ? body.itemKinds : [],
		...(body.mediaVariants ? { mediaVariants: body.mediaVariants } : {}),
	});
	return Response.json({ subjects: readSubjects() });
}

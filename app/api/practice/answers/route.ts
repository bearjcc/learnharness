import type { PracticeAnswerEvent } from "@/src/core";
import { recordAnswer } from "@/src/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
	const body = (await request.json().catch(() => null)) as PracticeAnswerEvent | null;
	if (!body?.event_id || !body.card_id || !body.subject) {
		return Response.json({ error: "event_id, card_id, and subject required" }, { status: 400 });
	}
	const result = recordAnswer(body);
	if (!result.ok) return Response.json({ error: result.error ?? "failed" }, { status: 400 });
	return Response.json({ ok: true });
}

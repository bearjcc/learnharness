import { decideEntry } from "@/src/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
	const { id } = await ctx.params;
	const body = (await request.json().catch(() => null)) as { event_id?: string; value?: string } | null;
	if (!body?.event_id || (body.value !== "keep" && body.value !== "reject")) {
		return Response.json({ error: "event_id and value keep|reject required" }, { status: 400 });
	}
	const result = decideEntry(body.event_id, id, body.value);
	if (!result.ok) return Response.json({ error: "entry not found" }, { status: 404 });
	return Response.json({ ok: true });
}

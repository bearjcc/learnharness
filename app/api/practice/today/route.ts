import { listTodayCards } from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	const subject = new URL(request.url).searchParams.get("subject") ?? undefined;
	return Response.json({ cards: listTodayCards(subject || undefined) }, { headers: { "Cache-Control": "no-store" } });
}

import { mediaResponse } from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ token: string }> }) {
	const { token } = await ctx.params;
	const media = mediaResponse(decodeURIComponent(token));
	if (!media) return new Response("Not found", { status: 404 });
	return new Response(new Uint8Array(media.bytes), {
		headers: { "Content-Type": media.contentType, "Cache-Control": "private, max-age=3600" },
	});
}

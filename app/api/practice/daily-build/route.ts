import { runDailyBuildAll } from "@/src/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
	const body = await request.json().catch(() => ({}));
	const modelId = typeof (body as { modelId?: string }).modelId === "string" ? (body as { modelId: string }).modelId : undefined;
	const results = await runDailyBuildAll(modelId);
	return Response.json({ results });
}

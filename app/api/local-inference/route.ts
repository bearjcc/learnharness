import {
	localInferenceStatus,
	refreshLocalInferenceCatalog,
	writeLocalInferenceSettings,
} from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET() {
	return Response.json(localInferenceStatus(), { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
	const body = await request.json().catch(() => null);
	const result = writeLocalInferenceSettings(body);
	if (!result.ok) {
		return Response.json({ error: result.error }, { status: 400 });
	}
	return Response.json(result.status);
}

export async function POST() {
	await refreshLocalInferenceCatalog();
	return Response.json(localInferenceStatus(), { headers: { "Cache-Control": "no-store" } });
}

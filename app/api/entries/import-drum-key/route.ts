import { importDrumKey } from "@/src/practice/drums/import-drum-key";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
	const body = (await request.json().catch(() => null)) as {
		subjectId?: string;
		replace?: boolean;
	} | null;
	const subjectId = body?.subjectId?.trim() || "drums";
	const result = importDrumKey({ subjectId, replace: body?.replace ?? true });
	return Response.json(result);
}

import { importGrooveLibrary } from "@/src/practice/grooves/import-library";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
	const body = (await request.json().catch(() => null)) as {
		subjectId?: string;
		replace?: boolean;
	} | null;
	const subjectId = body?.subjectId?.trim() || "drums";
	const result = importGrooveLibrary({ subjectId, replace: body?.replace ?? true });
	return Response.json(result);
}

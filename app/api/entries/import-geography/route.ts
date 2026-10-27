import { importGeographyCountries } from "@/src/practice/geography/import-countries";

export async function POST(request: Request): Promise<Response> {
	const body = (await request.json().catch(() => null)) as { subjectId?: string } | null;
	const subjectId = body?.subjectId?.trim() || "geography";
	const result = importGeographyCountries({ subjectId });
	return Response.json(result);
}

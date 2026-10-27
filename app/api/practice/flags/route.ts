import { readFlagEvents, readSourceTrust } from "@/src/store/practice-sources";

export const dynamic = "force-dynamic";

export async function GET() {
	return Response.json({
		flags: readFlagEvents(),
		trust: readSourceTrust(),
	});
}

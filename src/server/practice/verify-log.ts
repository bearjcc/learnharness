import { appendSourcedBuildLog } from "../../store/practice-sources.ts";

export function logVerifyEvent(
	subjectId: string,
	entryId: string,
	reason: string,
	extra?: Record<string, unknown>,
): void {
	appendSourcedBuildLog({
		at: new Date().toISOString(),
		subjectId,
		entryId,
		reason,
		phase: "verify",
		...extra,
	});
}

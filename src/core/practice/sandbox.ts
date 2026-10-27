import type { PracticeSubject } from "./contracts.ts";

export function isSandboxSubject(subject: PracticeSubject | undefined): boolean {
	return subject?.sandbox === true;
}

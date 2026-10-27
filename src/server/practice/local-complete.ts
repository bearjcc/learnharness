export class LocalInferenceHttpError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
		this.name = "LocalInferenceHttpError";
	}
}

export { completeLocalJson, completeLocalJsonDetailed } from "./local-json.ts";
export type { LocalJsonCompletion } from "./local-json.ts";

/**
 * Server-side local inference config: settings + env precedence, status DTO,
 * and the config reader registered for the agent provider.
 */

import {
	LOCAL_INFERENCE_API_KEY_ENV,
	LOCAL_INFERENCE_BASE_URL_ENV,
	LOCAL_INFERENCE_PROVIDER_ID,
	type LocalInferenceStatus,
	resolveLocalInferenceRuntimeConfig,
	sanitizeLocalInferenceSettings,
} from "../core/local-inference.ts";
import {
	localInferenceDiscoveredModelCount,
	localInferenceLastRefreshError,
	registerLocalInferenceConfigReader,
	refreshLocalInferenceModels,
} from "../agent/local-inference.ts";
import { authStore } from "../store/auth.ts";
import { readSettings, writeSettings } from "../store/settings.ts";
import { piModels } from "../agent/models.ts";
function envKeysIgnored(): boolean {
	return process.env.LH_IGNORE_ENV_KEYS === "1";
}

function localInferenceApiKeyPresent(): boolean {
	if (envKeysIgnored()) return authStore.authVars()[LOCAL_INFERENCE_API_KEY_ENV] !== undefined;
	return (
		process.env[LOCAL_INFERENCE_API_KEY_ENV] !== undefined ||
		authStore.authVars()[LOCAL_INFERENCE_API_KEY_ENV] !== undefined
	);
}

function settingsSection() {
	return sanitizeLocalInferenceSettings(readSettings()?.localInference);
}

export function effectiveLocalInferenceConfig() {
	const envBase =
		!envKeysIgnored() && process.env[LOCAL_INFERENCE_BASE_URL_ENV] !== undefined
			? process.env[LOCAL_INFERENCE_BASE_URL_ENV]
			: undefined;
	return resolveLocalInferenceRuntimeConfig(envBase, settingsSection());
}

export function installLocalInferenceReader(): void {
	registerLocalInferenceConfigReader(() => effectiveLocalInferenceConfig());
}

installLocalInferenceReader();

export function localInferenceStatus(): LocalInferenceStatus {
	const envBase =
		!envKeysIgnored() && process.env[LOCAL_INFERENCE_BASE_URL_ENV] !== undefined
			? process.env[LOCAL_INFERENCE_BASE_URL_ENV]
			: undefined;
	const settings = settingsSection();
	const effective = effectiveLocalInferenceConfig();
	const configured = effective !== null;
	return {
		providerId: LOCAL_INFERENCE_PROVIDER_ID,
		configured,
		baseUrl: effective?.baseUrl ?? null,
		baseUrlSource: envBase ? "env" : settings.baseUrl ? "settings" : "none",
		apiKeyPresent: localInferenceApiKeyPresent(),
		manualModels: settings.manualModels ?? [],
		lastRefreshError: localInferenceLastRefreshError(),
		discoveredModelCount: localInferenceDiscoveredModelCount(),
	};
}

export type LocalInferenceWriteResult =
	| { ok: true; status: LocalInferenceStatus }
	| { ok: false; error: string };

export function writeLocalInferenceSettings(body: unknown): LocalInferenceWriteResult {
	if (!body || typeof body !== "object" || Array.isArray(body)) {
		return { ok: false, error: "Body must be a JSON object" };
	}
	const raw = body as Record<string, unknown>;
	const patch = sanitizeLocalInferenceSettings(raw);
	const record = readSettings() ?? { version: 1 };
	const previous = sanitizeLocalInferenceSettings(record.localInference);
	let localInference = { ...previous, ...patch };
	if (raw.baseUrl === "" || raw.baseUrl === null) {
		delete localInference.baseUrl;
	}
	if (Array.isArray(raw.manualModels)) {
		localInference.manualModels = patch.manualModels ?? [];
	}
	if (!localInference.baseUrl && !(localInference.manualModels?.length)) {
		const nextRecord = { ...record };
		delete nextRecord.localInference;
		writeSettings(nextRecord);
		installLocalInferenceReader();
		ensureAndRefresh();
		return { ok: true, status: localInferenceStatus() };
	}
	const next = { ...record, localInference };
	writeSettings(next);
	installLocalInferenceReader();
	ensureAndRefresh();
	return { ok: true, status: localInferenceStatus() };
}

function ensureAndRefresh(): void {
	void refreshLocalInferenceModels(piModels());
}

export async function refreshLocalInferenceCatalog(): Promise<void> {
	installLocalInferenceReader();
	await refreshLocalInferenceModels(piModels());
}

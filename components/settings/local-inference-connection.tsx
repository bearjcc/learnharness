"use client";

import { useCallback, useEffect, useState } from "react";
import {
	LOCAL_INFERENCE_API_KEY_ENV,
	LOCAL_INFERENCE_LABEL,
	type LocalInferenceManualModel,
	type LocalInferenceStatus,
} from "@/src/core";
import { notifySettingsSaved } from "@/components/settings-signal";

export function LocalInferenceConnection() {
	const [status, setStatus] = useState<LocalInferenceStatus | null>(null);
	const [baseUrl, setBaseUrl] = useState("");
	const [manualId, setManualId] = useState("");
	const [apiKey, setApiKey] = useState("");
	const [expanded, setExpanded] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	const reload = useCallback(async () => {
		const res = await fetch("/api/local-inference").catch(() => null);
		if (!res?.ok) return;
		const json = (await res.json()) as LocalInferenceStatus;
		setStatus(json);
		setBaseUrl(json.baseUrl ?? "");
	}, []);

	useEffect(() => {
		void reload();
	}, [reload]);

	async function saveBaseUrl() {
		setBusy(true);
		setError(null);
		const res = await fetch("/api/local-inference", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ baseUrl }),
		});
		setBusy(false);
		if (!res.ok) {
			const body = (await res.json().catch(() => ({}))) as { error?: string };
			setError(body.error ?? "Could not save");
			return;
		}
		await reload();
		await fetch("/api/local-inference", { method: "POST" }).catch(() => undefined);
		notifySettingsSaved("keys");
	}

	async function clearBaseUrl() {
		setBusy(true);
		await fetch("/api/local-inference", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ baseUrl: null, manualModels: [] }),
		});
		setBusy(false);
		setBaseUrl("");
		await reload();
		notifySettingsSaved("keys");
	}

	async function addManualModel() {
		const id = manualId.trim();
		if (!id || !status) return;
		const manualModels: LocalInferenceManualModel[] = [...status.manualModels, { id }];
		setBusy(true);
		const res = await fetch("/api/local-inference", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ baseUrl: status.baseUrl ?? baseUrl, manualModels }),
		});
		setBusy(false);
		if (!res.ok) return;
		setManualId("");
		await reload();
		await fetch("/api/local-inference", { method: "POST" }).catch(() => undefined);
		notifySettingsSaved("keys");
	}

	async function saveApiKey() {
		if (!apiKey.trim()) return;
		setBusy(true);
		const res = await fetch(`/api/keys/${LOCAL_INFERENCE_API_KEY_ENV}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ value: apiKey.trim() }),
		});
		setBusy(false);
		if (!res.ok) {
			setError("API key could not be saved");
			return;
		}
		setApiKey("");
		notifySettingsSaved("keys");
	}

	const line = status?.configured
		? `${status.baseUrl ?? ""}${status.baseUrlSource === "env" ? " · env" : ""}`
		: "not configured";

	return (
		<div className="px-1 py-1.5" data-testid="local-inference-connection">
			<button
				type="button"
				className="flex w-full items-center justify-between gap-3 text-left"
				onClick={() => setExpanded(!expanded)}
			>
				<span className="font-ui text-xs text-foreground">{LOCAL_INFERENCE_LABEL}</span>
				<span className="truncate font-mono text-[11px] text-muted-foreground">{line}</span>
			</button>
			{expanded && (
				<div className="mt-2 space-y-2 border-t border-border/60 pt-2">
					<p className="text-xs leading-relaxed text-muted-foreground">
						OpenAI-compatible endpoint (Ollama, vLLM, etc.). Models are discovered from{" "}
						<code className="text-[11px]">/v1/models</code> or Ollama{" "}
						<code className="text-[11px]">/api/tags</code>. Usage is billed at $0 in the cost meter.
					</p>
					{status?.baseUrlSource === "env" && (
						<p className="text-xs text-muted-foreground">
							Base URL is set by <code className="text-[11px]">LH_OLLAMA_BASE_URL</code> in the environment.
						</p>
					)}
					<label className="block text-xs text-foreground">
						Base URL
						<input
							type="text"
							value={baseUrl}
							disabled={busy || status?.baseUrlSource === "env"}
							onChange={(e) => setBaseUrl(e.target.value)}
							placeholder="http://127.0.0.1:11434"
							data-testid="local-inference-base-url"
							className="mt-1 h-7 w-full rounded-sm border border-border bg-background px-1.5 font-mono text-xs outline-none focus:border-muted-foreground/50 disabled:opacity-50"
						/>
					</label>
					<div className="flex flex-wrap gap-2">
						<button
							type="button"
							disabled={busy || status?.baseUrlSource === "env" || !baseUrl.trim()}
							onClick={() => void saveBaseUrl()}
							className="text-xs text-foreground underline-offset-2 hover:underline disabled:text-muted-foreground/40"
							data-testid="local-inference-save"
						>
							Save
						</button>
						{status?.configured && status.baseUrlSource !== "env" && (
							<button
								type="button"
								disabled={busy}
								onClick={() => void clearBaseUrl()}
								className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
								data-testid="local-inference-clear"
							>
								Remove
							</button>
						)}
						<button
							type="button"
							disabled={busy || !status?.configured}
							onClick={() => void fetch("/api/local-inference", { method: "POST" }).then(() => reload())}
							className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
							data-testid="local-inference-refresh"
						>
							Refresh models
						</button>
					</div>
					{status?.configured && (
						<p className="text-[11px] text-muted-foreground" data-testid="local-inference-discovery">
							{status.discoveredModelCount} discovered
							{status.manualModels.length ? `, ${status.manualModels.length} manual` : ""}
							{status.lastRefreshError ? ` — ${status.lastRefreshError}` : ""}
						</p>
					)}
					<label className="block text-xs text-foreground">
						Optional API key ({LOCAL_INFERENCE_API_KEY_ENV})
						<input
							type="password"
							value={apiKey}
							disabled={busy}
							onChange={(e) => setApiKey(e.target.value)}
							placeholder={status?.apiKeyPresent ? "Replace key…" : "Paste key…"}
							data-testid="local-inference-api-key"
							className="mt-1 h-7 w-full rounded-sm border border-border bg-background px-1.5 font-mono text-xs outline-none focus:border-muted-foreground/50"
						/>
					</label>
					<button
						type="button"
						disabled={busy || !apiKey.trim()}
						onClick={() => void saveApiKey()}
						className="text-xs text-foreground underline-offset-2 hover:underline disabled:text-muted-foreground/40"
					>
						Save API key
					</button>
					<div className="flex gap-2">
						<input
							type="text"
							value={manualId}
							disabled={busy || !status?.configured}
							onChange={(e) => setManualId(e.target.value)}
							placeholder="Manual model id"
							data-testid="local-inference-manual-id"
							className="h-7 min-w-0 flex-1 rounded-sm border border-border bg-background px-1.5 font-mono text-xs outline-none focus:border-muted-foreground/50"
						/>
						<button
							type="button"
							disabled={busy || !manualId.trim() || !status?.configured}
							onClick={() => void addManualModel()}
							className="shrink-0 text-xs text-foreground underline-offset-2 hover:underline disabled:text-muted-foreground/40"
							data-testid="local-inference-manual-add"
						>
							Add model
						</button>
					</div>
					{error && <p className="text-xs text-red-400">{error}</p>}
				</div>
			)}
		</div>
	);
}

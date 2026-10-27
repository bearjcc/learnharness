const DEFAULT_LEASE_BODY = {
	service: "learnharness",
	job: "practice-daily-build",
	vram_gb: 8,
	class: "batch",
	owner: "learnharness",
	reason: "practice daily build",
};

function brokerBase(): string | null {
	const base = process.env.LH_GPU_BROKER_URL?.trim();
	return base ? base.replace(/\/$/, "") : null;
}

function leasePath(): string {
	return process.env.LH_GPU_BROKER_LEASE_PATH?.trim() || "/api/lease";
}

function heartbeatPath(id: string): string {
	const template = process.env.LH_GPU_BROKER_HEARTBEAT_PATH?.trim() || "/api/lease/{id}/heartbeat";
	return template.replace("{id}", encodeURIComponent(id));
}

function releasePath(id: string): string {
	const template = process.env.LH_GPU_BROKER_RELEASE_PATH?.trim() || "/api/lease/{id}/release";
	return template.replace("{id}", encodeURIComponent(id));
}

/** Lease POST body for Dunce GPU broker (snake_case per broker API). */
export function buildGpuBrokerLeaseBody(
	env: Record<string, string | undefined> = process.env,
): Record<string, unknown> {
	const service = env.LH_GPU_BROKER_SERVICE?.trim() || DEFAULT_LEASE_BODY.service;
	const vram_gb = Number(env.LH_GPU_BROKER_VRAM_GB) || DEFAULT_LEASE_BODY.vram_gb;
	return {
		service,
		job: env.LH_GPU_BROKER_JOB?.trim() || DEFAULT_LEASE_BODY.job,
		vram_gb,
		class: env.LH_GPU_BROKER_CLASS?.trim() || DEFAULT_LEASE_BODY.class,
		owner: env.LH_GPU_BROKER_OWNER?.trim() || DEFAULT_LEASE_BODY.owner,
		reason: env.LH_GPU_BROKER_REASON?.trim() || DEFAULT_LEASE_BODY.reason,
	};
}

function leaseRequestBody(): Record<string, unknown> {
	return buildGpuBrokerLeaseBody();
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

interface LeaseResponse {
	id?: string;
	leaseId?: string;
	state?: string;
	status?: string;
	granted?: boolean;
	queuePosition?: number;
	retryAfterMs?: number;
}

function leaseId(body: LeaseResponse): string | null {
	return body.id ?? body.leaseId ?? null;
}

function isGranted(body: LeaseResponse): boolean {
	const state = (body.state ?? body.status ?? "").toLowerCase();
	return body.granted === true || state === "active" || state === "granted";
}

function isQueued(body: LeaseResponse): boolean {
	const state = (body.state ?? body.status ?? "").toLowerCase();
	return state === "queued" || state === "pending" || state === "waiting";
}

function brokerUnreachable(err: unknown): boolean {
	if (!(err instanceof Error)) return true;
	const code = (err as NodeJS.ErrnoException).code;
	return (
		code === "ECONNREFUSED" ||
		code === "ENOTFOUND" ||
		code === "EHOSTUNREACH" ||
		code === "ETIMEDOUT" ||
		err.message.includes("fetch failed")
	);
}

async function postJson(url: string, body: unknown, fetchImpl: typeof fetch): Promise<Response> {
	return fetchImpl(url, {
		method: "POST",
		headers: { "Content-Type": "application/json", Accept: "application/json" },
		body: JSON.stringify(body),
	});
}

async function waitForGrant(
	base: string,
	id: string,
	fetchImpl: typeof fetch,
	deadlineMs = 30 * 60_000,
): Promise<"granted" | "timeout"> {
	const started = Date.now();
	let delay = 2000;
	while (Date.now() - started < deadlineMs) {
		const res = await postJson(`${base}${heartbeatPath(id)}`, {}, fetchImpl);
		const body = (await res.json().catch(() => ({}))) as LeaseResponse;
		if (isGranted(body)) return "granted";
		if (!isQueued(body) && res.ok) return "granted";
		const wait = body.retryAfterMs ?? delay;
		await sleep(wait);
		delay = Math.min(delay * 1.5, 15_000);
	}
	return "timeout";
}

export type GpuBrokerOutcome = "ok" | "none" | "timeout";

/**
 * Run work while holding a GPU broker lease when reachable.
 * Falls through to `work()` when LH_GPU_BROKER_URL is unset or the broker is unreachable.
 */
export async function withGpuBrokerLease<T>(
	work: () => Promise<T>,
	fetchImpl: typeof fetch = fetch,
): Promise<{ outcome: GpuBrokerOutcome; result: T }> {
	const base = brokerBase();
	if (!base) {
		return { outcome: "none", result: await work() };
	}
	let created: LeaseResponse;
	try {
		const createRes = await postJson(`${base}${leasePath()}`, leaseRequestBody(), fetchImpl);
		if (!createRes.ok) {
			return { outcome: "none", result: await work() };
		}
		created = (await createRes.json().catch(() => ({}))) as LeaseResponse;
	} catch (err) {
		if (brokerUnreachable(err)) {
			return { outcome: "none", result: await work() };
		}
		throw err;
	}
	const id = leaseId(created);
	if (!id) {
		return { outcome: "none", result: await work() };
	}

	if (!isGranted(created)) {
		const wait = await waitForGrant(base, id, fetchImpl);
		if (wait === "timeout") {
			await postJson(`${base}${releasePath(id)}`, {}, fetchImpl).catch(() => undefined);
			return { outcome: "timeout", result: await work() };
		}
	}

	const heartbeatMs = Number(process.env.LH_GPU_BROKER_HEARTBEAT_MS) || 30_000;
	const timer = setInterval(() => {
		void postJson(`${base}${heartbeatPath(id)}`, {}, fetchImpl).catch(() => undefined);
	}, heartbeatMs);
	try {
		return { outcome: "ok", result: await work() };
	} finally {
		clearInterval(timer);
		await postJson(`${base}${releasePath(id)}`, {}, fetchImpl).catch(() => undefined);
	}
}

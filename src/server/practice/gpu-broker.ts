const ACQUIRE_PATH = "/acquire";
const RELEASE_PATH = "/release";

export async function acquireGpuLease(fetchImpl: typeof fetch = fetch): Promise<string | null> {
	const base = process.env.LH_GPU_BROKER_URL?.trim();
	if (!base) return null;
	try {
		const res = await fetchImpl(new URL(ACQUIRE_PATH, base).toString(), { method: "POST" });
		if (res.status === 503) return "503";
		if (!res.ok) return null;
		const body = (await res.json().catch(() => ({}))) as { leaseId?: string };
		return body.leaseId ?? "ok";
	} catch {
		return null;
	}
}

export async function releaseGpuLease(leaseId: string | null, fetchImpl: typeof fetch = fetch): Promise<void> {
	const base = process.env.LH_GPU_BROKER_URL?.trim();
	if (!base || !leaseId || leaseId === "503") return;
	try {
		await fetchImpl(new URL(RELEASE_PATH, base).toString(), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ leaseId }),
		});
	} catch {
		// best effort
	}
}

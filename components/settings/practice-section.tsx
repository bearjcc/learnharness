"use client";

import { useCallback, useEffect, useState } from "react";
import type { PracticeSubject } from "@/src/core";
import { SettingsGroup } from "./controls.tsx";

export function PracticeSection() {
	const [subjects, setSubjects] = useState<PracticeSubject[]>([]);
	const [subjectId, setSubjectId] = useState("");
	const [title, setTitle] = useState("");
	const [dailyCards, setDailyCards] = useState(10);

	const reload = useCallback(async () => {
		const res = await fetch("/api/practice/subjects");
		if (res.ok) {
			const json = (await res.json()) as { subjects: PracticeSubject[] };
			setSubjects(json.subjects ?? []);
		}
	}, []);

	useEffect(() => {
		void reload();
	}, [reload]);

	async function save() {
		if (!subjectId.trim() || !title.trim()) return;
		await fetch("/api/practice/subjects", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				subjectId: subjectId.trim(),
				title: title.trim(),
				enabled: true,
				dailyCards,
				itemKinds: [],
			}),
		});
		setSubjectId("");
		setTitle("");
		await reload();
	}

	async function toggleEnabled(s: PracticeSubject) {
		await fetch("/api/practice/subjects", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ...s, enabled: !s.enabled }),
		});
		await reload();
	}

	return (
		<SettingsGroup label="Practice subjects" testid="group-practice">
			<p className="px-1 text-xs text-muted-foreground">
				Subjects feed the Choice app. Run the daily build via POST /api/practice/daily-build (e.g. scheduled at 06:15).
			</p>
			{subjects.map((s) => (
				<div key={s.subjectId} className="flex items-center justify-between gap-2 px-1 py-1 text-xs" data-testid={`practice-subject-${s.subjectId}`}>
					<span>{s.title} ({s.subjectId}) · {s.dailyCards}/day</span>
					<button type="button" className="underline" onClick={() => void toggleEnabled(s)}>
						{s.enabled ? "Disable" : "Enable"}
					</button>
				</div>
			))}
			<div className="mt-2 flex flex-wrap gap-2 px-1">
				<input
					className="h-7 rounded-sm border border-border px-1.5 font-mono text-xs"
					placeholder="subject-id"
					value={subjectId}
					onChange={(e) => setSubjectId(e.target.value)}
					data-testid="practice-subject-id"
				/>
				<input
					className="h-7 min-w-0 flex-1 rounded-sm border border-border px-1.5 text-xs"
					placeholder="Title"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
				/>
				<input
					className="h-7 w-16 rounded-sm border border-border px-1.5 font-mono text-xs"
					type="number"
					min={1}
					value={dailyCards}
					onChange={(e) => setDailyCards(Number(e.target.value))}
				/>
				<button type="button" className="text-xs underline" onClick={() => void save()} data-testid="practice-subject-save">
					Add
				</button>
			</div>
		</SettingsGroup>
	);
}

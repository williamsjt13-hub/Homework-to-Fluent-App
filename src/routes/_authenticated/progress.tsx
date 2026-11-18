import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { statsQuery, lessonsQuery, computeStreak, localDate } from "@/lib/queries";
import { PageTitle, Stat } from "@/components/coach/bits";

export const Route = createFileRoute("/_authenticated/progress")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Progress — Weekly Language Coach" },
      { name: "description", content: "Your scores, study time and weak spots over time." },
      { property: "og:title", content: "Progress — Weekly Language Coach" },
      { property: "og:description", content: "Your scores, study time and weak spots over time." },
    ],
  }),
  component: ProgressPage,
});

const SKILLS = ["vocabulary", "grammar", "listening", "reading", "speaking", "comprehension"];

function ProgressPage() {
  const { data } = useQuery(statsQuery());
  const lessons = useQuery(lessonsQuery());
  if (!data) return <div className="py-20 text-center text-muted-foreground">Loading…</div>;

  const totalMin = data.sessions.reduce((a, s) => a + s.minutes, 0);
  const streak = computeStreak(data.sessions.map((s) => s.study_date));
  const scored = data.days.filter((d) => d.score != null);
  const avg = scored.length ? Math.round(scored.reduce((a, d) => a + Number(d.score), 0) / scored.length) : null;

  const topicOf = (lid: string) => lessons.data?.find((l) => l.id === lid)?.topic ?? "Week";
  const weekly = data.assessments.map((a, i) => ({ name: `W${i + 1}`, topic: topicOf(a.lesson_id), score: Math.round(Number(a.total_score)), ...(a.category_scores as Record<string, number>) }));

  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const key = localDate(d);
    return { name: d.toLocaleDateString(undefined, { weekday: "narrow" }), minutes: data.sessions.filter((s) => s.study_date === key).reduce((a, s) => a + s.minutes, 0) };
  });

  const skillAvg = SKILLS.map((k) => {
    const vals = data.assessments.map((a) => (a.category_scores as Record<string, number>)[k]).filter((v) => v != null);
    return { skill: k, value: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null };
  });

  const conceptMap = new Map<string, { concept: string; category: string; count: number }>();
  for (const m of data.mistakes) {
    const k = m.concept.toLowerCase();
    const c = conceptMap.get(k) ?? { concept: m.concept, category: m.category, count: 0 };
    c.count += m.occurrences;
    conceptMap.set(k, c);
  }
  const frequent = [...conceptMap.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  const mastered = data.assessments.flatMap((a) => (a.strong_areas as string[]) ?? []).slice(-8);

  return (
    <div className="animate-rise space-y-6">
      <PageTitle eyebrow="Progress" title="How you're improving" />
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Study time" value={`${Math.floor(totalMin / 60)}h ${totalMin % 60}m`} />
        <Stat label="Current streak" value={`${streak} days`} />
        <Stat label="Average score" value={avg != null ? `${avg}%` : "—"} />
        <Stat label="Weeks assessed" value={data.assessments.length} />
      </div>

      <section className="rounded-3xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Study minutes · last 14 days</h2>
        <div className="mt-3 h-40">
          <ResponsiveContainer>
            <BarChart data={last14}>
              <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
              <Tooltip />
              <Bar dataKey="minutes" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-3xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Weekly exam scores</h2>
        {weekly.length ? (
          <div className="mt-3 h-48">
            <ResponsiveContainer>
              <LineChart data={weekly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis domain={[0, 100]} fontSize={11} width={28} />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="var(--color-primary)" strokeWidth={3} />
                <Line type="monotone" dataKey="grammar" stroke="var(--color-chart-3)" />
                <Line type="monotone" dataKey="vocabulary" stroke="var(--color-chart-2)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Finish your first Friday exam to see your trend.</p>
        )}
      </section>

      <section className="rounded-3xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Skills</h2>
        <div className="mt-3 space-y-3">
          {skillAvg.map((s) => (
            <div key={s.skill}>
              <div className="flex justify-between text-sm capitalize"><span>{s.skill}</span><span className="font-semibold">{s.value != null ? `${s.value}%` : "—"}</span></div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${s.value ?? 0}%` }} /></div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Frequently missed concepts</h2>
        <ul className="mt-3 space-y-2">
          {frequent.map((f) => (
            <li key={f.concept} className="flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-2 text-sm"><span className="font-medium">{f.concept}</span><span className="text-xs text-muted-foreground">{f.category} · ×{f.count}</span></li>
          ))}
          {!frequent.length && <p className="text-sm text-muted-foreground">No mistakes recorded yet.</p>}
        </ul>
      </section>

      {mastered.length > 0 && (
        <section className="rounded-3xl border bg-card p-5">
          <h2 className="text-lg font-semibold">Mastered</h2>
          <div className="mt-3 flex flex-wrap gap-2">{mastered.map((m, i) => <span key={i} className="rounded-full bg-success/10 px-3 py-1 text-sm text-success">{m}</span>)}</div>
        </section>
      )}
    </div>
  );
}

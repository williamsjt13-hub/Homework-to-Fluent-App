import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CheckCircle2, Lock, ChevronRight, FileText, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lessonQuery } from "@/lib/queries";
import { finalizeWeek } from "@/lib/coach.functions";
import { DAY_PLAN } from "@/lib/languages";
import { PageTitle, scoreColor, SourceBadge } from "@/components/coach/bits";
import { Button } from "@/components/ui/button";
import { PlanCoachEntry } from "@/components/coach/plan-coach";

export const Route = createFileRoute("/_authenticated/lessons/$id/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Your week — Weekly Language Coach" },
      { name: "description", content: "Your 5-day study plan, results and original homework." },
      { property: "og:title", content: "Your week — Weekly Language Coach" },
      { property: "og:description", content: "Your 5-day study plan, results and original homework." },
    ],
  }),
  component: LessonPage,
});

function LessonPage() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery(lessonQuery(id));
  const [urls, setUrls] = useState<Record<string, string>>({});
  const finalize = useServerFn(finalizeWeek);
  const qc = useQueryClient();
  const [finBusy, setFinBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const next: Record<string, string> = {};
      for (const d of data?.docs ?? []) {
        const { data: s } = await supabase.storage.from("homework").createSignedUrl(d.storage_path, 3600);
        if (s) next[d.id] = s.signedUrl;
      }
      setUrls(next);
    })();
  }, [data?.docs]);

  if (isLoading || !data) return <div className="py-20 text-center text-muted-foreground">Loading…</div>;
  const { lesson, days, docs, assessment } = data;
  const ex = (lesson.extracted ?? {}) as { vocabulary?: { term: string; translation: string }[]; grammar?: string[]; homework?: string[]; objectives?: string[] };
  const day5Done = days.find((d) => d.day_number === 5)?.completed_at;
  const totalMin = days.reduce((a, d) => a + d.minutes_completed, 0);

  async function getResults() {
    setFinBusy(true);
    try {
      await finalize({ data: { lessonId: id } });
      await qc.invalidateQueries();
    } finally {
      setFinBusy(false);
    }
  }

  return (
    <div className="animate-rise space-y-6">
      <PageTitle eyebrow={`Week of ${new Date(lesson.week_start).toLocaleDateString(undefined, { month: "long", day: "numeric" })}`} title={lesson.topic || "This week"}>
        {totalMin} minutes studied{lesson.overall_score != null && <> · overall <span className={scoreColor(Number(lesson.overall_score))}>{Math.round(Number(lesson.overall_score))}%</span></>}
      </PageTitle>

      {lesson.status === "analyzed" && (
        <Button asChild className="h-12 w-full rounded-2xl"><Link to="/lessons/$id/review" params={{ id }}>Review & confirm lesson</Link></Button>
      )}

      {assessment ? (
        <WeeklyResults a={assessment} />
      ) : day5Done ? (
        <Button onClick={getResults} disabled={finBusy} className="h-14 w-full rounded-2xl text-base"><Trophy className="h-5 w-5" /> {finBusy ? "Calculating…" : "See my weekly results"}</Button>
      ) : null}

      <div className="space-y-2">
        {days.map((d) => {
          const meta = DAY_PLAN[d.day_number - 1];
          const locked = d.day_number === 2 && !days.find((x) => x.day_number === 1)?.completed_at;
          return (
            <Link key={d.id} to="/lessons/$id/day/$n" params={{ id, n: String(d.day_number) }} className="flex items-center gap-4 rounded-3xl border bg-card p-4">
              <div className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl ${d.completed_at ? "bg-success text-success-foreground" : "bg-muted"}`}>
                {d.completed_at ? <CheckCircle2 className="h-5 w-5" /> : locked ? <Lock className="h-5 w-5 text-muted-foreground" /> : <span className="font-display text-lg font-semibold">{d.day_number}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-muted-foreground">{meta?.weekday}</div>
                <div className="font-semibold">{d.title}</div>
                {locked && <div className="text-xs text-muted-foreground">Unlocks after Day 1 mastery</div>}
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (d.minutes_completed / d.target_minutes) * 100)}%` }} /></div>
              </div>
              <div className={`text-sm font-semibold ${scoreColor(d.score == null ? null : Number(d.score))}`}>{d.score != null ? `${Math.round(Number(d.score))}%` : ""}</div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          );
        })}
      </div>

      {["planned", "active"].includes(lesson.status) && <PlanCoachEntry lessonId={id} />}

      <section className="rounded-3xl border bg-card p-5">
        <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Lesson</h2><SourceBadge source="teacher" /></div>
        {ex.objectives?.length ? <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{ex.objectives.map((o, i) => <li key={i}>{o}</li>)}</ul> : null}
        {ex.grammar?.length ? <><h3 className="mt-4 text-sm font-semibold">Grammar</h3><ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{ex.grammar.map((o, i) => <li key={i}>{o}</li>)}</ul></> : null}
        {ex.homework?.length ? <><h3 className="mt-4 text-sm font-semibold">Homework</h3><ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{ex.homework.map((o, i) => <li key={i}>{o}</li>)}</ul></> : null}
        {ex.vocabulary?.length ? (
          <>
            <h3 className="mt-4 text-sm font-semibold">Vocabulary ({ex.vocabulary.length})</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">{ex.vocabulary.map((v, i) => <span key={i} className="rounded-full bg-muted px-3 py-1 text-xs" title={v.translation}>{v.term}</span>)}</div>
          </>
        ) : null}
        {lesson.status !== "uploaded" && <Link to="/lessons/$id/review" params={{ id }} className="mt-4 block text-sm text-primary underline">Edit lesson details</Link>}
      </section>

      <section className="rounded-3xl border bg-card p-5">
        <h2 className="text-xl font-semibold">Original homework</h2>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {docs.map((d) => (
            <a key={d.id} href={urls[d.id]} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border">
              {d.mime_type.startsWith("image/") && urls[d.id] ? <img src={urls[d.id]} alt={d.file_name} className="aspect-[3/4] w-full object-cover" /> : <div className="flex aspect-[3/4] flex-col items-center justify-center gap-1 bg-muted p-2 text-center text-xs"><FileText className="h-6 w-6" />{d.file_name}</div>}
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

function WeeklyResults({ a }: { a: { total_score: number; category_scores: unknown; weak_areas: unknown; strong_areas: unknown; recommendations: unknown } }) {
  const cats = a.category_scores as Record<string, number>;
  return (
    <section className="space-y-4 rounded-[2rem] bg-ink p-6 text-ink-foreground">
      <div className="text-xs font-semibold uppercase tracking-widest text-accent">Weekly score</div>
      <div className="font-display text-6xl font-semibold">{Math.round(Number(a.total_score))}%</div>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(cats).map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-ink-foreground/10 p-3"><div className="text-xs capitalize text-ink-foreground/70">{k}</div><div className="text-xl font-semibold">{v}%</div></div>
        ))}
      </div>
      <List title="Strong areas" items={a.strong_areas as string[]} />
      <List title="Weak areas" items={a.weak_areas as string[]} />
      <List title="Recommended review" items={a.recommendations as string[]} />
    </section>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <div className="text-sm font-semibold text-accent">{title}</div>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-foreground/85">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  );
}

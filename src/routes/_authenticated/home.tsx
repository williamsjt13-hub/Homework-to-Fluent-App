import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Camera, FileUp, ArrowRight, Flame, Target, BookMarked, AlertTriangle } from "lucide-react";
import { lessonsQuery, lessonQuery, statsQuery, computeStreak, localDate } from "@/lib/queries";
import { DAY_PLAN } from "@/lib/languages";
import { Button } from "@/components/ui/button";
import { ProgressRing, Stat, PageTitle } from "@/components/coach/bits";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Today — Weekly Language Coach" },
      { name: "description", content: "What to study today." },
      { property: "og:title", content: "Today — Weekly Language Coach" },
      { property: "og:description", content: "What to study today." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { user } = useAuth();
  const lessons = useQuery(lessonsQuery());
  const stats = useQuery(statsQuery());
  const current = lessons.data?.find((l) => l.status !== "completed") ?? null;
  const detail = useQuery({ ...lessonQuery(current?.id ?? "none"), enabled: !!current });

  const name = (user?.user_metadata?.["display_name"] as string) || user?.email?.split("@")[0];
  const today = localDate();
  const todayMinutes = (stats.data?.sessions ?? []).filter((s) => s.study_date === today).reduce((a, s) => a + s.minutes, 0);
  const streak = computeStreak((stats.data?.sessions ?? []).map((s) => s.study_date));
  const scored = (stats.data?.days ?? []).filter((d) => d.score != null);
  const avg = scored.length ? Math.round(scored.reduce((a, d) => a + Number(d.score), 0) / scored.length) : null;

  const days = detail.data?.days ?? [];
  const nextDay = days.find((d) => !d.completed_at);
  const weekTarget = days.reduce((sum, day) => sum + day.target_minutes, 0);
  const weekPct = weekTarget ? days.reduce((a, d) => a + Math.min(d.minutes_completed, d.target_minutes), 0) / weekTarget : 0;
  const todayTarget = nextDay?.target_minutes ?? 60;

  return (
    <div className="animate-rise">
      <PageTitle eyebrow={new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} title={`Hola, ${name ?? "amigo"}`} />

      {current?.status === "analyzed" ? (
        <Link to="/lessons/$id/review" params={{ id: current.id }} className="block">
          <div className="relative overflow-hidden rounded-[2rem] bg-ink p-7 text-ink-foreground">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/40 blur-2xl" />
            <Camera className="h-8 w-8 text-accent" />
            <h2 className="mt-6 text-3xl font-semibold">Review what I found</h2>
            <p className="mt-2 text-ink-foreground/75">Confirm the lesson details so I can build your week.</p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground">
              Continue <ArrowRight className="h-4 w-4" />
            </div>
          </div>
        </Link>
      ) : !current || current.status === "uploaded" ? (
        <div className="relative overflow-hidden rounded-[2rem] bg-ink p-7 text-ink-foreground">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/40 blur-2xl" />
          <Camera className="h-8 w-8 text-accent" />
          <h2 className="mt-6 text-3xl font-semibold">Add This Week's Homework</h2>
          <p className="mt-2 text-ink-foreground/75">Take photos of every page or upload the files your teacher sent. I'll build your 5-day study plan from it.</p>
          <div className="mt-6 grid grid-cols-2 gap-2">
            <Link to="/scan" className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 font-semibold text-primary-foreground">
              <Camera className="h-4 w-4" /> Take photos
            </Link>
            <Link to="/scan" search={{ mode: "upload" }} className="inline-flex items-center justify-center gap-2 rounded-full bg-ink-foreground/15 px-4 py-3 font-semibold">
              <FileUp className="h-4 w-4" /> Upload files
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-[2rem] bg-ink p-6 text-ink-foreground">
          <div className="text-xs font-semibold uppercase tracking-widest text-accent">Today's study</div>
          {nextDay ? (
            <>
              <h2 className="mt-2 text-3xl font-semibold">Day {nextDay.day_number} — {nextDay.title}</h2>
              <p className="mt-1 text-sm text-ink-foreground/70">{DAY_PLAN[nextDay.day_number - 1]?.purpose}</p>
              <div className="mt-5 flex items-center gap-5">
                <ProgressRing value={todayMinutes / todayTarget} size={96} stroke={9}>
                  <div className="font-display text-xl font-semibold">{todayMinutes}</div>
                  <div className="text-[10px] text-ink-foreground/70">/ {todayTarget} min</div>
                </ProgressRing>
                <div className="text-sm text-ink-foreground/80">
                  <div>Today: {Math.round(Math.min(1, todayMinutes / todayTarget) * 100)}% complete</div>
                  <div>{Math.max(0, todayTarget - todayMinutes)} minutes to go</div>
                  <div>Week: {Math.round(weekPct * 100)}% complete</div>
                </div>
              </div>
              <Button asChild size="lg" className="mt-6 h-14 w-full rounded-2xl text-base">
                <Link to="/lessons/$id/day/$n" params={{ id: current.id, n: String(nextDay.day_number) }}>
                  {nextDay.minutes_completed > 0 ? "Continue today's study" : "Start today's study"} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </>
          ) : (
            <h2 className="mt-2 text-2xl font-semibold">All days done — see your results!</h2>
          )}
          <Link to="/lessons/$id" params={{ id: current.id }} className="mt-4 block text-center text-sm text-ink-foreground/70 underline">
            This week: {current.topic}
          </Link>
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Stat label="Current streak" value={<span className="flex items-center gap-1"><Flame className="h-5 w-5 text-primary" />{streak} days</span>} />
        <Stat label="Average score" value={avg != null ? `${avg}%` : "—"} />
        <Stat label="Vocabulary" value={stats.data?.vocab.length ?? 0} sub="words from your lessons" />
        <Stat label="Weeks completed" value={lessons.data?.filter((l) => l.status === "completed").length ?? 0} />
      </div>

      {current && current.status !== "uploaded" && current.status !== "analyzed" && (
        <Link to="/scan" className="mt-5 flex items-center gap-3 rounded-3xl border bg-card p-4">
          <Camera className="h-5 w-5 text-primary" />
          <div className="flex-1 text-sm"><div className="font-semibold">New week from your teacher?</div><div className="text-muted-foreground">Scan next week's homework</div></div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      )}

      <section className="mt-8">
        <h3 className="flex items-center gap-2 text-xl font-semibold"><AlertTriangle className="h-5 w-5 text-destructive" /> Things I need to work on</h3>
        <div className="mt-3 space-y-2">
          {(stats.data?.mistakes ?? []).filter((m) => !m.resolved).slice(0, 5).map((m) => (
            <div key={m.id} className="rounded-2xl border bg-card p-4 text-sm">
              <div className="flex items-center justify-between"><span className="font-semibold">{m.concept}</span><span className="text-xs text-muted-foreground">{m.category}{m.occurrences > 1 ? ` · ×${m.occurrences}` : ""}</span></div>
              {m.student_text && <div className="mt-1"><span className="text-destructive line-through">{m.student_text}</span> → <span className="text-success">{m.correct_text}</span></div>}
            </div>
          ))}
          {!stats.data?.mistakes.length && <p className="text-sm text-muted-foreground">Nothing yet — mistakes from your homework and practice will show up here.</p>}
        </div>
      </section>

      {current && (
        <section className="mt-8">
          <h3 className="flex items-center gap-2 text-xl font-semibold"><Target className="h-5 w-5 text-primary" /> This week</h3>
          <div className="mt-3 space-y-2">
            {days.map((d) => (
              <Link key={d.id} to="/lessons/$id/day/$n" params={{ id: current.id, n: String(d.day_number) }} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl font-semibold ${d.completed_at ? "bg-success text-success-foreground" : "bg-muted"}`}>{d.day_number}</div>
                <div className="flex-1"><div className="text-sm font-semibold">{d.title}</div><div className="text-xs text-muted-foreground">{Math.min(d.minutes_completed, d.target_minutes)} / {d.target_minutes} min{d.score != null ? ` · ${Math.round(Number(d.score))}%` : ""}</div></div>
                <BookMarked className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

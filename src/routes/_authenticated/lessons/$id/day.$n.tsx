import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Circle, Clock, Loader2, ChevronRight, PartyPopper, Lock } from "lucide-react";
import { dayQuery, lessonQuery } from "@/lib/queries";
import { generateDay } from "@/lib/coach.functions";
import { DAY_PLAN, MASTERY_PASS, isConjugationDeck } from "@/lib/languages";
import { ProgressRing, SourceBadge } from "@/components/coach/bits";
import { TaskPlayer, FlashcardsPlayer, QuizPlayer, ConversationPlayer, type Activity } from "@/components/coach/players";
import { Button } from "@/components/ui/button";
import { DictationPlayer, ShadowingPlayer } from "@/components/coach/listening";

export const Route = createFileRoute("/_authenticated/lessons/$id/day/$n")({
  validateSearch: (s) => z.object({ a: z.string().optional() }).parse(s),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Study day — Weekly Language Coach" },
      { name: "description", content: "Today's 60-minute study session." },
      { property: "og:title", content: "Study day — Weekly Language Coach" },
      { property: "og:description", content: "Today's 60-minute study session." },
    ],
  }),
  component: DayPage,
});

const KIND_LABEL: Record<string, string> = { task: "Homework", flashcards: "Flashcards", quiz: "Exercises", listening: "Listening", conversation: "Conversation", dictation: "Dictation", shadowing: "Shadowing" };

function DayPage() {
  const { id, n } = Route.useParams();
  const { a } = Route.useSearch();
  const navigate = Route.useNavigate();
  const dayNum = Number(n);
  const lessonQ = useQuery(lessonQuery(id));
  const day1Done = !!lessonQ.data?.days.find((d) => d.day_number === 1)?.completed_at;
  const locked = dayNum === 2 && !!lessonQ.data && !day1Done;
  const { data, isLoading, refetch } = useQuery(dayQuery(id, dayNum));
  const gen = useServerFn(generateDay);
  const qc = useQueryClient();
  const [genError, setGenError] = useState<string | null>(null);
  const genStarted = useRef(false);

  const needsGen = !!lessonQ.data && !locked && data && !data.activities.some((activity) => !activity.plan_added);
  useEffect(() => {
    if (!needsGen || genStarted.current || !data) return;
    genStarted.current = true;
    setGenError(null);
    gen({ data: { dayId: data.day.id } })
      .then(() => refetch())
      .catch((e) => {
        setGenError(e instanceof Error ? e.message : "Couldn't prepare this day");
        genStarted.current = false;
      });
  }, [needsGen, data, gen, refetch]);

  if (locked) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-muted"><Lock className="h-7 w-7 text-muted-foreground" /></span>
        <h2 className="mt-6 text-2xl font-semibold">Master Day 1 first</h2>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">Homework and recall unlock once you've mastered every flashcard deck and scored {MASTERY_PASS}%+ on the Day 1 mastery check.</p>
        <Button asChild className="mt-6 h-12 rounded-2xl"><Link to="/lessons/$id/day/$n" params={{ id, n: "1" }}>Go to Day 1</Link></Button>
      </div>
    );
  }

  if (isLoading || !data) return <div className="py-20 text-center text-muted-foreground">Loading…</div>;
  const { day } = data;
  const activities = data.activities.filter((x) => !x.removed_at);
  const meta = DAY_PLAN[dayNum - 1];

  if (needsGen) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
        {genError ? (
          <>
            <p className="text-destructive">{genError}</p>
            <Button className="mt-4" onClick={() => { genStarted.current = false; refetch(); setGenError(null); }}>Try again</Button>
          </>
        ) : (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <h2 className="mt-6 text-2xl font-semibold">Preparing Day {dayNum}…</h2>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">Personalizing from your lesson{dayNum > 1 ? " and how you did earlier this week" : ""}. About a minute.</p>
          </>
        )}
      </div>
    );
  }

  const done = activities.filter((x) => x.completed);
  const minutes = Math.min(day.minutes_completed, 999);
  const conjDecks = dayNum === 1 ? activities.filter((x) => !x.plan_added && isConjugationDeck(x)) : [];
  const conjDone = conjDecks.every((x) => x.completed);
  const isLocked = (x: Activity) => dayNum === 1 && !conjDone && !isConjugationDeck(x);
  const remaining = activities.filter((x) => !x.completed && !isLocked(x));
  const next = remaining[0];
  const current = activities.find((x) => x.id === a && !isLocked(x));

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["day", id] });
    qc.invalidateQueries({ queryKey: ["lesson", id] });
    qc.invalidateQueries({ queryKey: ["stats"] });
    qc.invalidateQueries({ queryKey: ["lessons"] });
  };

  if (current) {
    return <ActivityView activity={current} back={() => navigate({ search: {} })} onDone={() => { refresh(); if (!current.completed) toast.success(`+${current.est_minutes} minutes`); }} nextId={remaining.find((x) => x.id !== current.id)?.id} goNext={(nid) => navigate({ search: { a: nid } })} dayNum={dayNum} />;
  }

  return (
    <div className="animate-rise">
      <Link to="/lessons/$id" params={{ id }} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Week</Link>
      <div className="text-xs font-semibold uppercase tracking-widest text-primary">Day {dayNum} · {meta?.weekday}</div>
      {dayNum === 3 ? (
        <>
          <h1 className="mt-1 text-3xl font-semibold">Day 3: Listening & Comprehension</h1>
          <p className="mt-2 text-muted-foreground">Train your ears with active listening drills based on this week's scanned homework.</p>
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs font-medium text-muted-foreground"><span>Exercises</span><span>{done.length} / {activities.length}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${activities.length ? (done.length / activities.length) * 100 : 0}%` }} /></div>
          </div>
        </>
      ) : (
        <>
          <h1 className="mt-1 text-3xl font-semibold">{day.title}</h1>
          <p className="mt-2 text-muted-foreground"><b className="text-foreground">Why:</b> {day.purpose}</p>
        </>
      )}

      <div className="mt-6 flex items-center gap-5 rounded-3xl border bg-card p-5">
        <ProgressRing value={minutes / day.target_minutes} size={104}>
          <div className="font-display text-2xl font-semibold">{minutes}</div>
          <div className="text-[10px] text-muted-foreground">/ {day.target_minutes} min</div>
        </ProgressRing>
        <div className="space-y-1 text-sm">
          <div><b>{done.length}</b> of {activities.length} activities done</div>
          <div className="flex items-center gap-1 text-muted-foreground"><Clock className="h-3.5 w-3.5" /> ~{remaining.reduce((s, x) => s + x.est_minutes, 0)} min remaining</div>
          <div className="text-muted-foreground">{Math.round(Math.min(1, minutes / day.target_minutes) * 100)}% of today's goal</div>
          {day.score != null && <div>Score so far: <b>{Math.round(Number(day.score))}%</b></div>}
        </div>
      </div>

      {day.completed_at && (
        <div className="mt-4 flex items-center gap-3 rounded-3xl bg-success/10 p-4 text-sm">
          <PartyPopper className="h-6 w-6 text-success" />
          <div className="flex-1"><b>Day complete!</b> {dayNum < 5 ? "Come back tomorrow for the next day." : "Your weekly results are ready."}</div>
          {dayNum === 5 && <Button asChild size="sm"><Link to="/lessons/$id" params={{ id }}>Results</Link></Button>}
        </div>
      )}

      {dayNum === 1 && !day.completed_at && activities.length > 0 && remaining.length === 0 && (
        <div className="mt-4 rounded-3xl bg-destructive/10 p-4 text-sm">
          <b>Almost there.</b> Score {MASTERY_PASS}%+ on the mastery check to unlock Day 2. Open it below and retry the questions you missed.
        </div>
      )}

      {next && (
        <Button size="lg" className="mt-4 h-14 w-full rounded-2xl text-base" onClick={() => navigate({ search: { a: next.id } })}>
          Next up: {next.title} <ChevronRight className="h-4 w-4" />
        </Button>
      )}

      {dayNum === 1 && conjDecks.length > 0 && !conjDone && (
        <div className="mt-4 rounded-3xl bg-muted p-4 text-sm">
          <b>Start with the first flashcard deck.</b> Finish it to unlock the rest of today.
        </div>
      )}

      <ol className="mt-6 space-y-2">
        {activities.map((x) => (
          <li key={x.id}>
            <button disabled={isLocked(x)} onClick={() => navigate({ search: { a: x.id } })} className="flex w-full items-center gap-3 rounded-3xl border bg-card p-4 text-left disabled:opacity-50">
              {x.completed ? <CheckCircle2 className="h-6 w-6 shrink-0 text-success" /> : isLocked(x) ? <Lock className="h-6 w-6 shrink-0 text-muted-foreground" /> : <Circle className="h-6 w-6 shrink-0 text-muted-foreground" />}
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{x.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{KIND_LABEL[x.kind] ?? x.kind}</span>·<span>{x.est_minutes} min</span>
                  <SourceBadge source={x.source} />
                </div>
              </div>
              {x.score != null && <span className="text-sm font-semibold">{Math.round(Number(x.score))}%</span>}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ActivityView({ activity, back, onDone, nextId, goNext, dayNum }: { dayNum: number; activity: Activity; back: () => void; onDone: () => void; nextId?: string | undefined; goNext: (id: string) => void }) {
  const [finished, setFinished] = useState(activity.completed);
  const handle = () => {
    setFinished(true);
    onDone();
  };
  return (
    <div className="animate-rise">
      <button onClick={back} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Today's plan</button>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>{KIND_LABEL[activity.kind]}</span>·<span>~{activity.est_minutes} min</span><SourceBadge source={activity.source} /></div>
      <h1 className="mt-2 text-2xl font-semibold">{activity.title}</h1>
      {activity.description && <p className="mt-1 text-sm text-muted-foreground"><b className="text-foreground">Why:</b> {activity.description}</p>}
      <div className="mt-5">
        {activity.kind === "task" && <TaskPlayer activity={activity} onDone={handle} />}
        {activity.kind === "flashcards" && <FlashcardsPlayer key={activity.id} activity={activity} onDone={handle} singleRound={dayNum === 1 && isConjugationDeck(activity)} />}
        {activity.kind === "quiz" && <QuizPlayer key={activity.id} activity={activity} onDone={handle} passMark={dayNum === 1 ? MASTERY_PASS : undefined} />}
        {activity.kind === "listening" && <QuizPlayer key={activity.id} activity={activity} onDone={handle} listening />}
        {activity.kind === "dictation" && <DictationPlayer key={activity.id} activity={activity} onDone={handle} />}
        {activity.kind === "shadowing" && <ShadowingPlayer key={activity.id} activity={activity} onDone={handle} />}
        {activity.kind === "conversation" && <ConversationPlayer key={activity.id} activity={activity} onDone={handle} />}
      </div>
      {finished && (
        <div className="mt-6 grid gap-2">
          {nextId ? <Button size="lg" className="h-14 rounded-2xl" onClick={() => goNext(nextId)}>Next activity <ChevronRight className="h-4 w-4" /></Button> : null}
          <Button variant="outline" className="h-12 rounded-2xl" onClick={back}>Back to today's plan</Button>
        </div>
      )}
    </div>
  );
}

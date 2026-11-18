import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Play, Pause, RotateCcw, Check, ChevronRight, Volume2, Lightbulb, Ear, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { completeSimpleActivity } from "@/lib/coach.functions";
import { compareDictation, type WordMark } from "@/lib/dictation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { speechUrl } from "@/lib/voice";
import type { Activity } from "./players";

export type Sentence = { es: string; en: string; anchors: string[]; pitfalls: string[] };
export const SPEEDS = [0.75, 1, 1.25] as const;

/** Natural-voice audio player with play/pause, 5-second rewind and speed controls. */
export function AudioPlayer({ text, initialSpeed = 1, onSpeedChange, compact }: { text: string; initialSpeed?: number; onSpeedChange?: (s: number) => void; compact?: boolean }) {
  const { data: s } = useQuery({ queryKey: ["settings"], queryFn: async () => (await supabase.from("user_settings").select("*").maybeSingle()).data });
  const [speed, setSpeed] = useState(initialSpeed);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pct, setPct] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const accent = s?.voice_accent ?? "es-ES";
  const rate = (sp: number) => Number(s?.speech_rate ?? 1) * sp;

  useEffect(() => {
    setPlaying(false); setPct(0);
    const a = audioRef.current; audioRef.current = null;
    a?.pause();
    // preload so the first tap plays instantly
    speechUrl(text, accent).catch(() => {});
  }, [text, accent]);
  useEffect(() => () => audioRef.current?.pause(), []);

  async function ensure() {
    if (audioRef.current) return audioRef.current;
    setLoading(true);
    try {
      const a = new Audio(await speechUrl(text, accent));
      a.ontimeupdate = () => setPct(a.duration ? (a.currentTime / a.duration) * 100 : 0);
      a.onended = () => { setPlaying(false); setPct(100); };
      a.onpause = () => setPlaying(false);
      a.onplay = () => setPlaying(true);
      audioRef.current = a;
      return a;
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't load audio"); return null; }
    finally { setLoading(false); }
  }
  async function toggle() {
    const a = await ensure(); if (!a) return;
    if (!a.paused) { a.pause(); return; }
    if (a.ended) a.currentTime = 0;
    a.playbackRate = rate(speed);
    await a.play().catch(() => toast.error("Couldn't play audio"));
  }
  function rewind() { const a = audioRef.current; if (a) a.currentTime = Math.max(0, a.currentTime - 5); }
  function changeSpeed(sp: number) {
    setSpeed(sp); onSpeedChange?.(sp);
    if (audioRef.current) audioRef.current.playbackRate = rate(sp);
  }

  return (
    <div className={cn("rounded-3xl border bg-card p-4", compact && "p-3")}>
      <div className="flex items-center gap-2">
        <Button onClick={toggle} size="icon" className="h-12 w-12 shrink-0 rounded-full" aria-label={playing ? "Pause" : "Play"}>
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </Button>
        <Button onClick={rewind} variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-full" aria-label="Rewind 5 seconds">
          <span className="relative flex items-center justify-center"><RotateCcw className="h-5 w-5" /><span className="absolute text-[8px] font-bold">5</span></span>
        </Button>
        <div className="mx-1 h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex shrink-0 rounded-full bg-muted p-0.5">
          {SPEEDS.map((sp) => (
            <button key={sp} onClick={() => changeSpeed(sp)} className={cn("rounded-full px-2 py-1 text-xs font-semibold transition-colors", speed === sp ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}>
              {sp}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function useComplete(activity: Activity, onDone: () => void) {
  const complete = useServerFn(completeSimpleActivity);
  const [busy, setBusy] = useState(false);
  async function finish(answers: unknown, score: number | null) {
    setBusy(true);
    try { await complete({ data: { activityId: activity.id, answers, score } }); onDone(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't save"); }
    finally { setBusy(false); }
  }
  return { finish, busy };
}

function Stepper({ i, n }: { i: number; n: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: n }, (_, k) => <span key={k} className={cn("h-1.5 flex-1 rounded-full transition-colors duration-500", k < i ? "bg-success" : k === i ? "bg-primary" : "bg-muted")} />)}
    </div>
  );
}

const MARK_CLS: Record<WordMark["status"], string> = {
  ok: "bg-success/10 text-success",
  accent: "bg-accent/40 text-accent-foreground",
  typo: "bg-accent/40 text-accent-foreground underline decoration-wavy",
  missing: "bg-destructive/10 text-destructive line-through",
};

/* ---------- Module 1: Audio dictation ---------- */
type DictSave = { i: number; attempts: { es: string; typed: string; score: number }[] };
export function DictationPlayer({ activity, onDone }: { activity: Activity; onDone: () => void }) {
  const sentences = ((activity.content as { sentences?: Sentence[] }).sentences ?? []);
  const key = `progress:dict:${activity.id}`;
  const [st, setSt] = useState<DictSave>(() => {
    if (activity.completed) return { i: sentences.length, attempts: [] };
    try { return JSON.parse(localStorage.getItem(key) ?? "") as DictSave; } catch { return { i: 0, attempts: [] }; }
  });
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<ReturnType<typeof compareDictation> | null>(null);
  const { finish, busy } = useComplete(activity, onDone);
  useEffect(() => { if (!activity.completed) localStorage.setItem(key, JSON.stringify(st)); }, [st, key, activity.completed]);

  if (activity.completed || st.i >= sentences.length) {
    const avg = st.attempts.length ? Math.round(st.attempts.reduce((t, a) => t + a.score, 0) / st.attempts.length) : activity.score != null ? Math.round(Number(activity.score)) : null;
    return (
      <div className="animate-rise space-y-3 rounded-3xl bg-success/10 p-5 text-center">
        <Check className="mx-auto h-8 w-8 text-success" />
        <div className="text-lg font-semibold">Dictation complete{avg != null ? ` — ${avg}% accuracy` : ""}</div>
        {!activity.completed && <Button disabled={busy} className="h-12 w-full rounded-2xl" onClick={() => finish({ attempts: st.attempts }, avg).then(() => localStorage.removeItem(key))}>Save and finish</Button>}
      </div>
    );
  }
  const s = sentences[st.i]!;
  function check() {
    if (!typed.trim()) { toast.error("Type what you heard first"); return; }
    setResult(compareDictation(s.es, typed));
  }
  function next() {
    setSt((p) => ({ i: p.i + 1, attempts: [...p.attempts, { es: s.es, typed, score: result?.score ?? 0 }] }));
    setTyped(""); setResult(null);
  }
  return (
    <div className="space-y-4">
      <Stepper i={st.i} n={sentences.length} />
      <div className="text-xs font-medium text-muted-foreground">Sentence {st.i + 1} of {sentences.length} · listen, then type every word</div>
      <AudioPlayer text={s.es} />
      <Textarea value={typed} onChange={(e) => setTyped(e.target.value.slice(0, 500))} disabled={!!result} rows={3} placeholder="Escribe lo que oyes…" className="rounded-2xl text-base" lang="es" />
      {!result ? (
        <Button onClick={check} className="h-12 w-full rounded-2xl"><Check className="h-4 w-4" /> Check My Answer</Button>
      ) : (
        <div className="animate-rise space-y-3">
          <div className="rounded-3xl border bg-card p-4">
            <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Breakdown</span><span className="font-display text-2xl font-semibold">{result.score}%</span></div>
            <div className="flex flex-wrap gap-1.5 text-[15px]">
              {result.marks.map((m, k) => (
                <span key={k} className={cn("rounded-lg px-1.5 py-0.5", MARK_CLS[m.status])} title={m.heard ? `You wrote "${m.heard}"` : undefined}>{m.word}</span>
              ))}
            </div>
            {result.marks.some((m) => m.heard) && (
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                {result.marks.filter((m) => m.heard).map((m, k) => <li key={k}>You wrote <b className="text-foreground">{m.heard}</b> → <b className="text-foreground">{m.word}</b>{m.status === "accent" ? " (accent)" : " (spelling)"}</li>)}
              </ul>
            )}
            {result.marks.some((m) => m.status === "missing") && <p className="mt-2 text-sm text-muted-foreground">Missed: <b className="text-destructive">{result.marks.filter((m) => m.status === "missing").map((m) => m.word).join(", ")}</b></p>}
            {result.extra.length > 0 && <p className="mt-1 text-sm text-muted-foreground">Extra words: {result.extra.join(", ")}</p>}
            <p className="mt-3 text-sm italic text-muted-foreground">{s.en}</p>
          </div>
          {s.pitfalls.length > 0 && (
            <div className="rounded-3xl bg-muted p-4 text-sm">
              <div className="mb-1 flex items-center gap-1 font-semibold"><Ear className="h-4 w-4" /> Linked sounds & pitfalls</div>
              <ul className="list-disc space-y-0.5 pl-5">{s.pitfalls.map((p, k) => <li key={k}>{p}</li>)}</ul>
            </div>
          )}
          <Button onClick={next} className="h-12 w-full rounded-2xl">Next sentence <ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}
    </div>
  );
}

/* ---------- Module 3: Shadowing ---------- */
export function ShadowingPlayer({ activity, onDone }: { activity: Activity; onDone: () => void }) {
  const sentences = ((activity.content as { sentences?: Sentence[] }).sentences ?? []);
  const key = `progress:shadow:${activity.id}`;
  const [i, setI] = useState(() => (activity.completed ? sentences.length : Number(localStorage.getItem(key) ?? 0) || 0));
  const { finish, busy } = useComplete(activity, onDone);
  useEffect(() => { if (!activity.completed) localStorage.setItem(key, String(i)); }, [i, key, activity.completed]);

  if (activity.completed || i >= sentences.length) {
    return (
      <div className="animate-rise space-y-3 rounded-3xl bg-success/10 p-5 text-center">
        <Check className="mx-auto h-8 w-8 text-success" />
        <div className="text-lg font-semibold">Shadowing complete</div>
        {!activity.completed && <Button disabled={busy} className="h-12 w-full rounded-2xl" onClick={() => finish({ shadowed: sentences.length }, null).then(() => localStorage.removeItem(key))}>Save and finish</Button>}
      </div>
    );
  }
  const s = sentences[i]!;
  return (
    <div className="space-y-4">
      <Stepper i={i} n={sentences.length} />
      <div key={i} className="animate-rise space-y-3 rounded-3xl border bg-card p-5">
        <p className="font-display text-xl font-semibold leading-snug" lang="es">{s.es}</p>
        <p className="text-muted-foreground">{s.en}</p>
        {s.anchors.length > 0 && (
          <div className="flex flex-wrap gap-1.5">{s.anchors.map((w, k) => <span key={k} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">{w}</span>)}</div>
        )}
      </div>
      <AudioPlayer text={s.es} />
      <div className="flex items-start gap-2 rounded-2xl bg-muted p-3 text-sm text-muted-foreground">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Play it, then say it out loud right along with the voice. Match the rhythm and where the voice rises and falls. Repeat 2–3 times.</span>
      </div>
      <Button onClick={() => setI(i + 1)} className="h-12 w-full rounded-2xl"><Volume2 className="h-4 w-4" /> Completed</Button>
    </div>
  );
}

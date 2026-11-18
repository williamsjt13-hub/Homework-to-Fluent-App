import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X, Volume2, Pause, RotateCcw, Eye, Mic, Send, Loader2, Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { completeSimpleActivity, gradeActivity, startConversation, conversationTurn, endConversation } from "@/lib/coach.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { speechUrl, readySpeechUrl, prefetchSpeech } from "@/lib/voice";
import type { Database } from "@/integrations/supabase/types";
import { AudioPlayer } from "./listening";

export type Activity = Database["public"]["Tables"]["activities"]["Row"];
type Question = { id: string; type: string; prompt: string; options: string[]; answer: string; category: string; concept: string; source: string };
type Content = { instructions?: string; passage?: string; questions?: Question[]; cards?: { front: string; back: string }[]; scenario?: { setting: string; ai_role: string; student_role: string; opening_line: string; goals: string[] } };
type Result = { id: string; prompt: string; student_answer: string; correct: boolean; correct_answer: string; explanation: string; concept: string; category: string };

function useSpeechSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await supabase.from("user_settings").select("*").maybeSingle()).data,
  });
}

function useSpeaker() {
  const { data: s } = useSpeechSettings();
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const reqRef = useRef(0);
  useEffect(() => () => audioRef.current?.pause(), []);
  async function speak(text: string, rateMul = 1) {
    stop();
    const id = ++reqRef.current;
    setSpeaking(true);
    try {
      const accent = s?.voice_accent ?? "es-ES";
      // Play synchronously when the audio is already downloaded so phones don't block or delay it.
      const url = readySpeechUrl(text, accent) ?? (await speechUrl(text, accent));
      if (id !== reqRef.current) return;
      const a = new Audio(url);
      a.playbackRate = Number(s?.speech_rate ?? 1) * rateMul;
      a.onended = () => setSpeaking(false);
      a.onerror = () => setSpeaking(false);
      audioRef.current = a;
      await a.play();
    } catch (e) {
      if (id === reqRef.current) { setSpeaking(false); toast.error(e instanceof Error ? e.message : "Couldn't play audio"); }
    }
  }
  function stop() {
    reqRef.current++;
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeaking(false);
  }
  return { speak, stop, speaking };
}

/* ---------- Task (teacher homework) ---------- */
export function TaskPlayer({ activity, onDone }: { activity: Activity; onDone: () => void }) {
  const c = activity.content as Content;
  const [notes, setNotes] = useState((activity.answers as { notes?: string } | null)?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const complete = useServerFn(completeSimpleActivity);
  async function done() {
    setBusy(true);
    try {
      await complete({ data: { activityId: activity.id, answers: { notes } } });
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="whitespace-pre-wrap rounded-2xl bg-teacher/5 p-4 text-[15px] leading-relaxed">{c.instructions}</div>
      <Textarea placeholder="Optional: write your answers or notes here (saved to your history)" value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 5000))} rows={6} className="rounded-2xl" />
      <Button onClick={done} disabled={busy} className="h-12 w-full rounded-2xl"><Check className="h-4 w-4" /> {activity.completed ? "Save notes" : "Mark complete"}</Button>
    </div>
  );
}

/* ---------- Flashcards ---------- */
type FlashSave = { queue: number[]; round: number; firstMiss: number[]; retry: number[] };
function loadSave<T>(key: string): T | null {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : null; } catch { return null; }
}

export function FlashcardsPlayer({ activity, onDone, singleRound }: { activity: Activity; onDone: () => void; singleRound?: boolean }) {
  const cards = (activity.content as Content).cards ?? [];
  const saveKey = `progress:flash:${activity.id}`;
  const [saved] = useState(() => (activity.completed ? null : loadSave<FlashSave>(saveKey)));
  const valid = (arr?: number[]) => (arr ?? []).filter((n) => n >= 0 && n < cards.length);
  // Mastery loop: cards marked "still learning" go back into the queue until every card is known.
  const [queue, setQueue] = useState<number[]>(() => (activity.completed ? [] : saved && valid(saved.queue).length ? valid(saved.queue) : cards.map((_, idx) => idx)));
  const [round, setRound] = useState(saved?.round ?? 1);
  const [flipped, setFlipped] = useState(false);
  const [firstMiss, setFirstMiss] = useState<Set<number>>(new Set(valid(saved?.firstMiss)));
  const [retry, setRetry] = useState<number[]>(valid(saved?.retry));
  const [busy, setBusy] = useState(false);
  const [mastered, setMastered] = useState(false);
  const complete = useServerFn(completeSimpleActivity);
  const { speak } = useSpeaker();
  useEffect(() => {
    if (activity.completed || mastered) { localStorage.removeItem(saveKey); return; }
    if (!queue.length) return;
    localStorage.setItem(saveKey, JSON.stringify({ queue, round, firstMiss: [...firstMiss], retry } satisfies FlashSave));
  }, [queue, round, firstMiss, retry, mastered, activity.completed, saveKey]);
  const idx = queue[0];
  const card = idx != null ? cards[idx] : undefined;
  const knownCount = cards.length - queue.length - retry.length;
  const { data: speechSettings } = useSpeechSettings();
  // Download the answer audio for this card and the next two before they're flipped.
  useEffect(() => {
    prefetchSpeech(queue.slice(0, 3).map((n) => cards[n]?.back ?? ""), speechSettings?.voice_accent ?? "es-ES");
  }, [queue, cards, speechSettings?.voice_accent]);

  async function finish(misses: Set<number>) {
    setMastered(true);
    setBusy(true);
    try {
      const score = Math.round(((cards.length - misses.size) / Math.max(1, cards.length)) * 100);
      await complete({ data: { activityId: activity.id, answers: [...misses].map((m) => cards[m]?.back ?? ""), score } });
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
      setMastered(false);
    } finally {
      setBusy(false);
    }
  }

  function rate(knew: boolean) {
    if (idx == null) return;
    setFlipped(false);
    const misses = new Set(firstMiss);
    if (!knew && round === 1) misses.add(idx);
    setFirstMiss(misses);
    const nextRetry = knew ? retry : [...retry, idx];
    const rest = queue.slice(1);
    if (rest.length) { setQueue(rest); setRetry(nextRetry); return; }
    if (nextRetry.length && !singleRound) {
      toast(`Round ${round + 1}: ${nextRetry.length} card${nextRetry.length > 1 ? "s" : ""} to master`);
      setQueue([...nextRetry].sort(() => Math.random() - 0.5));
      setRetry([]);
      setRound(round + 1);
      return;
    }
    setQueue([]);
    setRetry([]);
    void finish(misses);
  }

  if (!cards.length) return <p className="text-muted-foreground">No cards.</p>;
  if (!card) {
    return (
      <div className="rounded-[2rem] border-2 border-success bg-success/10 p-8 text-center">
        <Check className="mx-auto h-10 w-10 text-success" />
        <div className="mt-3 font-display text-2xl font-semibold">Deck mastered</div>
        <p className="mt-1 text-sm text-muted-foreground">{activity.completed && !mastered ? "You've already mastered this deck." : `You knew ${cards.length - firstMiss.size} of ${cards.length} on the first try.`}</p>
        {activity.completed && !mastered && (
          <Button variant="outline" className="mt-4 rounded-2xl" onClick={() => { setQueue(cards.map((_, n) => n)); setRound(1); setFirstMiss(new Set()); }}><RotateCcw className="h-4 w-4" /> Review again</Button>
        )}
      </div>
    );
  }
  return (
    <div>
      <div className="mb-2 flex justify-between text-sm text-muted-foreground">
        <span>{round === 1 ? "First pass" : `Round ${round} · cards you missed`}</span>
        <span>{Math.max(0, knownCount)} / {cards.length} mastered</span>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-success transition-all" style={{ width: `${(Math.max(0, knownCount) / cards.length) * 100}%` }} /></div>
      <p className="mb-3 text-center text-xs text-muted-foreground">Say it out loud before flipping. Missed cards come back until you know them all.</p>
      <button onClick={() => { setFlipped(!flipped); if (!flipped) speak(card.back); }} className={cn("flex min-h-56 w-full flex-col items-center justify-center rounded-[2rem] border-2 p-8 text-center transition-colors", flipped ? "border-primary bg-primary/5" : "bg-card")}>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">{flipped ? "Spanish" : "Prompt"}</div>
        <div className="mt-3 font-display text-3xl font-semibold">{flipped ? card.back : card.front}</div>
        {!flipped && <div className="mt-4 text-sm text-muted-foreground">Tap to reveal</div>}
      </button>
      {flipped && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button variant="outline" disabled={busy} onClick={() => rate(false)} className="h-14 rounded-2xl"><X className="h-4 w-4" /> Still learning</Button>
          <Button disabled={busy} onClick={() => rate(true)} className="h-14 rounded-2xl"><Check className="h-4 w-4" /> I knew it</Button>
        </div>
      )}
    </div>
  );
}

/* ---------- Quiz / Listening ---------- */
export function QuizPlayer({ activity, onDone, listening, passMark }: { activity: Activity; onDone: () => void; listening?: boolean; passMark?: number | undefined }) {
  const c = activity.content as Content;
  const qs = c.questions ?? [];
  const quizKey = `progress:quiz:${activity.id}`;
  const [answers, setAnswers] = useState<Record<string, string>>(() => (activity.results ? {} : loadSave<Record<string, string>>(quizKey) ?? {}));
  useEffect(() => {
    if (Object.keys(answers).length) localStorage.setItem(quizKey, JSON.stringify(answers));
  }, [answers, quizKey]);
  const [results, setResults] = useState<Result[] | null>((activity.results as Result[] | null) ?? null);
  const [score, setScore] = useState<number | null>(activity.score != null ? Number(activity.score) : null);
  const [busy, setBusy] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const grade = useServerFn(gradeActivity);

  async function submit() {
    const missing = qs.filter((q) => !answers[q.id]?.trim()).length;
    if (missing && !confirm(`${missing} question(s) unanswered. Submit anyway?`)) return;
    setBusy(true);
    try {
      const r = await grade({ data: { activityId: activity.id, answers } });
      setResults(r.results);
      localStorage.removeItem(quizKey);
      setScore(r.score);
      window.scrollTo({ top: 0, behavior: "smooth" });
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Grading failed");
    } finally {
      setBusy(false);
    }
  }

  function retake() {
    const keep: Record<string, string> = {};
    for (const r of results ?? []) if (r.correct) keep[r.id] = r.student_answer;
    setAnswers(keep);
    setResults(null);
    setScore(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const resById = new Map((results ?? []).map((r) => [r.id, r]));

  return (
    <div className="space-y-4">
      {c.instructions && <p className="text-sm text-muted-foreground">{c.instructions}</p>}

      {score != null && (
        <div className="rounded-3xl bg-ink p-5 text-ink-foreground">
          <div className="text-xs uppercase tracking-widest text-accent">Your score</div>
          <div className="font-display text-5xl font-semibold">{score}%</div>
          <div className="text-sm text-ink-foreground/70">{(results ?? []).filter((r) => r.correct).length} of {qs.length} correct</div>
          {passMark != null && (score >= passMark ? (
            <div className="mt-3 rounded-2xl bg-success/20 p-3 text-sm"><b>Mastered!</b> You reached {passMark}%.</div>
          ) : (
            <div className="mt-3 space-y-2">
              <div className="rounded-2xl bg-ink-foreground/10 p-3 text-sm">You need {passMark}% to show mastery and unlock the next day. Review the corrections below (and the flashcards if needed), then try the questions you missed again.</div>
              <Button variant="secondary" className="w-full rounded-2xl" onClick={retake}><RotateCcw className="h-4 w-4" /> Retry missed questions</Button>
            </div>
          ))}
          {passMark == null && (results ?? []).some((r) => !r.correct) && (
            <div className="mt-3 space-y-2">
              <div className="rounded-2xl bg-ink-foreground/10 p-3 text-sm">You missed {(results ?? []).filter((r) => !r.correct).length} question{(results ?? []).filter((r) => !r.correct).length > 1 ? "s" : ""}. Review the corrections below, then try the ones you missed again to improve your score.</div>
              <Button variant="secondary" className="w-full rounded-2xl" onClick={retake}><RotateCcw className="h-4 w-4" /> Retry missed questions</Button>
            </div>
          )}
        </div>
      )}

      {listening && c.passage && (
        <div className="rounded-3xl border bg-card p-4">
          {(c as { speed_ladder?: boolean }).speed_ladder && (
            <p className="mb-3 text-sm text-muted-foreground">Start at <b className="text-foreground">0.75x</b>. Once you can answer Who, What, Where and When, step up to <b className="text-foreground">1.0x</b>, then <b className="text-foreground">1.25x</b>. Don't stop on words you don't know — catch the main idea.</p>
          )}
          <AudioPlayer text={c.passage} initialSpeed={(c as { speed_ladder?: boolean }).speed_ladder ? 0.75 : 1} compact />
          {results ? (
            <Button variant="ghost" className="mt-2 w-full" onClick={() => setShowTranscript(!showTranscript)}><Eye className="h-4 w-4" /> {showTranscript ? "Hide" : "Reveal"} transcript</Button>
          ) : (
            <p className="mt-2 text-center text-xs text-muted-foreground">Listen as many times as you like. The transcript unlocks after you submit.</p>
          )}
          {showTranscript && <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-muted p-4 leading-relaxed">{c.passage}</p>}
        </div>
      )}

      {!listening && c.passage && (
        <div className="rounded-3xl border bg-card p-5">
          <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Read</div>
          <p className="whitespace-pre-wrap leading-relaxed">{c.passage}</p>
        </div>
      )}

      {qs.map((q, idx) => {
        const r = resById.get(q.id);
        const val = r ? r.student_answer : answers[q.id] ?? "";
        const set = (v: string) => setAnswers((a) => ({ ...a, [q.id]: v.slice(0, 2000) }));
        return (
          <div key={q.id} className={cn("rounded-3xl border bg-card p-4", r && (r.correct ? "border-success/50" : "border-destructive/50"))}>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-xs font-semibold text-muted-foreground">{idx + 1}</span>
              <div className="flex-1">
                <div className="whitespace-pre-wrap font-medium">{q.prompt}</div>
                <div className="mt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">{q.type.replace("_", " ")} · {q.category}{q.source === "weakness" ? " · your weak spot" : ""}</div>
              </div>
            </div>
            <div className="mt-3">
              {q.options?.length ? (
                <div className="grid gap-2">
                  {q.options.map((o) => (
                    <button key={o} disabled={!!r} onClick={() => set(o)} className={cn("rounded-2xl border px-4 py-3 text-left text-[15px]", val === o ? "border-primary bg-primary/10 font-medium" : "bg-background", r && o === r.correct_answer && "border-success bg-success/10")}>
                      {o}
                    </button>
                  ))}
                </div>
              ) : q.type === "short" || q.type === "construct" || q.type === "translate" ? (
                <Textarea disabled={!!r} value={val} onChange={(e) => set(e.target.value)} rows={2} className="rounded-2xl" lang="es" autoCapitalize="off" />
              ) : (
                <Input disabled={!!r} value={val} onChange={(e) => set(e.target.value)} className="h-12 rounded-2xl" lang="es" autoCapitalize="off" autoCorrect="off" />
              )}
            </div>
            {r && (
              <div className={cn("mt-3 rounded-2xl p-3 text-sm", r.correct ? "bg-success/10" : "bg-destructive/10")}>
                <div className="flex items-center gap-1 font-semibold">{r.correct ? <><Check className="h-4 w-4 text-success" /> Correct</> : <><X className="h-4 w-4 text-destructive" /> Answer: {r.correct_answer}</>}</div>
                {r.explanation && <div className="mt-1 text-muted-foreground">{r.explanation}</div>}
              </div>
            )}
          </div>
        );
      })}

      {!results && (
        <Button onClick={submit} disabled={busy} size="lg" className="h-14 w-full rounded-2xl text-base">
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Checking your answers…</> : "Submit answers"}
        </Button>
      )}
    </div>
  );
}

/* ---------- Conversation ---------- */
type Msg = { role: "user" | "assistant"; text: string; hint?: string };
type Evaluation = { summary: string; overall: number; scores: Record<string, number>; pronunciation: string; errors: { student_text: string; correction: string; explanation: string }[]; strengths: string[]; suggestions: string[] };

type SR = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; onerror: () => void };

export function ConversationPlayer({ activity, onDone }: { activity: Activity; onDone: () => void }) {
  const scenario = (activity.content as Content).scenario;
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [ending, setEnding] = useState(false);
  const [listening, setListening] = useState(false);
  const [showHint, setShowHint] = useState<number | null>(null);
  const start = useServerFn(startConversation);
  const turn = useServerFn(conversationTurn);
  const end = useServerFn(endConversation);
  const { speak } = useSpeaker();
  const recRef = useRef<SR | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  useEffect(() => () => stopRef.current?.(), []);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    start({ data: { activityId: activity.id } })
      .then((s) => {
        setSessionId(s.id);
        setMessages((s.messages as Msg[]) ?? []);
        setEvaluation((s.evaluation as Evaluation | null) ?? null);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Couldn't start"));
  }, [activity.id, start]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send() {
    const t = text.trim();
    if (!t || !sessionId || busy) return;
    stopRef.current?.();
    setText("");
    setMessages((m) => [...m, { role: "user", text: t }]);
    setBusy(true);
    try {
      const r = await turn({ data: { sessionId, text: t } });
      setMessages(r.messages as Msg[]);
      const last = (r.messages as Msg[])[r.messages.length - 1];
      if (last?.role === "assistant") speak(last.text);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Message failed");
      setMessages((m) => m.slice(0, -1));
      setText(t);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function toggleMic() {
    const W = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) { toast.error("Voice input isn't supported on this browser — type instead, or use your keyboard's mic button."); return; }
    if (listening) { stopRef.current?.(); return; }
    // Keep listening through thinking pauses: only stop after SILENCE_MS with no new speech,
    // or when the learner taps the mic again. Browsers end sessions early, so we restart them.
    const SILENCE_MS = 20000;
    let active = true;
    let committed = text.trim();
    let silence: ReturnType<typeof setTimeout>;
    const stop = () => {
      active = false;
      clearTimeout(silence);
      recRef.current?.stop();
      setListening(false);
    };
    const armSilence = () => { clearTimeout(silence); silence = setTimeout(stop, SILENCE_MS); };
    stopRef.current = stop;
    const startRec = () => {
      const rec = new Ctor();
      rec.lang = "es-ES";
      rec.interimResults = true;
      rec.continuous = true;
      let segment = "";
      rec.onresult = (e) => {
        segment = Array.from(e.results).map((r) => r[0]?.transcript ?? "").join(" ").trim();
        setText([committed, segment].filter(Boolean).join(" "));
        armSilence();
      };
      rec.onend = () => {
        committed = [committed, segment].filter(Boolean).join(" ");
        if (active) { try { startRec(); } catch { stop(); } }
      };
      rec.onerror = () => {};
      recRef.current = rec;
      rec.start();
    };
    setListening(true);
    armSilence();
    startRec();
  }

  async function finish() {
    if (!sessionId) return;
    setEnding(true);
    try {
      const ev = await end({ data: { sessionId } });
      setEvaluation(ev as unknown as Evaluation);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't evaluate");
    } finally {
      setEnding(false);
    }
  }

  const userTurns = messages.filter((m) => m.role === "user").length;

  return (
    <div className="space-y-4">
      {scenario && (
        <div className="rounded-3xl bg-secondary p-4 text-sm text-secondary-foreground">
          <div className="font-semibold">{scenario.setting}</div>
          <div className="mt-1">AI plays: {scenario.ai_role} · You are: {scenario.student_role}</div>
          {scenario.goals?.length > 0 && <ul className="mt-2 list-disc pl-5">{scenario.goals.map((g, i) => <li key={i}>{g}</li>)}</ul>}
        </div>
      )}

      <div className="space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[85%]", m.role === "user" ? "rounded-3xl rounded-br-md bg-primary px-4 py-3 text-primary-foreground" : "py-1")}>
              <div className="text-[15px] leading-relaxed">{m.text}</div>
              {m.role === "assistant" && (
                <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                  <button onClick={() => speak(m.text)} className="flex items-center gap-1"><Volume2 className="h-3 w-3" /> Listen</button>
                  {m.hint && <button onClick={() => setShowHint(showHint === i ? null : i)} className="flex items-center gap-1"><Lightbulb className="h-3 w-3" /> English</button>}
                </div>
              )}
              {showHint === i && m.hint && <div className="mt-1 text-xs italic text-muted-foreground">{m.hint}</div>}
            </div>
          </div>
        ))}
        {busy && <div className="flex gap-1 py-2"><span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" /><span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:120ms]" /><span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:240ms]" /></div>}
        <div ref={bottomRef} />
      </div>

      {evaluation ? (
        <div className="space-y-3 rounded-3xl bg-ink p-5 text-ink-foreground">
          <div className="text-xs uppercase tracking-widest text-accent">Speaking evaluation</div>
          <div className="font-display text-5xl font-semibold">{Math.round(evaluation.overall)}%</div>
          <p className="text-sm text-ink-foreground/85">{evaluation.summary}</p>
          <div className="grid grid-cols-2 gap-2">{Object.entries(evaluation.scores).map(([k, v]) => <div key={k} className="rounded-2xl bg-ink-foreground/10 p-3"><div className="text-xs capitalize text-ink-foreground/70">{k}</div><div className="text-lg font-semibold">{Math.round(v)}%</div></div>)}</div>
          <div className="text-sm"><span className="font-semibold text-accent">Pronunciation: </span>{evaluation.pronunciation}</div>
          {evaluation.errors.length > 0 && (
            <div><div className="text-sm font-semibold text-accent">Errors</div>
              <ul className="mt-1 space-y-2 text-sm">{evaluation.errors.map((e, i) => <li key={i}><span className="line-through opacity-70">{e.student_text}</span> → <b>{e.correction}</b><div className="text-xs text-ink-foreground/70">{e.explanation}</div></li>)}</ul>
            </div>
          )}
          {evaluation.strengths.length > 0 && <div><div className="text-sm font-semibold text-accent">What went well</div><ul className="list-disc pl-5 text-sm">{evaluation.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
          {evaluation.suggestions.length > 0 && <div><div className="text-sm font-semibold text-accent">Try next time</div><ul className="list-disc pl-5 text-sm">{evaluation.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
        </div>
      ) : (
        <div className="sticky bottom-24 space-y-2 rounded-3xl border bg-card p-3 shadow-lg">
          <div className="flex items-end gap-2">
            <Button size="icon" variant={listening ? "default" : "outline"} onClick={toggleMic} className="h-12 w-12 shrink-0 rounded-2xl" aria-label="Speak"><Mic className={cn("h-5 w-5", listening && "animate-pulse")} /></Button>
            <Textarea ref={inputRef} autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={listening ? "Escuchando…" : "Responde en español…"} rows={1} className="min-h-12 resize-none rounded-2xl" lang="es" />
            <Button size="icon" onClick={send} disabled={!text.trim() || busy} className="h-12 w-12 shrink-0 rounded-2xl" aria-label="Send"><Send className="h-5 w-5" /></Button>
          </div>
          {userTurns >= 3 && (
            <Button variant="secondary" onClick={finish} disabled={ending} className="h-11 w-full rounded-2xl">{ending ? "Evaluating…" : "End conversation & get feedback"}</Button>
          )}
          {userTurns < 3 && <p className="text-center text-xs text-muted-foreground">Keep talking — feedback unlocks after a few exchanges. Aim for 10+.</p>}
        </div>
      )}
    </div>
  );
}

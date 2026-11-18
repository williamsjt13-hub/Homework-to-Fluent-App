import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, AlertCircle, Loader2, Check } from "lucide-react";
import { lessonQuery } from "@/lib/queries";
import { confirmLesson, generateDay } from "@/lib/coach.functions";
import { CATEGORIES } from "@/lib/languages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageTitle, SourceBadge } from "@/components/coach/bits";

export const Route = createFileRoute("/_authenticated/lessons/$id/review")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Here's what I found — Weekly Language Coach" },
      { name: "description", content: "Review and confirm the lesson extracted from your homework." },
      { property: "og:title", content: "Here's what I found — Weekly Language Coach" },
      { property: "og:description", content: "Review and confirm the lesson extracted from your homework." },
    ],
  }),
  component: ReviewPage,
});

type Ex = {
  topic: string;
  vocabulary: { term: string; translation: string; uncertain?: boolean }[];
  grammar: string[];
  conjugations: string[];
  phrases: { phrase: string; translation: string }[];
  examples: string[];
  homework: string[];
  readings: string[];
  instructions: string[];
  objectives: string[];
  student_answers: { prompt: string; answer: string }[];
  corrections: { student_text: string; corrected_text: string; concept: string; category: string; uncertain?: boolean }[];
  weaknesses: { concept: string; category: string; reason: string }[];
  uncertain: { text: string; note: string }[];
};

const EMPTY: Ex = { topic: "", vocabulary: [], grammar: [], conjugations: [], phrases: [], examples: [], homework: [], readings: [], instructions: [], objectives: [], student_answers: [], corrections: [], weaknesses: [], uncertain: [] };

function Section({ title, source, count, children, onAdd }: { title: string; source: string; count?: number; children: React.ReactNode; onAdd?: () => void }) {
  return (
    <section className="rounded-3xl border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">{title}{count != null && <span className="ml-2 text-sm font-normal text-muted-foreground">{count}</span>}</h2>
        <SourceBadge source={source} />
      </div>
      <div className="mt-4 space-y-2">{children}</div>
      {onAdd && (
        <Button variant="ghost" size="sm" className="mt-2 text-primary" onClick={onAdd}><Plus className="h-4 w-4" /> Add</Button>
      )}
    </section>
  );
}

function StringList({ items, onChange, multiline }: { items: string[]; onChange: (v: string[]) => void; multiline?: boolean }) {
  return (
    <>
      {items.map((it, i) => (
        <div key={i} className="flex gap-2">
          {multiline ? (
            <Textarea value={it} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} className="rounded-xl" rows={2} />
          ) : (
            <Input value={it} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} className="h-11 rounded-xl" />
          )}
          <Button size="icon" variant="ghost" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      {!items.length && <p className="text-sm text-muted-foreground">Nothing found.</p>}
    </>
  );
}

function ReviewPage() {
  const { id } = Route.useParams();
  const { data } = useQuery(lessonQuery(id));
  const [ex, setEx] = useState<Ex | null>(null);
  const [busy, setBusy] = useState(false);
  const confirm = useServerFn(confirmLesson);
  const genDay = useServerFn(generateDay);
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (data?.lesson && !ex) setEx({ ...EMPTY, ...((data.lesson.extracted as Partial<Ex>) ?? {}) });
  }, [data, ex]);

  if (!ex) return <div className="py-20 text-center text-muted-foreground">Loading…</div>;
  const set = <K extends keyof Ex>(k: K, v: Ex[K]) => setEx({ ...ex, [k]: v });

  async function build() {
    if (!ex) return;
    setBusy(true);
    try {
      const clean = { ...ex, uncertain: [] };
      await confirm({ data: { lessonId: id, extracted: clean } });
      const fresh = await qc.fetchQuery({ ...lessonQuery(id), staleTime: 0 });
      const d1 = fresh.days.find((d) => d.day_number === 1);
      if (d1) await genDay({ data: { dayId: d1.id } });
      await qc.invalidateQueries();
      navigate({ to: "/lessons/$id", params: { id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't build your week");
      setBusy(false);
    }
  }

  if (busy) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <h2 className="mt-6 text-2xl font-semibold">Building your week…</h2>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">Designing Day 1 from your teacher's material and your weak spots. About a minute.</p>
      </div>
    );
  }

  return (
    <div className="animate-rise space-y-4 pb-24">
      <PageTitle eyebrow="Step 2" title="Here's What I Found">Check everything. Edit, delete or add anything — your week is built only from what you confirm.</PageTitle>

      {ex.uncertain.length > 0 && (
        <section className="rounded-3xl border-2 border-accent bg-accent/15 p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><AlertCircle className="h-5 w-5" /> Please confirm</h2>
          <p className="text-sm text-muted-foreground">I'm not completely sure what these say. Correct them, then tap ✓ — or delete them.</p>
          <div className="mt-3 space-y-3">
            {ex.uncertain.map((u, i) => (
              <div key={i} className="rounded-2xl bg-card p-3">
                <div className="text-xs text-muted-foreground">{u.note}</div>
                <div className="mt-2 flex gap-2">
                  <Input value={u.text} onChange={(e) => set("uncertain", ex.uncertain.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} className="h-11 rounded-xl" />
                  <Button size="icon" variant="outline" aria-label="Confirm" onClick={() => setEx({ ...ex, uncertain: ex.uncertain.filter((_, j) => j !== i), examples: [...ex.examples, u.text] })}><Check className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => set("uncertain", ex.uncertain.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <Section title="Weekly Topic" source="teacher">
        <Input value={ex.topic} onChange={(e) => set("topic", e.target.value)} className="h-12 rounded-xl text-lg font-semibold" />
      </Section>

      <Section title="Vocabulary" source="teacher" count={ex.vocabulary.length} onAdd={() => set("vocabulary", [...ex.vocabulary, { term: "", translation: "" }])}>
        {ex.vocabulary.map((v, i) => (
          <div key={i} className={`flex gap-2 ${v.uncertain ? "rounded-xl ring-2 ring-accent" : ""}`}>
            <Input placeholder="Spanish" value={v.term} onChange={(e) => set("vocabulary", ex.vocabulary.map((x, j) => (j === i ? { ...x, term: e.target.value, uncertain: false } : x)))} className="h-11 rounded-xl" />
            <Input placeholder="English" value={v.translation} onChange={(e) => set("vocabulary", ex.vocabulary.map((x, j) => (j === i ? { ...x, translation: e.target.value } : x)))} className="h-11 rounded-xl" />
            <Button size="icon" variant="ghost" onClick={() => set("vocabulary", ex.vocabulary.filter((_, j) => j !== i))} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </Section>

      <Section title="Grammar" source="teacher" count={ex.grammar.length} onAdd={() => set("grammar", [...ex.grammar, ""])}>
        <StringList items={ex.grammar} onChange={(v) => set("grammar", v)} multiline />
      </Section>

      <Section title="Verb Conjugations" source="teacher" count={ex.conjugations.length} onAdd={() => set("conjugations", [...ex.conjugations, ""])}>
        <StringList items={ex.conjugations} onChange={(v) => set("conjugations", v)} />
      </Section>

      <Section title="Homework" source="teacher" count={ex.homework.length} onAdd={() => set("homework", [...ex.homework, ""])}>
        <StringList items={ex.homework} onChange={(v) => set("homework", v)} multiline />
      </Section>

      <Section title="Important Phrases" source="teacher" count={ex.phrases.length} onAdd={() => set("phrases", [...ex.phrases, { phrase: "", translation: "" }])}>
        {ex.phrases.map((p, i) => (
          <div key={i} className="flex gap-2">
            <Input placeholder="Spanish" value={p.phrase} onChange={(e) => set("phrases", ex.phrases.map((x, j) => (j === i ? { ...x, phrase: e.target.value } : x)))} className="h-11 rounded-xl" />
            <Input placeholder="English" value={p.translation} onChange={(e) => set("phrases", ex.phrases.map((x, j) => (j === i ? { ...x, translation: e.target.value } : x)))} className="h-11 rounded-xl" />
            <Button size="icon" variant="ghost" onClick={() => set("phrases", ex.phrases.filter((_, j) => j !== i))} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </Section>

      <Section title="Teacher Corrections" source="teacher" count={ex.corrections.length} onAdd={() => set("corrections", [...ex.corrections, { student_text: "", corrected_text: "", concept: "", category: "grammar" }])}>
        {ex.corrections.map((c, i) => {
          const upd = (patch: Partial<Ex["corrections"][number]>) => set("corrections", ex.corrections.map((x, j) => (j === i ? { ...x, ...patch, uncertain: false } : x)));
          return (
            <div key={i} className={`space-y-2 rounded-2xl bg-muted/60 p-3 ${c.uncertain ? "ring-2 ring-accent" : ""}`}>
              {c.uncertain && <div className="text-xs font-medium">I'm not completely sure what this says. Please confirm.</div>}
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="You wrote" value={c.student_text} onChange={(e) => upd({ student_text: e.target.value })} className="h-11 rounded-xl text-destructive" />
                <Input placeholder="Correct" value={c.corrected_text} onChange={(e) => upd({ corrected_text: e.target.value })} className="h-11 rounded-xl text-success" />
              </div>
              <div className="flex gap-2">
                <Input placeholder="Concept (e.g. saber — present)" value={c.concept} onChange={(e) => upd({ concept: e.target.value })} className="h-11 rounded-xl" />
                <select value={c.category} onChange={(e) => upd({ category: e.target.value })} className="h-11 rounded-xl border bg-card px-2 text-sm">
                  {CATEGORIES.map((k) => <option key={k} value={k}>{k.replace("_", " ")}</option>)}
                </select>
                <Button size="icon" variant="ghost" onClick={() => set("corrections", ex.corrections.filter((_, j) => j !== i))} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          );
        })}
      </Section>

      <Section title="Things You Need to Work On" source="weakness" count={ex.weaknesses.length} onAdd={() => set("weaknesses", [...ex.weaknesses, { concept: "", category: "grammar", reason: "" }])}>
        {ex.weaknesses.map((w, i) => (
          <div key={i} className="space-y-2 rounded-2xl bg-muted/60 p-3">
            <div className="flex gap-2">
              <Input value={w.concept} onChange={(e) => set("weaknesses", ex.weaknesses.map((x, j) => (j === i ? { ...x, concept: e.target.value } : x)))} className="h-11 rounded-xl font-medium" />
              <Button size="icon" variant="ghost" onClick={() => set("weaknesses", ex.weaknesses.filter((_, j) => j !== i))} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
            </div>
            {w.reason && <p className="text-xs text-muted-foreground">{w.reason}</p>}
          </div>
        ))}
      </Section>

      <Section title="Learning Objectives" source="teacher" count={ex.objectives.length} onAdd={() => set("objectives", [...ex.objectives, ""])}>
        <StringList items={ex.objectives} onChange={(v) => set("objectives", v)} />
      </Section>

      {(ex.examples.length > 0 || ex.instructions.length > 0 || ex.readings.length > 0) && (
        <Section title="Other material" source="teacher">
          {ex.instructions.length > 0 && <><div className="text-sm font-semibold">Teacher instructions</div><StringList items={ex.instructions} onChange={(v) => set("instructions", v)} /></>}
          {ex.examples.length > 0 && <><div className="pt-2 text-sm font-semibold">Example sentences</div><StringList items={ex.examples} onChange={(v) => set("examples", v)} /></>}
          {ex.readings.length > 0 && <><div className="pt-2 text-sm font-semibold">Reading passages</div><StringList items={ex.readings} onChange={(v) => set("readings", v)} multiline /></>}
        </Section>
      )}

      <div className="fixed inset-x-0 bottom-20 z-30 px-5">
        <div className="mx-auto max-w-2xl">
          <Button onClick={build} size="lg" className="h-14 w-full rounded-2xl text-base shadow-xl shadow-primary/30">
            Confirm &amp; Build My Week
          </Button>
        </div>
      </div>
    </div>
  );
}

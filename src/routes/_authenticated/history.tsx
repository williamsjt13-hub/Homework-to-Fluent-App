import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageTitle, scoreColor } from "@/components/coach/bits";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Weekly history — Weekly Language Coach" },
      { name: "description", content: "Every week you've studied, with scores and original homework." },
      { property: "og:title", content: "Weekly history — Weekly Language Coach" },
      { property: "og:description", content: "Every week you've studied, with scores and original homework." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { data } = useQuery({
    queryKey: ["history"],
    queryFn: async () => {
      const { data: lessons } = await supabase.from("weekly_lessons").select("*").order("created_at", { ascending: false });
      const { data: days } = await supabase.from("study_days").select("lesson_id, day_number, score, minutes_completed");
      const { data: assess } = await supabase.from("weekly_assessments").select("lesson_id, total_score");
      return { lessons: lessons ?? [], days: days ?? [], assess: assess ?? [] };
    },
  });

  return (
    <div className="animate-rise">
      <PageTitle eyebrow="History" title="Your weeks" />
      <div className="space-y-3">
        {data?.lessons.map((l) => {
          const ds = data.days.filter((d) => d.lesson_id === l.id).sort((a, b) => a.day_number - b.day_number);
          const mins = ds.reduce((a, d) => a + d.minutes_completed, 0);
          const exam = data.assess.find((a) => a.lesson_id === l.id);
          const to = l.status === "analyzed" || l.status === "uploaded" ? "/lessons/$id/review" : "/lessons/$id";
          return (
            <Link key={l.id} to={to} params={{ id: l.id }} className="block rounded-3xl border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">{new Date(l.week_start).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} · {mins} min</div>
                  <div className="mt-1 text-lg font-semibold">{l.topic || "Untitled lesson"}</div>
                  <div className="text-xs capitalize text-muted-foreground">{l.status === "planned" ? "in progress" : l.status === "analyzed" ? "needs review" : l.status}</div>
                </div>
                <div className="text-right">
                  <div className={`font-display text-2xl font-semibold ${scoreColor(l.overall_score == null ? null : Number(l.overall_score))}`}>{l.overall_score != null ? `${Math.round(Number(l.overall_score))}%` : "—"}</div>
                  <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              {ds.length > 0 && (
                <div className="mt-3 grid grid-cols-5 gap-1.5 text-center text-xs">
                  {ds.map((d) => (
                    <div key={d.day_number} className="rounded-xl bg-muted py-2">
                      <div className="text-muted-foreground">{d.day_number === 4 ? "Speak" : d.day_number === 5 ? "Exam" : `D${d.day_number}`}</div>
                      <div className="font-semibold">{d.day_number === 5 && exam ? `${Math.round(Number(exam.total_score))}%` : d.score != null ? `${Math.round(Number(d.score))}%` : "—"}</div>
                    </div>
                  ))}
                </div>
              )}
            </Link>
          );
        })}
        {data && !data.lessons.length && (
          <p className="text-muted-foreground">No weeks yet. <Link to="/scan" className="text-primary underline">Scan your first homework</Link>.</p>
        )}
      </div>
    </div>
  );
}

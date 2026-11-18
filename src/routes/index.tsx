import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Camera, CheckCircle2, CalendarDays, MessagesSquare, GraduationCap } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Weekly Language Coach — your teacher's homework, turned into a study week" },
      { name: "description", content: "Scan your Spanish homework. AI builds a personalized 5-day, 60-minute-a-day study plan from your teacher's actual material." },
      { property: "og:title", content: "Weekly Language Coach" },
      { property: "og:description", content: "Scan your Spanish homework and get a personalized 5-day study plan built from your teacher's material." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const steps = [
  { icon: Camera, title: "Scan this week's homework", text: "Snap every page — notes, worksheets, corrected homework." },
  { icon: CheckCircle2, title: "Confirm what AI found", text: "Vocabulary, grammar, corrections and weak spots — all editable." },
  { icon: CalendarDays, title: "Study 60 minutes a day", text: "Recall, listening, grammar, conversation, Friday exam." },
  { icon: MessagesSquare, title: "Speak with an AI partner", text: "Role-play built around the week's topic." },
];

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && user) navigate({ to: "/home" });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-xl px-6 pb-16 pt-10">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <GraduationCap className="h-5 w-5 text-primary" /> Weekly Language Coach
        </div>
        <h1 className="mt-12 text-5xl font-semibold leading-[1.05]">
          Your teacher's homework, <em className="text-primary">turned into a week</em> of study.
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Scan what your Spanish teacher gave you. We build a personalized 5-day plan — at least 60 minutes a day — from that exact material, and remember what you struggle with.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="h-14 rounded-2xl text-base">
            <Link to="/auth" search={{ mode: "signup" }}>Create free account</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-14 rounded-2xl text-base">
            <Link to="/auth" search={{ mode: "login" }}>I have an account</Link>
          </Button>
        </div>
        <ol className="mt-14 space-y-3">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-4 rounded-3xl border bg-card p-5 animate-rise" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">{s.title}</div>
                <div className="text-sm text-muted-foreground">{s.text}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

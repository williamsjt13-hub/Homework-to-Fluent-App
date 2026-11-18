import { cn } from "@/lib/utils";
import { BookOpen, Bot, AlertTriangle, Lightbulb } from "lucide-react";

export function ProgressRing({ value, size = 120, stroke = 10, children }: { value: number; size?: number; stroke?: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="fill-none stroke-primary transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

const SOURCES = {
  teacher: { label: "Teacher material", icon: BookOpen, cls: "bg-teacher/10 text-teacher" },
  ai: { label: "AI practice", icon: Bot, cls: "bg-accent/40 text-accent-foreground" },
  weakness: { label: "Your weak spot", icon: AlertTriangle, cls: "bg-destructive/10 text-destructive" },
  recommendation: { label: "AI recommendation", icon: Lightbulb, cls: "bg-secondary text-secondary-foreground" },
} as const;

export function SourceBadge({ source, className }: { source: string; className?: string }) {
  const s = SOURCES[source as keyof typeof SOURCES] ?? SOURCES.ai;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", s.cls, className)}>
      <s.icon className="h-3 w-3" />
      {s.label}
    </span>
  );
}

export function PageTitle({ eyebrow, title, children }: { eyebrow?: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-6">
      {eyebrow && <div className="text-xs font-semibold uppercase tracking-widest text-primary">{eyebrow}</div>}
      <h1 className="mt-1 text-3xl font-semibold leading-tight sm:text-4xl">{title}</h1>
      {children && <div className="mt-2 text-muted-foreground">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-3xl border bg-card p-4">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function scoreColor(n: number | null | undefined) {
  if (n == null) return "text-muted-foreground";
  if (n >= 85) return "text-success";
  if (n >= 65) return "text-accent-foreground";
  return "text-destructive";
}

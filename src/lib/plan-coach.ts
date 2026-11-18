import { z } from "zod";

export const additionSchema = z
  .object({
    day: z.number().int().min(1).max(5),
    kind: z.enum(["flashcards", "listening", "conversation", "quiz"]),
    minutes: z.number().int().min(3).max(60),
    focus: z.string().min(1).max(400),
  })
  .strict();
export const removalSchema = z
  .object({ activity_id: z.string().uuid(), title: z.string().max(200) })
  .strict();
export const changeSchema = z
  .object({
    activity_id: z.string().uuid(),
    title: z.string().max(200),
    minutes: z.number().int().min(3).max(60),
  })
  .strict();
export const proposalSchema = z
  .object({
    summary: z.string().min(1).max(800),
    additions: z.array(additionSchema).max(10).default([]),
    removals: z.array(removalSchema).max(20).default([]),
    changes: z.array(changeSchema).max(20).default([]),
  })
  .strict()
  .refine((p) => p.additions.length + p.removals.length + p.changes.length > 0, {
    message: "A plan change needs at least one addition, removal or change.",
  });
// Tool input: every field required (strict tool schemas reject optional fields).
export const proposalToolSchema = z
  .object({
    summary: z.string().min(1).max(800),
    additions: z.array(additionSchema).max(10),
    removals: z.array(removalSchema).max(20),
    changes: z.array(changeSchema).max(20),
  })
  .strict();
export type PlanRemoval = z.infer<typeof removalSchema>;
export type PlanChange = z.infer<typeof changeSchema>;
export type PlanAddition = z.infer<typeof additionSchema>;

export function originalDayMastered(
  day: number,
  activities: {
    completed: boolean;
    kind: string;
    score: number | null;
    plan_added: boolean;
    removed_at?: string | null;
  }[],
  pass: number,
) {
  // Removed activities no longer count toward finishing the day.
  const original = activities.filter((a) => !a.plan_added && !a.removed_at);
  return (
    original.length > 0 &&
    original.every((a) => a.completed) &&
    (day !== 1 ||
      original.filter((a) => a.kind === "quiz").every((a) => Number(a.score ?? 0) >= pass))
  );
}

export function addedMinutes(day: number, additions: PlanAddition[]) {
  return additions.filter((a) => a.day === day).reduce((sum, a) => sum + a.minutes, 0);
}

export function validateGeneratedAdditions(
  activities: { kind: string; content: Record<string, unknown> }[],
  additions: PlanAddition[],
) {
  if (!additions.length) return [];
  if (activities.length !== additions.length)
    throw new Error("The coach couldn't prepare every requested activity. Nothing was changed.");
  return activities.map((activity, index) => {
    const addition = additions[index];
    if (!addition || activity.kind !== addition.kind)
      throw new Error("The activity did not match your request. Nothing was changed.");
    const content = activity.content;
    if (
      addition.kind === "flashcards" &&
      (!Array.isArray(content["cards"]) || !content["cards"].length)
    )
      throw new Error("The flashcard deck was empty. Nothing was changed.");
    if (
      addition.kind === "listening" &&
      (!content["passage"] || !Array.isArray(content["questions"]) || !content["questions"].length)
    )
      throw new Error("The listening exercise was incomplete. Nothing was changed.");
    if (
      addition.kind === "quiz" &&
      (!Array.isArray(content["questions"]) || !content["questions"].length)
    )
      throw new Error("The quiz was empty. Nothing was changed.");
    if (
      addition.kind === "conversation" &&
      !(content["scenario"] as { opening_line?: string } | undefined)?.opening_line
    )
      throw new Error("The conversation was incomplete. Nothing was changed.");
    return { ...activity, day: addition.day, est_minutes: addition.minutes };
  });
}

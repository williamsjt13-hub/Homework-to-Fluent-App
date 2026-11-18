import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

async function unwrap<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as NonNullable<T>;
}

export const lessonsQuery = () =>
  queryOptions({
    queryKey: ["lessons"],
    queryFn: () => unwrap(supabase.from("weekly_lessons").select("*").order("created_at", { ascending: false })),
  });

export const lessonQuery = (id: string) =>
  queryOptions({
    queryKey: ["lesson", id],
    queryFn: async () => {
      const lesson = await unwrap(supabase.from("weekly_lessons").select("*").eq("id", id).single());
      const days = await unwrap(supabase.from("study_days").select("*").eq("lesson_id", id).order("day_number"));
      const docs = await unwrap(supabase.from("uploaded_documents").select("*").eq("lesson_id", id).order("page_order"));
      const assessment = (await supabase.from("weekly_assessments").select("*").eq("lesson_id", id).maybeSingle()).data;
      return { lesson, days, docs, assessment };
    },
  });

export const dayQuery = (lessonId: string, dayNumber: number) =>
  queryOptions({
    queryKey: ["day", lessonId, dayNumber],
    queryFn: async () => {
      const day = await unwrap(supabase.from("study_days").select("*").eq("lesson_id", lessonId).eq("day_number", dayNumber).single());
      const activities = await unwrap(supabase.from("activities").select("*").eq("day_id", day.id).order("position"));
      return { day, activities };
    },
  });

export const statsQuery = () =>
  queryOptions({
    queryKey: ["stats"],
    queryFn: async () => {
      const sessions = await unwrap(supabase.from("study_sessions").select("minutes, study_date, created_at").order("created_at"));
      const mistakes = await unwrap(supabase.from("student_mistakes").select("*").order("created_at", { ascending: false }).limit(200));
      const vocab = await unwrap(supabase.from("vocabulary").select("id, term, translation, times_missed, lesson_id"));
      const assessments = await unwrap(supabase.from("weekly_assessments").select("*").order("created_at"));
      const days = await unwrap(supabase.from("study_days").select("lesson_id, day_number, score, minutes_completed"));
      return { sessions, mistakes, vocab, assessments, days };
    },
  });

export function localDate(d = new Date()) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

export function computeStreak(dates: string[]) {
  const set = new Set(dates);
  let streak = 0;
  const d = new Date();
  if (!set.has(localDate(d))) d.setDate(d.getDate() - 1); // today not yet studied doesn't break streak
  while (set.has(localDate(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const planCoachQuery = (lessonId: string) =>
  queryOptions({
    queryKey: ["plan-coach", lessonId],
    queryFn: async () => {
      const [threads, original, additions, proposals, removed] = await Promise.all([
        supabase
          .from("plan_coach_threads")
          .select("*")
          .eq("lesson_id", lessonId)
          .order("updated_at", { ascending: false }),
        supabase.from("weekly_plan_originals").select("*").eq("lesson_id", lessonId).maybeSingle(),
        supabase
          .from("activities")
          .select("id,day_id,title,kind,est_minutes,completed")
          .eq("lesson_id", lessonId)
          .eq("plan_added", true)
          .is("removed_at", null)
          .order("position"),
        supabase
          .from("plan_coach_proposals")
          .select("*")
          .eq("lesson_id", lessonId)
          .order("created_at", { ascending: false }),
        supabase
          .from("activities")
          .select("id,day_id,title,est_minutes")
          .eq("lesson_id", lessonId)
          .not("removed_at", "is", null),
      ]);
      for (const result of [threads, original, additions, proposals, removed])
        if (result.error) throw new Error(result.error.message);
      return {
        threads: threads.data ?? [],
        original: original.data,
        additions: additions.data ?? [],
        proposals: proposals.data ?? [],
        removed: removed.data ?? [],
      };
    },
  });

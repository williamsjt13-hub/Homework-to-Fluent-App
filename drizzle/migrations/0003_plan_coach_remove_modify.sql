ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS removed_at timestamptz;
ALTER TABLE public.plan_coach_proposals ADD COLUMN IF NOT EXISTS removals jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.plan_coach_proposals ADD COLUMN IF NOT EXISTS changes jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.apply_plan_coach_proposal(proposal_id uuid, generated jsonb) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE p public.plan_coach_proposals; a jsonb; d public.study_days; act public.activities; next_position integer; new_minutes integer;
BEGIN
 SELECT * INTO p FROM public.plan_coach_proposals WHERE id = proposal_id AND user_id = auth.uid() FOR UPDATE;
 IF p.id IS NULL THEN RAISE EXCEPTION 'Plan change not found'; END IF;
 IF p.status = 'applied' THEN RETURN; END IF;
 PERFORM 1 FROM public.weekly_lessons WHERE id = p.lesson_id AND user_id = auth.uid() AND status IN ('planned', 'active') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Only an active study plan can be changed'; END IF;
 IF jsonb_array_length(generated) > 10 OR jsonb_array_length(generated) <> jsonb_array_length(p.additions) THEN RAISE EXCEPTION 'Invalid activities'; END IF;
 IF jsonb_array_length(generated) + jsonb_array_length(p.removals) + jsonb_array_length(p.changes) = 0 THEN RAISE EXCEPTION 'Nothing to change'; END IF;

 FOR a IN SELECT value FROM jsonb_array_elements(p.removals) LOOP
  SELECT * INTO act FROM public.activities WHERE id = (a->>'activity_id')::uuid AND lesson_id = p.lesson_id AND user_id = auth.uid() AND removed_at IS NULL FOR UPDATE;
  IF act.id IS NULL THEN RAISE EXCEPTION 'An activity to remove was not found'; END IF;
  IF act.completed THEN RAISE EXCEPTION 'Completed activities cannot be removed'; END IF;
  SELECT * INTO d FROM public.study_days WHERE id = act.day_id FOR UPDATE;
  IF d.day_number = 1 AND NOT act.plan_added AND (act.kind = 'quiz' OR act.title ~* 'conjugat|foundation') THEN RAISE EXCEPTION 'The Day 1 foundation deck and mastery check must stay'; END IF;
  UPDATE public.activities SET removed_at = now() WHERE id = act.id;
  UPDATE public.study_days SET target_minutes = greatest(60, target_minutes - act.est_minutes) WHERE id = d.id;
 END LOOP;

 FOR a IN SELECT value FROM jsonb_array_elements(p.changes) LOOP
  SELECT * INTO act FROM public.activities WHERE id = (a->>'activity_id')::uuid AND lesson_id = p.lesson_id AND user_id = auth.uid() AND removed_at IS NULL FOR UPDATE;
  IF act.id IS NULL THEN RAISE EXCEPTION 'An activity to change was not found'; END IF;
  IF act.completed THEN RAISE EXCEPTION 'Completed activities cannot be changed'; END IF;
  new_minutes := (a->>'minutes')::integer;
  IF new_minutes NOT BETWEEN 3 AND 60 THEN RAISE EXCEPTION 'Invalid minutes'; END IF;
  UPDATE public.activities SET est_minutes = new_minutes WHERE id = act.id;
  UPDATE public.study_days SET target_minutes = greatest(60, target_minutes + new_minutes - act.est_minutes) WHERE id = act.day_id;
 END LOOP;

 FOR a IN SELECT value FROM jsonb_array_elements(generated) LOOP
  SELECT * INTO d FROM public.study_days WHERE lesson_id = p.lesson_id AND user_id = auth.uid() AND day_number = (a->>'day')::integer FOR UPDATE;
  IF d.id IS NULL THEN RAISE EXCEPTION 'Study day not found'; END IF;
  IF (a->>'kind') NOT IN ('flashcards', 'listening', 'conversation', 'quiz') OR (a->>'est_minutes')::integer NOT BETWEEN 3 AND 60 THEN RAISE EXCEPTION 'Invalid activity'; END IF;
  SELECT greatest(1000, coalesce(max(position) + 1, 1000)) INTO next_position FROM public.activities WHERE day_id = d.id;
  INSERT INTO public.activities(user_id, lesson_id, day_id, position, kind, title, description, source, est_minutes, content, plan_added) VALUES (auth.uid(), p.lesson_id, d.id, next_position, a->>'kind', a->>'title', a->>'description', 'ai', (a->>'est_minutes')::integer, a->'content', true);
  UPDATE public.study_days SET target_minutes = greatest(60, target_minutes) + (a->>'est_minutes')::integer WHERE id = d.id;
 END LOOP;
 UPDATE public.plan_coach_proposals SET status = 'applied' WHERE id = p.id;
END $$;
REVOKE ALL ON FUNCTION public.apply_plan_coach_proposal(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_plan_coach_proposal(uuid, jsonb) TO authenticated;
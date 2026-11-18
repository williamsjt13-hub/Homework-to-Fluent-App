import { createFileRoute } from "@tanstack/react-router";
import { handlePlanCoachChat } from "@/lib/coach.functions";

export const Route = createFileRoute("/api/plan-coach")({
  server: { handlers: { POST: ({ request }) => handlePlanCoachChat(request) } },
});

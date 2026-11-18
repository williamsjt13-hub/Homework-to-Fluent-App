import { createFileRoute } from "@tanstack/react-router";
import { PlanCoachPage } from "@/components/coach/plan-coach";

export const Route = createFileRoute("/_authenticated/lessons/$id/coach/$threadId")({
  head: () => ({
    meta: [
      { title: "Weekly plan coach — Weekly Language Coach" },
      {
        name: "description",
        content:
          "Customize your weekly practice with your coach and compare changes with your original plan.",
      },
      { property: "og:title", content: "Weekly plan coach — Weekly Language Coach" },
      {
        property: "og:description",
        content: "Adjust your five-day study plan with saved coach conversations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CoachRoute,
});

function CoachRoute() {
  const { id, threadId } = Route.useParams();
  return <PlanCoachPage lessonId={id} threadId={threadId} />;
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Plus, ArrowLeft, Check, CalendarDays, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createPlanThread, applyPlanProposal } from "@/lib/coach.functions";
import { planCoachQuery } from "@/lib/plan-coach-queries";
import { lessonQuery } from "@/lib/queries";
import { DAY_PLAN } from "@/lib/languages";
import { addedMinutes, type PlanAddition, type PlanChange, type PlanRemoval } from "@/lib/plan-coach";
import { Button } from "@/components/ui/button";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";

export function PlanCoachEntry({ lessonId }: { lessonId: string }) {
  const create = useServerFn(createPlanThread);
  const navigate = useNavigate();
  const query = useQuery(planCoachQuery(lessonId));
  const [busy, setBusy] = useState(false);
  async function open() {
    const existing = query.data?.threads[0];
    if (existing) {
      await navigate({
        to: "/lessons/$id/coach/$threadId",
        params: { id: lessonId, threadId: existing.id },
      });
      return;
    }
    setBusy(true);
    try {
      const thread = await create({ data: { lessonId } });
      await navigate({
        to: "/lessons/$id/coach/$threadId",
        params: { id: lessonId, threadId: thread.id },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't open coach");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="border-y py-5">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-display font-semibold"
          aria-hidden
        >
          W
        </div>
        <h2 className="text-xl font-semibold">Your plan, your way</h2>
      </div>
      <Button onClick={open} disabled={busy || query.isLoading} className="mt-4">
        <MessageCircle />
        {busy ? "Opening…" : "Adjust with coach"}
      </Button>
      {query.data?.additions.length ? (
        <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
          {query.data.additions.map((a) => (
            <li key={a.id} className="flex items-center gap-2">
              <Plus className="h-3 w-3 text-primary" />
              {a.title} · {a.est_minutes} min
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function PlanCoachPage({ lessonId, threadId }: { lessonId: string; threadId: string }) {
  const lesson = useQuery(lessonQuery(lessonId));
  const query = useQuery(planCoachQuery(lessonId));
  const qc = useQueryClient();
  const create = useServerFn(createPlanThread);
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  async function newChat() {
    setCreating(true);
    try {
      const thread = await create({ data: { lessonId } });
      await qc.invalidateQueries({ queryKey: ["plan-coach", lessonId] });
      await navigate({
        to: "/lessons/$id/coach/$threadId",
        params: { id: lessonId, threadId: thread.id },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't create conversation");
    } finally {
      setCreating(false);
    }
  }
  if (query.error || lesson.error)
    return (
      <p role="alert" className="text-destructive">
        {query.error?.message ?? lesson.error?.message}
      </p>
    );
  if (!query.data || !lesson.data)
    return <p className="py-12 text-muted-foreground">Loading your plan…</p>;
  const thread = query.data.threads.find((t) => t.id === threadId);
  if (!thread) return <p>Conversation not found.</p>;
  const original = query.data.original?.days as
    { day_number: number; title: string; purpose: string; target_minutes: number }[] | undefined;
  return (
    <div className="animate-rise min-w-0">
      <Button asChild variant="link" className="mb-4 px-0">
        <Link to="/lessons/$id" params={{ id: lessonId }}>
          <ArrowLeft />
          Your week
        </Link>
      </Button>
      <div className="flex items-center gap-3">
        <div
          aria-hidden
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-display text-xl"
        >
          W
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Weekly plan coach</h1>
          <p className="truncate text-sm text-muted-foreground">{lesson.data.lesson.topic}</p>
        </div>
      </div>
      <div className="mt-5 flex items-center gap-2 border-b pb-3">
        <h2 className="flex-1 text-sm font-semibold">Conversations</h2>
        <Button
          variant="outline"
          size="sm"
          disabled={creating || !["planned", "active"].includes(lesson.data.lesson.status)}
          onClick={newChat}
        >
          <Plus />
          New conversation
        </Button>
      </div>
      <nav
        aria-label="Coach conversations"
        className="mt-2 flex max-h-32 flex-col gap-1 overflow-auto"
      >
        {query.data.threads.map((t) => (
          <Button
            asChild
            key={t.id}
            variant={t.id === threadId ? "secondary" : "ghost"}
            className="justify-start overflow-hidden"
          >
            <Link to="/lessons/$id/coach/$threadId" params={{ id: lessonId, threadId: t.id }}>
              <MessageCircle className="shrink-0" />
              <span className="truncate">{t.title}</span>
            </Link>
          </Button>
        ))}
      </nav>
      <section
        aria-label="Plan comparison"
        className="mt-5 max-h-64 overflow-auto border-y py-4 sm:max-h-none"
      >
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <CalendarDays className="h-4 w-4 text-primary" />
          Your five days
        </h2>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 text-xs">
          <h3 className="font-semibold text-muted-foreground">Original plan</h3>
          <h3 className="font-semibold text-primary">Current plan</h3>
        </div>
        {lesson.data.days.map((day) => {
          const base = original?.find((d) => d.day_number === day.day_number);
          const extras = query.data.additions.filter((a) => a.day_id === day.id);
          const gone = query.data.removed.filter((a) => a.day_id === day.id);
          return (
            <div
              key={day.id}
              className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 text-xs leading-relaxed"
            >
              <div>
                <div className="font-semibold">
                  Day {day.day_number} · {base?.title ?? DAY_PLAN[day.day_number - 1]?.title}
                </div>
                <div className="text-muted-foreground">{base?.target_minutes ?? 60} min</div>
              </div>
              <div>
                <Button
                  asChild
                  variant="link"
                  className="h-auto w-full justify-start whitespace-normal p-0 text-left text-xs"
                >
                  <Link
                    to="/lessons/$id/day/$n"
                    params={{ id: lessonId, n: String(day.day_number) }}
                  >
                    Day {day.day_number} · {day.title}
                  </Link>
                </Button>
                <div className="text-muted-foreground">{day.target_minutes} min</div>
                {extras.map((a) => (
                  <div key={a.id} className="mt-1 text-primary">
                    + {a.title} · {a.est_minutes} min
                  </div>
                ))}
                {gone.map((a) => (
                  <div key={a.id} className="mt-1 text-muted-foreground line-through">
                    {a.title} · {a.est_minutes} min
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>
      <CoachChat
        key={threadId}
        lessonId={lessonId}
        threadId={threadId}
        initialMessages={thread.messages as unknown as UIMessage[]}
        proposals={query.data.proposals.filter((p) => p.thread_id === threadId)}
        readOnly={!["planned", "active"].includes(lesson.data.lesson.status)}
      />
    </div>
  );
}

type Proposal = {
  id: string;
  summary: string;
  additions: unknown;
  removals?: unknown;
  changes?: unknown;
  status: string;
};
function CoachChat({
  lessonId,
  threadId,
  initialMessages,
  proposals,
  readOnly,
}: {
  lessonId: string;
  threadId: string;
  initialMessages: UIMessage[];
  proposals: Proposal[];
  readOnly: boolean;
}) {
  const qc = useQueryClient();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/plan-coach",
        body: { threadId },
        headers: async () => {
          const { data } = await supabase.auth.getSession();
          return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
        },
      }),
    [threadId],
  );
  const { messages, sendMessage, status, stop, error } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onFinish: () => {
      void qc.invalidateQueries({ queryKey: ["plan-coach", lessonId] });
    },
    onError: (err) => toast.error(err.message),
  });
  const busy = status === "submitted" || status === "streaming";
  useEffect(() => {
    if (!readOnly && !busy) textarea.current?.focus();
  }, [busy, readOnly]);
  return (
    <section className="mt-5 min-w-0">
      <Conversation className="h-[360px] min-w-0 sm:h-[420px]">
        <ConversationContent className="px-0">
          {!messages.length && (
            <Message from="assistant">
              <MessageContent>
                <MessageResponse>What would you like to add, change or remove in your week?</MessageResponse>
              </MessageContent>
            </Message>
          )}
          {messages.map((message) => (
            <Message key={message.id} from={message.role}>
              <MessageContent
                className={
                  message.role === "user"
                    ? "group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground"
                    : ""
                }
              >
                {message.parts.map((part, i) => {
                  if (part.type === "text")
                    return <MessageResponse key={i}>{part.text}</MessageResponse>;
                  if (part.type === "reasoning")
                    return (
                      <Reasoning key={i} defaultOpen={false}>
                        <ReasoningTrigger />
                        <ReasoningContent>{part.text}</ReasoningContent>
                      </Reasoning>
                    );
                  if (part.type === "tool-propose_plan" || part.type === "dynamic-tool") {
                    const output = part.output as
                      | {
                          proposalId?: string;
                          summary?: string;
                          additions?: PlanAddition[];
                          removals?: PlanRemoval[];
                          changes?: PlanChange[];
                        }
                      | undefined;
                    return (
                      <div key={i}>
                        <Tool defaultOpen={false}>
                          <ToolHeader
                            type="dynamic-tool"
                            toolName="propose_plan"
                            title="Plan proposal"
                            state={part.state}
                          />
                          <ToolContent>
                            <ToolInput input={part.input} />
                            <ToolOutput output={output} errorText={part.errorText} />
                          </ToolContent>
                        </Tool>
                        {output?.proposalId && (
                          <ProposalCard
                            proposal={{
                              id: output.proposalId,
                              summary: output.summary ?? "Extra practice",
                              additions: output.additions ?? [],
                              removals: output.removals ?? [],
                              changes: output.changes ?? [],
                              status:
                                proposals.find((p) => p.id === output.proposalId)?.status ??
                                "pending",
                            }}
                            lessonId={lessonId}
                            disabled={busy || readOnly}
                          />
                        )}
                      </div>
                    );
                  }
                  return null;
                })}
              </MessageContent>
            </Message>
          ))}
          {status === "submitted" && <Shimmer>Thinking about your week…</Shimmer>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      {proposals
        .filter(
          (p) =>
            !messages.some((m) =>
              m.parts.some(
                (part) =>
                  (part.type === "tool-propose_plan" || part.type === "dynamic-tool") &&
                  (part.output as { proposalId?: string } | undefined)?.proposalId === p.id,
              ),
            ),
        )
        .map((p) => (
          <ProposalCard key={p.id} proposal={p} lessonId={lessonId} disabled={busy || readOnly} />
        ))}
      {error && (
        <p role="alert" className="my-2 text-sm text-destructive">
          {error.message}
        </p>
      )}
      {!readOnly && (
        <PromptInput
          onSubmit={async ({ text }) => {
            if (!text.trim() || busy) return;
            setInput("");
            await sendMessage({ text });
            textarea.current?.focus();
          }}
        >
          <PromptInputTextarea
            ref={textarea}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Add 15 minutes of listening to Day 3…"
            maxLength={2000}
            className="min-h-24"
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit
              status={status}
              onStop={() => {
                void stop();
                textarea.current?.focus();
              }}
              disabled={!busy && !input.trim()}
            />
          </PromptInputFooter>
        </PromptInput>
      )}
    </section>
  );
}

function ProposalCard({
  proposal,
  lessonId,
  disabled,
}: {
  proposal: Proposal;
  lessonId: string;
  disabled: boolean;
}) {
  const apply = useServerFn(applyPlanProposal);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(proposal.status === "applied");
  const additions = (proposal.additions ?? []) as PlanAddition[];
  const removals = (proposal.removals ?? []) as PlanRemoval[];
  const changes = (proposal.changes ?? []) as PlanChange[];
  async function accept() {
    setBusy(true);
    try {
      await apply({ data: { proposalId: proposal.id } });
      setApplied(true);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["plan-coach", lessonId] }),
        qc.invalidateQueries({ queryKey: ["lesson", lessonId] }),
        qc.invalidateQueries({ queryKey: ["day", lessonId] }),
      ]);
      toast.success("Your weekly plan has been updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't update plan");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="my-3 rounded-lg border border-primary/30 bg-primary/5 p-4 text-foreground">
      <h3 className="text-sm font-semibold">{proposal.summary}</h3>
      <ul className="mt-2 space-y-2 text-sm">
        {additions.map((a, i) => (
          <li key={i}>
            <span className="font-medium">
              Day {a.day} · {a.kind === "conversation" ? "AI conversation" : a.kind}
            </span>{" "}
            · +{a.minutes} min<div className="text-xs text-muted-foreground">{a.focus}</div>
          </li>
        ))}
        {removals.map((r) => (
          <li key={r.activity_id}>
            <span className="font-medium text-destructive">Remove</span> · {r.title}
          </li>
        ))}
        {changes.map((c) => (
          <li key={c.activity_id}>
            <span className="font-medium">Change</span> · {c.title} → {c.minutes} min
          </li>
        ))}
      </ul>
      <div className="mt-3 text-xs text-muted-foreground">
        {[...new Set(additions.map((a) => a.day))]
          .map((day) => `Day ${day}: +${addedMinutes(day, additions)} min`)
          .join(" · ")}
      </div>
      <Button
        size="sm"
        className="mt-3"
        disabled={disabled || busy || applied || proposal.status === "applied"}
        onClick={accept}
      >
        {applied || proposal.status === "applied" ? (
          <>
            <Check />
            Applied
          </>
        ) : busy ? (
          "Preparing activities…"
        ) : (
          "Apply changes"
        )}
      </Button>
    </div>
  );
}

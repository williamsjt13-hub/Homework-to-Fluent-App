import { describe, it, expect } from "vitest";
import {
  proposalSchema,
  addedMinutes,
  validateGeneratedAdditions,
  originalDayMastered,
} from "./plan-coach";

describe("weekly plan customization", () => {
  it("extra practice never removes completed Day 1 mastery", () => {
    expect(
      originalDayMastered(
        1,
        [
          { completed: true, kind: "quiz", score: 80, plan_added: false },
          { completed: false, kind: "quiz", score: null, plan_added: true },
        ],
        80,
      ),
    ).toBe(true);
  });
  it("extra practice cannot bypass the original mastery check", () => {
    expect(
      originalDayMastered(
        1,
        [
          { completed: true, kind: "quiz", score: 79, plan_added: false },
          { completed: true, kind: "quiz", score: 100, plan_added: true },
        ],
        80,
      ),
    ).toBe(false);
  });
  it("adds flashcards to day 1", () => {
    expect(
      addedMinutes(1, [{ day: 1, kind: "flashcards", minutes: 15, focus: "por vs para" }]),
    ).toBe(15);
  });
  it("supports listening and conversation together on day 3", () => {
    expect(
      addedMinutes(3, [
        { day: 3, kind: "listening", minutes: 15, focus: "por" },
        { day: 3, kind: "conversation", minutes: 20, focus: "para" },
      ]),
    ).toBe(35);
  });
  it("removed activities don't block finishing the day", () => {
    expect(
      originalDayMastered(
        2,
        [
          { completed: true, kind: "quiz", score: 90, plan_added: false },
          { completed: false, kind: "task", score: null, plan_added: false, removed_at: "2026-11-10" },
        ],
        80,
      ),
    ).toBe(true);
  });
  it("accepts a removal-only proposal", () => {
    expect(
      proposalSchema.safeParse({
        summary: "Drop extra quiz",
        removals: [{ activity_id: "7c9e6679-7425-40de-944b-e07fc1f90ae7", title: "Quiz" }],
      }).success,
    ).toBe(true);
  });
  it("rejects an empty proposal", () => {
    expect(proposalSchema.safeParse({ summary: "Nothing" }).success).toBe(false);
  });
  it("only accepts the five study days", () => {
    expect(
      proposalSchema.safeParse({
        summary: "Extra practice",
        additions: [{ day: 6, kind: "quiz", minutes: 10, focus: "review" }],
      }).success,
    ).toBe(false);
  });
  it("preserves the requested type and time", () => {
    expect(
      validateGeneratedAdditions(
        [{ kind: "flashcards", content: { cards: [{ front: "por", back: "because of" }] } }],
        [{ day: 1, kind: "flashcards", minutes: 15, focus: "por" }],
      )[0]?.est_minutes,
    ).toBe(15);
    expect(() =>
      validateGeneratedAdditions(
        [{ kind: "quiz", content: {} }],
        [{ day: 1, kind: "flashcards", minutes: 15, focus: "por" }],
      ),
    ).toThrow();
  });
});

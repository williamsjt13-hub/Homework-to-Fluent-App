import { describe, it, expect } from "vitest";
import { compareDictation } from "./dictation";

describe("compareDictation", () => {
  it("perfect transcription scores 100", () => {
    expect(compareDictation("Yo anduve por el parque.", "yo anduve por el parque").score).toBe(100);
  });
  it("flags missing words", () => {
    const r = compareDictation("Ayer fuimos al cine", "Ayer al cine");
    expect(r.marks.find((m) => m.word === "fuimos")?.status).toBe("missing");
    expect(r.score).toBe(75);
  });
  it("flags typos and accents", () => {
    const r = compareDictation("Él estuvo aquí", "el estubo aqui");
    expect(r.marks.map((m) => m.status)).toEqual(["accent", "typo", "accent"]);
  });
});

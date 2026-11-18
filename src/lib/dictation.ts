// Word-by-word comparison of a dictation attempt against the source sentence.
export type WordMark = { word: string; status: "ok" | "accent" | "typo" | "missing"; heard?: string | undefined };

const strip = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const clean = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const tokens = (s: string) => s.split(/\s+/).filter((w) => clean(w));

function lev(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length]![b.length]!;
}

export function compareDictation(source: string, attempt: string): { marks: WordMark[]; extra: string[]; score: number } {
  const src = tokens(source);
  const usr = tokens(attempt);
  const s = src.map((w) => strip(clean(w)));
  const u = usr.map((w) => strip(clean(w)));
  // LCS on accent-insensitive words
  const L = Array.from({ length: s.length + 1 }, () => Array(u.length + 1).fill(0) as number[]);
  for (let i = s.length - 1; i >= 0; i--)
    for (let j = u.length - 1; j >= 0; j--)
      L[i]![j] = s[i] === u[j] ? L[i + 1]![j + 1]! + 1 : Math.max(L[i + 1]![j]!, L[i]![j + 1]!);
  const marks: WordMark[] = [];
  const extra: string[] = [];
  let i = 0, j = 0;
  let gapUser: string[] = [];
  const flushGap = (start: number) => {
    // pair leftover user words with missing source words in this gap as typos
    for (let k = start; k < marks.length && gapUser.length; k++) {
      const m = marks[k]!;
      if (m.status !== "missing") continue;
      const idx = gapUser.findIndex((g) => lev(strip(clean(g)), strip(clean(m.word))) <= Math.max(1, Math.floor(clean(m.word).length / 3)));
      if (idx >= 0) { m.status = "typo"; m.heard = gapUser[idx]; gapUser.splice(idx, 1); }
    }
    extra.push(...gapUser);
    gapUser = [];
  };
  let gapStart = 0;
  while (i < s.length || j < u.length) {
    if (i < s.length && j < u.length && s[i] === u[j]) {
      flushGap(gapStart);
      const ok = clean(src[i]!) === clean(usr[j]!);
      marks.push({ word: src[i]!, status: ok ? "ok" : "accent", heard: ok ? undefined : usr[j] });
      i++; j++;
      gapStart = marks.length;
    } else if (j < u.length && (i >= s.length || L[i]![j + 1]! >= L[i + 1]![j]!)) {
      gapUser.push(usr[j]!); j++;
    } else {
      marks.push({ word: src[i]!, status: "missing" }); i++;
    }
  }
  flushGap(gapStart);
  const pts = marks.reduce((t, m) => t + (m.status === "ok" ? 1 : m.status === "accent" ? 0.75 : m.status === "typo" ? 0.5 : 0), 0);
  const score = src.length ? Math.round((pts / src.length) * 100) : 0;
  return { marks, extra, score };
}

import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { extractText, fileKind } from "./extract-text";

const fake = (u: Uint8Array, name: string) => ({ name, type: "", arrayBuffer: async () => u.slice().buffer }) as unknown as File;

describe("extractText", () => {
  it("reads paragraphs from a Word docx", async () => {
    const zip = new JSZip();
    zip.file("word/document.xml", "<w:document><w:body><w:p><w:r><w:t>Yo anduve</w:t></w:r></w:p><w:p><w:r><w:t>Tú anduviste</w:t></w:r></w:p></w:body></w:document>");
    const blob = await zip.generateAsync({ type: "uint8array" });
    const text = await extractText(fake(blob, "tarea.docx"));
    expect(text).toBe("Yo anduve\nTú anduviste");
  });

  it("reads rows from a csv", async () => {
    const text = await extractText(fake(new TextEncoder().encode("verbo,yo\nestar,estuve\n"), "verbos.csv"));
    expect(text).toContain("estar,estuve");
  });

  it("recognizes files with no type by extension", () => {
    expect(fileKind({ name: "a.XLSX", type: "" })).toBe("sheet");
    expect(fileKind({ name: "a.docx", type: "" })).toBe("doc");
  });
});

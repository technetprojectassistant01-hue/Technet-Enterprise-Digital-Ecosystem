import { describe, expect, it } from "vitest";
import { guideFileName, parseGuidePdfInput } from "./guide";
import { generateGuidePdf } from "../lib/pdf/guidePdf";

const guide = {
  title: "Guide de l'administrateur",
  intro: "Tout ce que l'administrateur peut faire.",
  lastChecked: "Vérifié dans l'application le 22 octobre 2026.",
  contents: "Sommaire",
  pageLabel: "Page {n} sur {total}",
  chapters: [
    {
      title: "Premiers pas",
      intro: "Se connecter et s'orienter.",
      topics: [
        {
          title: "Se connecter",
          blocks: [
            { kind: "p", text: "Ouvrez l'application." },
            { kind: "steps", items: ["Saisissez votre e-mail.", "Saisissez votre mot de passe."] },
            { kind: "list", items: ["Un", "Deux"] },
            { kind: "tip", text: "Installez l'application sur votre téléphone." },
            { kind: "note", text: "Le mot de passe est sensible à la casse." },
          ],
        },
      ],
    },
  ],
};

describe("parseGuidePdfInput", () => {
  it("accepts a guide as the User Guide page sends it", () => {
    expect(parseGuidePdfInput(guide)).toEqual(guide);
  });

  it("refuses anything that isn't a guide", () => {
    expect(parseGuidePdfInput(null)).toBeNull();
    expect(parseGuidePdfInput({ ...guide, title: "  " })).toBeNull();
    expect(parseGuidePdfInput({ ...guide, chapters: [] })).toBeNull();
    const badBlock = { ...guide, chapters: [{ title: "x", topics: [{ title: "y", blocks: [{ kind: "img", text: "z" }] }] }] };
    expect(parseGuidePdfInput(badBlock)).toBeNull();
  });
});

describe("guideFileName", () => {
  it("makes a plain file name from the guide title", () => {
    expect(guideFileName("Guide de l'administrateur")).toBe("technet-guide-de-l-administrateur.pdf");
    expect(guideFileName("???")).toBe("technet-user-guide.pdf");
  });
});

describe("generateGuidePdf", () => {
  it("builds a PDF", async () => {
    const doc = generateGuidePdf(parseGuidePdfInput(guide)!);
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    await new Promise((resolve) => doc.on("end", resolve));
    expect(Buffer.concat(chunks).subarray(0, 5).toString()).toBe("%PDF-");
  });
});

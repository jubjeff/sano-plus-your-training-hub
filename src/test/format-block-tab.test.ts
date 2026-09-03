import { describe, expect, it } from "vitest";
import { getBlockTabLabel } from "@/lib/format";

describe("getBlockTabLabel", () => {
  it("corta o complemento depois do separador", () => {
    expect(getBlockTabLabel("Treino A — Peito e Tríceps")).toBe("Treino A");
    expect(getBlockTabLabel("Treino E — Pernas (Posterior e Glúteo) e Core")).toBe("Treino E");
    expect(getBlockTabLabel("Treino B - Costas e Bíceps")).toBe("Treino B");
    expect(getBlockTabLabel("Treino C: Pernas")).toBe("Treino C");
  });

  it("devolve o nome inteiro quando nao ha separador", () => {
    expect(getBlockTabLabel("Treino A")).toBe("Treino A");
    expect(getBlockTabLabel("Corpo inteiro")).toBe("Corpo inteiro");
  });

  it("nao corta hifen que faz parte da palavra", () => {
    // "Cat-camel" e "Full-body" nao tem espaco em volta do hifen
    expect(getBlockTabLabel("Full-body")).toBe("Full-body");
  });

  it("aguenta nome vazio ou so separador", () => {
    expect(getBlockTabLabel("")).toBe("");
    expect(getBlockTabLabel(" — Peito")).toBe(" — Peito");
  });
});

import { describe, expect, it } from "vitest";
import {
  conferirComBiblioteca,
  contarEncontrados,
  contarNaoEncontrados,
  lerTreinoDeTexto,
  normalizarNome,
} from "@/lib/workout-import";
import type { ExerciseLibraryItem } from "@/types";

function exercicio(name: string, id = name): ExerciseLibraryItem {
  return {
    id,
    name,
    slug: id,
    category: "Musculação",
    muscleCategory: "Peito",
    muscleGroupPrimary: "Peitoral maior",
    muscleGroupsSecondary: [],
    movementType: "Empurrar",
    bodyRegion: "Membros superiores",
    equipment: "Barra",
    difficultyLevel: "Intermediário",
    exerciseType: "Força",
    description: "",
    executionInstructions: "",
    breathingTips: "",
    postureTips: "",
    contraindications: "",
    commonMistakes: "",
    durationLimitSeconds: 6,
    isActive: true,
    isGlobal: true,
    createdBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } as ExerciseLibraryItem;
}

const BIBLIOTECA = [
  exercicio("Supino reto com barra"),
  exercicio("Crucifixo reto"),
  exercicio("Tríceps corda"),
  exercicio("Remada curvada com barra"),
  exercicio("Agachamento livre"),
];

describe("normalizarNome", () => {
  it("ignora acento, caixa e pontuacao", () => {
    expect(normalizarNome("Tríceps corda")).toBe("triceps corda");
    expect(normalizarNome("TRÍCEPS  CORDA")).toBe("triceps corda");
    expect(normalizarNome("Leg press 45°")).toBe("leg press 45");
    expect(normalizarNome("  Supino reto com barra  ")).toBe("supino reto com barra");
  });
});

describe("lerTreinoDeTexto", () => {
  const texto = `Estrutura: ABCDE
Meta semanal: 4

Treino A — Peito e tríceps
- Supino reto com barra | 4x8 | 40kg | 90s | descer controlado
- Crucifixo reto | 3x12 | 14kg | 60s
- Tríceps corda | 3x15

Treino B — Costas
- Remada curvada com barra | 4x10 | 50kg | 90s`;

  it("le cabecalho, blocos e exercicios", () => {
    const t = lerTreinoDeTexto(texto);

    expect(t.estrutura).toBe("abcde");
    expect(t.metaSemanal).toBe(4);
    expect(t.blocos).toHaveLength(2);
    expect(t.blocos[0].nome).toBe("Treino A — Peito e tríceps");
    expect(t.blocos[0].exercicios).toHaveLength(3);
    expect(t.blocos[1].exercicios).toHaveLength(1);
    expect(t.avisos).toHaveLength(0);
  });

  it("separa series de repeticoes", () => {
    const t = lerTreinoDeTexto(texto);
    const primeiro = t.blocos[0].exercicios[0];

    expect(primeiro.nome).toBe("Supino reto com barra");
    expect(primeiro.series).toBe(4);
    expect(primeiro.reps).toBe("8");
    expect(primeiro.carga).toBe("40kg");
    expect(primeiro.descanso).toBe("90s");
    expect(primeiro.observacao).toBe("descer controlado");
  });

  it("preenche padrao quando o campo nao vem", () => {
    const t = lerTreinoDeTexto(texto);
    const terceiro = t.blocos[0].exercicios[2];

    expect(terceiro.nome).toBe("Tríceps corda");
    expect(terceiro.series).toBe(3);
    expect(terceiro.reps).toBe("15");
    expect(terceiro.carga).toBe("");
    expect(terceiro.descanso).toBe("60s");
  });

  it("aceita as variacoes de marcador e de x", () => {
    const t = lerTreinoDeTexto(`Treino A
- Supino reto com barra | 4x8
* Crucifixo reto | 3 X 10-12
• Tríceps corda | 3×15
1. Agachamento livre | 5x5`);

    expect(t.blocos[0].exercicios).toHaveLength(4);
    expect(t.blocos[0].exercicios[1].series).toBe(3);
    expect(t.blocos[0].exercicios[1].reps).toBe("10-12");
    expect(t.blocos[0].exercicios[2].series).toBe(3);
    expect(t.blocos[0].exercicios[3].series).toBe(5);
  });

  it("aceita cabecalho markdown no nome do bloco", () => {
    const t = lerTreinoDeTexto(`## Treino A — Peito
- Supino reto com barra | 4x8`);

    expect(t.blocos[0].nome).toBe("Treino A — Peito");
  });

  it("ignora a linha Aluno: — quem recebe e escolhido na tela", () => {
    const t = lerTreinoDeTexto(`Aluno: Anderson Santos
Treino A
- Supino reto com barra | 3x10`);

    expect(t.blocos).toHaveLength(1);
    expect(t.blocos[0].nome).toBe("Treino A");
  });

  it("avisa em vez de engolir entrada torta", () => {
    expect(lerTreinoDeTexto("").avisos[0]).toMatch(/cole o treino/i);
    expect(lerTreinoDeTexto("Treino A").avisos[0]).toMatch(/sem exercício/i);
    expect(lerTreinoDeTexto("- Supino reto com barra | 3x10").avisos[0]).toMatch(/antes de qualquer bloco/i);
    expect(lerTreinoDeTexto("Estrutura: sei la\nTreino A\n- Supino reto com barra").avisos[0]).toMatch(/não reconhecida/i);
    expect(lerTreinoDeTexto("Meta semanal: 99\nTreino A\n- Supino reto com barra").avisos[0]).toMatch(/1 a 7/i);
  });

  it("guarda a linha de origem para apontar o erro", () => {
    const t = lerTreinoDeTexto(`Treino A
- Supino reto com barra | 3x10`);

    expect(t.blocos[0].exercicios[0].linha).toBe(2);
  });
});

describe("conferirComBiblioteca", () => {
  it("casa por nome normalizado, ignorando acento e caixa", () => {
    const t = lerTreinoDeTexto(`Treino A
- SUPINO RETO COM BARRA | 4x8
- triceps corda | 3x12`);
    const conferido = conferirComBiblioteca(t.blocos, BIBLIOTECA);

    expect(contarEncontrados(conferido)).toBe(2);
    expect(contarNaoEncontrados(conferido)).toBe(0);
    expect(conferido[0].exercicios[0].daBiblioteca?.name).toBe("Supino reto com barra");
  });

  it("nome parecido vira SUGESTAO, nunca substituicao", () => {
    const t = lerTreinoDeTexto(`Treino A
- Supino reto barra livre | 4x8`);
    const conferido = conferirComBiblioteca(t.blocos, BIBLIOTECA);
    const item = conferido[0].exercicios[0];

    // o que importa: nao entrou como se tivesse casado
    expect(item.daBiblioteca).toBeNull();
    expect(item.sugestao).toBe("Supino reto com barra");
    expect(contarNaoEncontrados(conferido)).toBe(1);
  });

  it("sem nada parecido, nao inventa sugestao", () => {
    const t = lerTreinoDeTexto(`Treino A
- Exercicio que nao existe | 3x10`);
    const conferido = conferirComBiblioteca(t.blocos, BIBLIOTECA);

    expect(conferido[0].exercicios[0].daBiblioteca).toBeNull();
    expect(conferido[0].exercicios[0].sugestao).toBeNull();
  });

  it("conta certo com mistura de casado e nao casado", () => {
    const t = lerTreinoDeTexto(`Treino A
- Supino reto com barra | 4x8
- Voador peitoral | 3x12
Treino B
- Agachamento livre | 5x5`);
    const conferido = conferirComBiblioteca(t.blocos, BIBLIOTECA);

    expect(contarEncontrados(conferido)).toBe(2);
    expect(contarNaoEncontrados(conferido)).toBe(1);
  });
});

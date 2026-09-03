/**
 * Leitura de treino colado em texto — pensado para o professor prescrever fora
 * do app (com um assistente, num bloco de notas) e trazer pronto para cá.
 *
 * O texto so descreve PRESCRICAO: nome do exercicio, series, repeticoes, carga,
 * descanso e observacao. Ficha tecnica, musculos, instrucoes e midia continuam
 * vindo da biblioteca global no momento em que o exercicio e montado — quem
 * cola nao consegue inventar conteudo tecnico, so a dosagem.
 *
 * Nada aqui grava: o parser devolve o que entendeu e o que nao casou, e a
 * decisao de aplicar fica com quem esta olhando a tela.
 */
import type { ExerciseLibraryItem } from "@/types";

export interface ExercicioLido {
  nome: string;
  series: number;
  reps: string;
  carga: string;
  descanso: string;
  observacao: string;
  /** Linha do texto original, para apontar o erro onde ele esta. */
  linha: number;
}

export interface BlocoLido {
  nome: string;
  exercicios: ExercicioLido[];
}

export interface TreinoLido {
  estrutura: "weekly" | "abcde" | null;
  metaSemanal: number | null;
  blocos: BlocoLido[];
  avisos: string[];
}

const SERIES_PADRAO = 3;
const REPS_PADRAO = "10-12";
const DESCANSO_PADRAO = "60s";

/** minusculas, sem acento, sem pontuacao, espacos colapsados */
export function normalizarNome(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "4x8" -> {series:4, reps:"8"} · "3 x 10-12" -> {series:3, reps:"10-12"} */
function lerSeriesEReps(campo: string): { series: number; reps: string } | null {
  const limpo = campo.trim();
  if (!limpo) return null;

  const m = limpo.match(/^(\d+)\s*[xX×]\s*(.+)$/);
  if (m) {
    return { series: Number(m[1]), reps: m[2].trim() };
  }

  // so um numero: trata como repeticoes, series fica no padrao
  if (/^\d+$/.test(limpo)) {
    return { series: SERIES_PADRAO, reps: limpo };
  }

  return { series: SERIES_PADRAO, reps: limpo };
}

function ehLinhaDeExercicio(linha: string): boolean {
  return /^\s*([-*•]|\d+[.)])\s+/.test(linha);
}

function tirarMarcador(linha: string): string {
  return linha.replace(/^\s*([-*•]|\d+[.)])\s+/, "").trim();
}

/**
 * Le o texto colado. Formato aceito, tolerante a variacao:
 *
 *   Estrutura: ABCDE
 *   Meta semanal: 4
 *
 *   Treino A — Peito e triceps
 *   - Supino reto com barra | 4x8 | 40kg | 90s | descer controlado
 *   - Crucifixo reto | 3x12 | 14kg | 60s
 *
 * Linha com marcador (-, *, •, "1.") e exercicio; qualquer outra linha nao
 * vazia abre um bloco novo. Campos separados por "|", so o nome e obrigatorio.
 */
export function lerTreinoDeTexto(texto: string): TreinoLido {
  const resultado: TreinoLido = { estrutura: null, metaSemanal: null, blocos: [], avisos: [] };
  if (!texto?.trim()) {
    resultado.avisos.push("Cole o treino para continuar.");
    return resultado;
  }

  const linhas = texto.split(/\r?\n/);
  let blocoAtual: BlocoLido | null = null;

  linhas.forEach((bruta, i) => {
    const numeroDaLinha = i + 1;
    const linha = bruta.trim();
    if (!linha) return;

    // cabecalho (fora de bloco): Estrutura / Meta semanal
    if (!blocoAtual || !ehLinhaDeExercicio(bruta)) {
      const cab = linha.match(/^(estrutura|meta semanal|aluno)\s*:\s*(.+)$/i);
      if (cab) {
        const chave = normalizarNome(cab[1]);
        const valor = cab[2].trim();
        if (chave === "estrutura") {
          const v = normalizarNome(valor);
          if (v.includes("abcde")) resultado.estrutura = "abcde";
          else if (v.includes("weekly") || v.includes("semanal") || v.includes("semana")) resultado.estrutura = "weekly";
          else resultado.avisos.push(`Linha ${numeroDaLinha}: estrutura "${valor}" não reconhecida. Use Weekly ou ABCDE.`);
        } else if (chave === "meta semanal") {
          const n = Number(valor.replace(/\D/g, ""));
          if (n >= 1 && n <= 7) resultado.metaSemanal = n;
          else resultado.avisos.push(`Linha ${numeroDaLinha}: meta semanal deve ser de 1 a 7.`);
        }
        // "Aluno:" é ignorado de propósito — quem recebe o treino é escolhido na tela.
        return;
      }
    }

    if (ehLinhaDeExercicio(bruta)) {
      if (!blocoAtual) {
        blocoAtual = { nome: "Treino A", exercicios: [] };
        resultado.blocos.push(blocoAtual);
        resultado.avisos.push(`Linha ${numeroDaLinha}: exercício antes de qualquer bloco. Criei um bloco "Treino A".`);
      }

      const campos = tirarMarcador(bruta).split("|").map((c) => c.trim());
      const nome = campos[0];
      if (!nome) {
        resultado.avisos.push(`Linha ${numeroDaLinha}: exercício sem nome, ignorado.`);
        return;
      }

      const seriesEReps = lerSeriesEReps(campos[1] ?? "");
      blocoAtual.exercicios.push({
        nome,
        series: seriesEReps?.series ?? SERIES_PADRAO,
        reps: seriesEReps?.reps ?? REPS_PADRAO,
        carga: campos[2] ?? "",
        descanso: campos[3] || DESCANSO_PADRAO,
        observacao: campos[4] ?? "",
        linha: numeroDaLinha,
      });
      return;
    }

    // linha solta = nome de bloco. Tira "#" de markdown se vier.
    const nomeBloco = linha.replace(/^#+\s*/, "").trim();
    blocoAtual = { nome: nomeBloco, exercicios: [] };
    resultado.blocos.push(blocoAtual);
  });

  const vazios = resultado.blocos.filter((b) => b.exercicios.length === 0);
  for (const b of vazios) {
    resultado.avisos.push(`Bloco "${b.nome}" ficou sem exercício.`);
  }

  if (!resultado.blocos.length) {
    resultado.avisos.push("Não encontrei nenhum bloco de treino no texto.");
  }

  return resultado;
}

export interface ExercicioConferido {
  lido: ExercicioLido;
  /** Item da biblioteca quando o nome casou exatamente. */
  daBiblioteca: ExerciseLibraryItem | null;
  /** Nome parecido, quando nao casou — sugestao para a pessoa decidir. */
  sugestao: string | null;
}

export interface BlocoConferido {
  nome: string;
  exercicios: ExercicioConferido[];
}

/** Quantos termos os dois nomes tem em comum, sobre o total de termos do alvo. */
function semelhanca(a: string, b: string): number {
  const ta = new Set(a.split(" ").filter((t) => t.length > 2));
  const tb = b.split(" ").filter((t) => t.length > 2);
  if (!ta.size || !tb.length) return 0;
  const comuns = tb.filter((t) => ta.has(t)).length;
  return comuns / Math.max(ta.size, tb.length);
}

/**
 * Casa cada exercicio lido com a biblioteca global. Casamento e por nome
 * normalizado e EXATO: nome parecido vira sugestao, nunca substituicao
 * automatica — prescrever o exercicio errado e pior do que faltar um.
 */
export function conferirComBiblioteca(
  blocos: BlocoLido[],
  biblioteca: ExerciseLibraryItem[],
): BlocoConferido[] {
  const porNome = new Map<string, ExerciseLibraryItem>();
  for (const item of biblioteca) {
    porNome.set(normalizarNome(item.name), item);
  }

  return blocos.map((bloco) => ({
    nome: bloco.nome,
    exercicios: bloco.exercicios.map((lido) => {
      const chave = normalizarNome(lido.nome);
      const exato = porNome.get(chave) ?? null;
      if (exato) {
        return { lido, daBiblioteca: exato, sugestao: null };
      }

      let melhor: { nome: string; nota: number } | null = null;
      for (const item of biblioteca) {
        const nota = semelhanca(chave, normalizarNome(item.name));
        if (nota > 0.5 && (!melhor || nota > melhor.nota)) {
          melhor = { nome: item.name, nota };
        }
      }

      return { lido, daBiblioteca: null, sugestao: melhor?.nome ?? null };
    }),
  }));
}

export function contarNaoEncontrados(blocos: BlocoConferido[]): number {
  return blocos.reduce(
    (total, bloco) => total + bloco.exercicios.filter((e) => !e.daBiblioteca).length,
    0,
  );
}

export function contarEncontrados(blocos: BlocoConferido[]): number {
  return blocos.reduce(
    (total, bloco) => total + bloco.exercicios.filter((e) => e.daBiblioteca).length,
    0,
  );
}

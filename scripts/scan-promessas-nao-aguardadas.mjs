/**
 * Procura chamadas a metodos assincronos do store que nao sao aguardadas nem
 * encadeadas com .catch().
 *
 * Essa classe de defeito derrubou seis fluxos do app sem deixar rastro: a
 * promessa rejeita depois que o handler ja terminou, entao o try/catch
 * sincrono nao pega nada, o toast de sucesso sai assim mesmo e o usuario ve
 * "cliquei e nao aconteceu nada". Foi assim no check-in do aluno, no importar
 * treino, no salvar carga, no salvar do editor de treino, no excluir treino e
 * no marcar alerta como lido.
 *
 * Uso:  node scripts/scan-promessas-nao-aguardadas.mjs
 * Sai com codigo 1 quando encontra algo, para poder virar passo de CI.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(RAIZ, "src");
const STORE = join(SRC, "lib", "supabase-store.ts");

/** Le os metodos async direto do store, para a lista nunca ficar desatualizada. */
function metodosAssincronos() {
  const fonte = readFileSync(STORE, "utf8");
  return [...fonte.matchAll(/^\s{2}(?:private\s+)?async\s+([a-zA-Z_]\w*)\s*\(/gm)].map((m) => m[1]);
}

function arquivos(dir) {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) saida.push(...arquivos(caminho));
    else if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) saida.push(caminho);
  }
  return saida;
}

const ASSINCRONOS = metodosAssincronos();
const achados = [];

for (const caminho of arquivos(SRC)) {
  // Os stores definem esses metodos; chamadas internas nao interessam aqui.
  if (/[\\/](supabase-store|store)\.ts$/.test(caminho)) continue;

  const linhas = readFileSync(caminho, "utf8").split(/\r?\n/);

  linhas.forEach((linha, i) => {
    for (const metodo of ASSINCRONOS) {
      if (!new RegExp(`(^|[^.\\w])${metodo}\\s*\\(`).test(linha)) continue;

      if (/^\s*(import|export)\b/.test(linha)) continue;
      // definicao do proprio metodo, nao chamada
      if (new RegExp(`\\basync\\s+${metodo}\\s*\\(`).test(linha)) continue;
      // desestruturacao do hook: const { updateStudent } = useStore()
      if (/\b(const|let|var)\s*\{/.test(linha)) continue;
      // arrow com retorno implicito devolve a promessa a quem chamou, na mesma
      // linha (`() => addWorkout(...)`) ou quebrada (`() =>` e a chamada abaixo)
      if (new RegExp(`=>\\s*${metodo}\\s*\\(`).test(linha)) continue;
      if (/=>\s*$/.test(linhas[i - 1] ?? "")) continue;
      if (/\bawait\s/.test(linha) || /\.catch\(/.test(linha) || /\breturn\s/.test(linha)) continue;
      // passado direto como prop: onSave={addWorkout}
      if (new RegExp(`=\\{${metodo}\\}`).test(linha)) continue;

      const trecho = linha.trim();
      achados.push({
        arquivo: relative(RAIZ, caminho).replace(/\\/g, "/"),
        linha: i + 1,
        metodo,
        trecho: trecho.length > 100 ? `${trecho.slice(0, 100)}…` : trecho,
      });
    }
  });
}

console.log(`Metodos assincronos monitorados: ${ASSINCRONOS.length}`);

if (!achados.length) {
  console.log("OK — nenhuma promessa nao aguardada.");
  process.exit(0);
}

console.log(`\nPROMESSAS NAO AGUARDADAS: ${achados.length}\n`);
for (const a of achados) {
  console.log(`${a.arquivo}:${a.linha}  [${a.metodo}]`);
  console.log(`    ${a.trecho}\n`);
}
console.log("Cada uma some silenciosamente se falhar. Use await + try/catch e avise na tela.");
process.exit(1);

/**
 * Gera a migration que preenche exercises.thumbnail_url com imagens de
 * demonstracao do free-exercise-db (https://github.com/yuhonas/free-exercise-db).
 *
 * Licenca da fonte: Unlicense (dominio publico) — sem exigencia de atribuicao
 * e sem restricao de uso comercial. Foi o criterio de escolha: os acervos de
 * GIF mais populares (ExerciseDB e mirrors) sao midia da Gym Visual
 * re-hospedada sem direito, o que nao serve para um SaaS pago.
 *
 * O mapeamento PT->EN e CURADO A MAO de proposito. Casamento automatico entre
 * idiomas erra (ex.: "agachamento bulgaro" cair num agachamento qualquer), e
 * num app de treino uma imagem errada ensina movimento errado — e pior que
 * imagem nenhuma. Por isso: so entra par conferido, e todo id e validado
 * contra o dataset antes de virar SQL.
 *
 * Uso: node scripts/generate-exercise-images-migration.mjs
 */
import { writeFileSync } from "node:fs";

const DATASET = "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/dist/exercises.json";
// jsDelivr serve o repo como CDN. Fica hotlinkado: nada entra no Supabase
// Storage, que ja estourou a cota de 1 GB uma vez com video de anamnese.
const CDN = "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises";

/** slug no catalogo Sano+ -> id no free-exercise-db */
const MAPA = {
  // ── Pernas ────────────────────────────────────────────────────────────────
  "agachamento-livre": "Barbell_Squat",
  "agachamento-frontal": "Front_Barbell_Squat",
  "leg-press": "Leg_Press",
  "leg-press-45": "Leg_Press",
  "hack-squat": "Hack_Squat",
  "smith-squat": "Smith_Machine_Squat",
  "cadeira-extensora": "Leg_Extensions",
  "cadeira-flexora": "Seated_Leg_Curl",
  "mesa-flexora": "Lying_Leg_Curls",
  "levantamento-terra": "Barbell_Deadlift",
  "levantamento-terra-romeno": "Romanian_Deadlift",
  "terra-romeno": "Romanian_Deadlift",
  stiff: "Stiff-Legged_Barbell_Deadlift",
  "good-morning": "Good_Morning",
  "good-morning-com-amplitude-leve": "Good_Morning",
  afundo: "Barbell_Lunge",
  passada: "Barbell_Walking_Lunge",
  abdutora: "Thigh_Abductor",
  adutora: "Thigh_Adductor",
  "abducao-de-quadril": "Thigh_Abductor",
  // ── Gluteo ────────────────────────────────────────────────────────────────
  "hip-thrust-com-barra": "Barbell_Hip_Thrust",
  "elevacao-pelvica": "Butt_Lift_Bridge",
  "glute-bridge": "Butt_Lift_Bridge",
  "coice-no-cabo": "One-Legged_Cable_Kickback",
  // ── Panturrilha ───────────────────────────────────────────────────────────
  "panturrilha-em-pe": "Standing_Calf_Raises",
  "panturrilha-em-pe-na-maquina": "Standing_Calf_Raises",
  "panturrilha-sentada": "Seated_Calf_Raise",
  "panturrilha-no-leg-press": "Calf_Press_On_The_Leg_Press_Machine",
  "panturrilha-no-smith": "Smith_Machine_Calf_Raise",
  // ── Peito ─────────────────────────────────────────────────────────────────
  "supino-reto": "Barbell_Bench_Press_-_Medium_Grip",
  "supino-reto-com-barra": "Barbell_Bench_Press_-_Medium_Grip",
  "supino-inclinado": "Barbell_Incline_Bench_Press_-_Medium_Grip",
  "supino-inclinado-com-halteres": "Incline_Dumbbell_Press",
  "supino-declinado": "Decline_Barbell_Bench_Press",
  "supino-fechado": "Close-Grip_Barbell_Bench_Press",
  "crucifixo-reto": "Dumbbell_Flyes",
  "crucifixo-inclinado": "Incline_Dumbbell_Flyes",
  "crucifixo-invertido": "Reverse_Machine_Flyes",
  crossover: "Cable_Crossover",
  "peck-deck": "Butterfly",
  paralelas: "Dips_-_Chest_Version",
  pullover: "Straight-Arm_Dumbbell_Pullover",
  // ── Costas ────────────────────────────────────────────────────────────────
  "barra-fixa": "Pullups",
  "puxada-frontal": "Wide-Grip_Lat_Pulldown",
  "puxada-frontal-na-polia": "Wide-Grip_Lat_Pulldown",
  pulldown: "Wide-Grip_Lat_Pulldown",
  "remada-curvada": "Bent_Over_Barbell_Row",
  "remada-curvada-com-barra": "Bent_Over_Barbell_Row",
  "remada-unilateral": "One-Arm_Dumbbell_Row",
  "remada-baixa": "Seated_Cable_Rows",
  "remada-cavalinho": "T-Bar_Row_with_Handle",
  "remada-alta": "Upright_Barbell_Row",
  "face-pull": "Face_Pull",
  encolhimento: "Barbell_Shrug",
  "elevacao-de-ombros": "Barbell_Shrug",
  // ── Ombros ────────────────────────────────────────────────────────────────
  "desenvolvimento-com-halteres": "Dumbbell_Shoulder_Press",
  "desenvolvimento-militar": "Barbell_Shoulder_Press",
  "arnold-press": "Arnold_Dumbbell_Press",
  "elevacao-lateral": "Side_Lateral_Raise",
  "elevacao-frontal": "Front_Dumbbell_Raise",
  // ── Biceps ────────────────────────────────────────────────────────────────
  "rosca-direta": "Barbell_Curl",
  "rosca-direta-com-barra": "Barbell_Curl",
  "rosca-alternada": "Dumbbell_Alternate_Bicep_Curl",
  "rosca-martelo": "Hammer_Curls",
  "rosca-concentrada": "Concentration_Curls",
  "rosca-scott": "Preacher_Curl",
  "rosca-inclinada": "Incline_Dumbbell_Curl",
  "rosca-inversa": "Standing_Dumbbell_Reverse_Curl",
  "rosca-no-cabo": "High_Cable_Curls",
  // ── Triceps ───────────────────────────────────────────────────────────────
  "triceps-corda": "Triceps_Pushdown_-_Rope_Attachment",
  "triceps-na-polia-com-corda": "Triceps_Pushdown_-_Rope_Attachment",
  "triceps-pulley": "Triceps_Pushdown",
  "triceps-testa": "EZ-Bar_Skullcrusher",
  "triceps-frances": "Triceps_Overhead_Extension_with_Rope",
  "triceps-coice": "Tricep_Dumbbell_Kickback",
  "triceps-banco": "Bench_Dips",
  // ── Core ──────────────────────────────────────────────────────────────────
  prancha: "Plank",
  "prancha-frontal": "Plank",
  "abdominal-reto": "Crunches",
  crunch: "Crunches",
  "abdominal-obliquo": "Cross-Body_Crunch",
  "abdominal-na-polia": "Cable_Crunch",
  "russian-twist": "Russian_Twist",
  "elevacao-de-pernas": "Flat_Bench_Lying_Leg_Raise",
  "ab-wheel": "Ab_Roller",
  "dead-bug": "Dead_Bug",
  "abdominal-dead-bug": "Dead_Bug",
  "mountain-climber": "Mountain_Climbers",
  // ── Cardio / condicionamento ──────────────────────────────────────────────
  "corrida-na-esteira": "Running_Treadmill",
  "bicicleta-ergometrica": "Bicycling_Stationary",
  "remo-ergometrico": "Rowing_Stationary",
  "pular-corda": "Rope_Jumping",
  "farmers-walk": "Farmers_Walk",
  "farmer-walk-com-halteres": "Farmers_Walk",
  "power-clean": "Power_Clean",
  // Nao mapeados de proposito — o dataset nao tem equivalente fiel:
  //   bird-dog, burpee  -> inexistentes no acervo
  //   kettlebell-swing  -> so ha swing de UM braco (movimento/pegada diferentes)
  //   thruster          -> so ha thruster de kettlebell (equipamento diverge)
  // Ficam sem imagem em vez de receber uma que ensina outra coisa.
  // ── Alongamento / mobilidade ──────────────────────────────────────────────
  "alongamento-de-panturrilha-na-parede": "Calf_Stretch_Hands_Against_Wall",
  "alongamento-de-soleo": "Seated_Calf_Stretch",
  "alongamento-de-quadriceps-deitado": "All_Fours_Quad_Stretch",
  "alongamento-do-piriforme": "Piriformis-SMR",
  "alongamento-de-peitoral-na-parede": "Chest_And_Front_Of_Shoulder_Stretch",
  "alongamento-peitoral-na-parede": "Chest_And_Front_Of_Shoulder_Stretch",
  "cat-cow": "Cat_Stretch",
  "cat-camel": "Cat_Stretch",
  "worlds-greatest-stretch": "Worlds_Greatest_Stretch",
  inchworm: "Inchworm",
};

const res = await fetch(DATASET);
if (!res.ok) throw new Error("falha ao baixar dataset: HTTP " + res.status);
const dados = await res.json();
const porId = new Map(dados.map((e) => [e.id, e]));

const pares = [];
const invalidos = [];
const semImagem = [];

for (const [slug, id] of Object.entries(MAPA)) {
  const ex = porId.get(id);
  if (!ex) {
    invalidos.push(slug + " -> " + id);
    continue;
  }
  if (!ex.images || !ex.images.length) {
    semImagem.push(slug + " -> " + id);
    continue;
  }
  pares.push({ slug, id, url: CDN + "/" + ex.images[0], nomeEn: ex.name });
}

console.log("dataset: " + dados.length + " exercicios");
console.log("mapeados e validados: " + pares.length);
if (invalidos.length) {
  console.log("\nDESCARTADOS (id inexistente no dataset) — " + invalidos.length + ":");
  invalidos.forEach((x) => console.log("  " + x));
}
if (semImagem.length) {
  console.log("\nDESCARTADOS (sem imagem) — " + semImagem.length + ":");
  semImagem.forEach((x) => console.log("  " + x));
}

const esc = (s) => s.replace(/'/g, "''");
const ordenados = pares.sort((a, b) => a.slug.localeCompare(b.slug));
// A virgula precisa vir ANTES do comentario: "--" comenta ate o fim da linha e
// engoliria o separador, quebrando a lista de values.
const linhas = ordenados
  .map((p, i) => {
    const virgula = i === ordenados.length - 1 ? "" : ",";
    return "  ('" + esc(p.slug) + "', '" + esc(p.url) + "')" + virgula + " -- " + p.nomeEn;
  })
  .join("\n");

const sql = `-- Preenche exercises.thumbnail_url com imagem de demonstracao.
--
-- Fonte: free-exercise-db (github.com/yuhonas/free-exercise-db), licenca
-- Unlicense (dominio publico) — uso comercial livre, sem atribuicao exigida.
-- Escolhido por isso: os acervos de GIF mais populares (ExerciseDB e mirrors)
-- sao midia da Gym Visual re-hospedada sem direito, inviavel num SaaS pago.
--
-- A imagem e servida pela CDN do jsDelivr, nao pelo Supabase Storage. O bucket
-- nao cresce um byte — a cota de 1 GB ja estourou uma vez com video de anamnese.
--
-- So preenche onde thumbnail_url esta nulo/vazio: nunca sobrescreve midia que o
-- professor subiu. Idempotente, pode rodar de novo.
--
-- video_url fica intocado de proposito: o dataset tem foto (posicao inicial),
-- nao video. Enfiar JPG num campo de video quebraria o <video> do
-- ExerciseMediaPreview, que le video_url e so aceita MP4.
--
-- Gerado por scripts/generate-exercise-images-migration.mjs — nao editar a mao.

update public.exercises as e
set thumbnail_url = m.url,
    updated_at = now()
from (values
${linhas}
) as m (slug, url)
where e.slug = m.slug
  and coalesce(e.thumbnail_url, '') = '';
`;

const arquivo = "supabase/migrations/20260819120000_seed_exercise_demo_images.sql";
writeFileSync(arquivo, sql, "utf8");
console.log("\nmigration escrita: " + arquivo + " (" + pares.length + " exercicios)");

/**
 * cleanup-orphan-media.mjs
 *
 * Remove arquivos ORFAOS dos buckets de anamnese: objetos que existem no
 * storage mas que nenhuma linha de `anamneses` referencia.
 *
 * Por que orfaos existem: o formulario publico sobe fotos e videos ANTES de
 * criar a linha em `anamneses`. Se a pessoa abandona o preenchimento ou o
 * submit falha, os arquivos ficam no bucket para sempre, sem nada apontando
 * para eles. A job `purge_expired_media` do automation-dispatch nao alcanca
 * esses arquivos, porque ela itera sobre linhas de `anamneses`.
 *
 * Diferente de `cleanup-storage.mjs`, que apaga TUDO. Este script preserva
 * qualquer arquivo referenciado por uma anamnese viva.
 *
 * Uso:
 *   node scripts/cleanup-orphan-media.mjs              # dry-run (padrao)
 *   node scripts/cleanup-orphan-media.mjs --delete     # apaga de verdade
 *   node scripts/cleanup-orphan-media.mjs --min-age=24 # so orfaos com +24h
 *
 * Credenciais: VITE_SUPABASE_URL em .env e a service role key em .env
 * (SUPABASE_SERVICE_ROLE_KEY) ou em supabase/functions/.env.local
 * (SERVICE_ROLE_KEY).
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const BUCKETS = ["anamnesis-videos", "anamnesis-photos"];

const URL_COLUMNS = [
  "foto_frontal_url",
  "foto_lateral_url",
  "foto_posterior_url",
  "deep_squat_video_frontal_url",
  "deep_squat_video_lateral_url",
  "deep_squat_video_posterior_url",
];

function readEnvFile(relativePath) {
  try {
    const out = {};
    for (const line of readFileSync(resolve(process.cwd(), relativePath), "utf-8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      out[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    }
    return out;
  } catch {
    return {};
  }
}

const args = process.argv.slice(2);
const shouldDelete = args.includes("--delete");
const minAgeHours = Number(args.find((a) => a.startsWith("--min-age="))?.split("=")[1] ?? 0);

const frontEnv = readEnvFile(".env");
const secretEnv = readEnvFile("supabase/functions/.env.local");

const supabaseUrl = frontEnv.VITE_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey =
  frontEnv.SUPABASE_SERVICE_ROLE_KEY ??
  secretEnv.SUPABASE_SERVICE_ROLE_KEY ??
  secretEnv.SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Faltam credenciais: defina VITE_SUPABASE_URL e a service role key.");
  process.exit(1);
}

const db = createClient(supabaseUrl, serviceRoleKey);

const formatMb = (bytes) => (bytes / 1024 / 1024).toFixed(1);

async function listAllObjects(bucket, prefix = "", depth = 0, acc = []) {
  const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 1000 });

  if (error) {
    console.error(`Erro ao listar ${bucket}/${prefix}: ${error.message}`);
    return acc;
  }

  for (const item of data ?? []) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;

    if (typeof item.metadata?.size === "number") {
      acc.push({ path: fullPath, size: item.metadata.size, createdAt: item.created_at ?? null });
    } else if (depth < 3) {
      // Sem metadata = pasta. Desce mais um nivel.
      await listAllObjects(bucket, fullPath, depth + 1, acc);
    }
  }

  return acc;
}

// Extrai o caminho dentro do bucket a partir da URL publica gravada na linha.
function storagePathFromUrl(url, bucket) {
  if (!url) return null;
  const marker = `/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length)).split("?")[0];
}

async function main() {
  const { data: rows, error } = await db.from("anamneses").select(`id, ${URL_COLUMNS.join(", ")}`);

  if (error) {
    console.error(`Erro ao ler anamneses: ${error.message}`);
    process.exit(1);
  }

  console.log(`Anamneses no banco: ${rows?.length ?? 0}`);
  console.log(shouldDelete ? "MODO: EXCLUSAO REAL\n" : "MODO: dry-run (nada sera apagado)\n");

  const cutoff = minAgeHours > 0 ? Date.now() - minAgeHours * 3600 * 1000 : null;
  let totalOrphanBytes = 0;
  let totalOrphanCount = 0;
  let totalKeptBytes = 0;

  for (const bucket of BUCKETS) {
    const referenced = new Set();
    for (const row of rows ?? []) {
      for (const column of URL_COLUMNS) {
        const path = storagePathFromUrl(row[column], bucket);
        if (path) referenced.add(path);
      }
    }

    const objects = await listAllObjects(bucket);
    const orphans = [];

    for (const obj of objects) {
      if (referenced.has(obj.path)) {
        totalKeptBytes += obj.size;
        continue;
      }
      if (cutoff && obj.createdAt && new Date(obj.createdAt).getTime() > cutoff) continue;
      orphans.push(obj);
    }

    console.log(`── ${bucket}`);
    console.log(`   objetos: ${objects.length} | referenciados: ${objects.length - orphans.length} | orfaos: ${orphans.length}`);

    for (const orphan of orphans) {
      const when = orphan.createdAt ? String(orphan.createdAt).slice(0, 16).replace("T", " ") : "sem data";
      console.log(`   ${formatMb(orphan.size).padStart(8)} MB  ${when}  ${orphan.path}`);
      totalOrphanBytes += orphan.size;
      totalOrphanCount++;
    }

    if (shouldDelete && orphans.length > 0) {
      // .remove() aceita no maximo ~1000 caminhos por chamada; lotes de 100 por seguranca.
      for (let i = 0; i < orphans.length; i += 100) {
        const batch = orphans.slice(i, i + 100).map((o) => o.path);
        const { error: removeError } = await db.storage.from(bucket).remove(batch);
        if (removeError) console.error(`   ERRO ao apagar lote: ${removeError.message}`);
        else console.log(`   apagados ${batch.length} arquivos`);
      }
    }

    console.log("");
  }

  console.log("──────────────────────────────────────────");
  console.log(`Orfaos:        ${totalOrphanCount} arquivos, ${formatMb(totalOrphanBytes)} MB`);
  console.log(`Preservados:   ${formatMb(totalKeptBytes)} MB (referenciados por anamneses)`);

  if (!shouldDelete && totalOrphanCount > 0) {
    console.log("\nPara apagar de verdade: node scripts/cleanup-orphan-media.mjs --delete");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

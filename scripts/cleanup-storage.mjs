/**
 * cleanup-storage.mjs
 * Apaga todos os arquivos dos buckets de storage do Supabase.
 * Uso: node scripts/cleanup-storage.mjs
 * Requer: VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Carrega .env manualmente (sem dotenv como dep)
function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), ".env");
    const lines = readFileSync(envPath, "utf-8").split("\n");
    const env = {};
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
      env[key] = value;
    }
    return env;
  } catch {
    return {};
  }
}

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios no .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const BUCKETS = [
  "anamnesis-photos",
  "anamnesis-videos",
  "student-profile-photos",
  "exercise-media",
  "payment-proofs",
  "profile-avatars",
];

async function listAllFiles(bucket, prefix = "") {
  const { data, error } = await supabase.storage.from(bucket).list(prefix, {
    limit: 1000,
    offset: 0,
  });
  if (error) throw new Error(`Erro ao listar ${bucket}/${prefix}: ${error.message}`);
  if (!data || data.length === 0) return [];

  const files = [];
  for (const item of data) {
    if (item.id) {
      // É um arquivo
      files.push(prefix ? `${prefix}/${item.name}` : item.name);
    } else {
      // É uma pasta — lista recursivamente
      const nested = await listAllFiles(bucket, prefix ? `${prefix}/${item.name}` : item.name);
      files.push(...nested);
    }
  }
  return files;
}

async function deleteBucket(bucket) {
  console.log(`\n📂 Bucket: ${bucket}`);
  const files = await listAllFiles(bucket);

  if (files.length === 0) {
    console.log("  ✓ Já vazio");
    return 0;
  }

  console.log(`  ${files.length} arquivo(s) encontrado(s). Deletando em lotes...`);

  const BATCH = 100;
  let deleted = 0;
  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files.slice(i, i + BATCH);
    const { error } = await supabase.storage.from(bucket).remove(batch);
    if (error) {
      console.warn(`  ⚠ Erro ao deletar lote: ${error.message}`);
    } else {
      deleted += batch.length;
      console.log(`  ✓ ${deleted}/${files.length} deletados`);
    }
  }
  return deleted;
}

async function main() {
  console.log("🧹 Limpeza de Storage — Sano+");
  console.log(`   URL: ${supabaseUrl}`);
  console.log("   Modo: service role (bypassa RLS)\n");

  let totalDeleted = 0;
  for (const bucket of BUCKETS) {
    try {
      totalDeleted += await deleteBucket(bucket);
    } catch (err) {
      console.error(`  ❌ ${err.message}`);
    }
  }

  console.log(`\n✅ Limpeza concluída — ${totalDeleted} arquivo(s) removido(s) no total.`);
  console.log("   Execute o script SQL cleanup-test-data.sql no Supabase Dashboard para limpar o banco.\n");
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});

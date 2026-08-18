-- Política de retenção de mídia: arquivos deletados automaticamente 7 dias após o envio.
-- Campos adicionados na tabela anamneses para rastrear ciclo de vida das mídias.

alter table public.anamneses
  add column if not exists media_expires_at          timestamptz,
  add column if not exists media_deletado            boolean     not null default false,
  add column if not exists media_deletado_em         timestamptz,
  add column if not exists media_download_confirmado boolean     not null default false,
  add column if not exists media_download_confirmado_em timestamptz,
  add column if not exists media_lembrete_enviado    boolean     not null default false;

-- Backfill: anamneses já existentes sem media_expires_at recebem prazo de 7 dias a partir de submitted_at
update public.anamneses
set media_expires_at = submitted_at + interval '7 days'
where media_expires_at is null
  and (
    foto_frontal_url is not null
    or foto_lateral_url is not null
    or foto_posterior_url is not null
    or deep_squat_video_frontal_url is not null
    or deep_squat_video_lateral_url is not null
    or deep_squat_video_posterior_url is not null
  );

-- Índice para o job de limpeza (busca por expires_at e deletado)
create index if not exists anamneses_media_expires_idx
  on public.anamneses (media_expires_at)
  where media_deletado = false;

-- Índice para o job de lembrete
create index if not exists anamneses_media_lembrete_idx
  on public.anamneses (media_expires_at)
  where media_lembrete_enviado = false and media_deletado = false;

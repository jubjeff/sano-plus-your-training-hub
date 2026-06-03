-- Novos campos na tabela anamneses: fotos posturais e testes FMS
alter table public.anamneses
  add column if not exists foto_frontal_url   text,
  add column if not exists foto_lateral_url   text,
  add column if not exists foto_posterior_url text,

  add column if not exists fms_hurdle_step_direito   integer check (fms_hurdle_step_direito   between 0 and 3),
  add column if not exists fms_hurdle_step_esquerdo  integer check (fms_hurdle_step_esquerdo  between 0 and 3),
  add column if not exists fms_hurdle_obs            text,

  add column if not exists fms_lunge_direito         integer check (fms_lunge_direito          between 0 and 3),
  add column if not exists fms_lunge_esquerdo        integer check (fms_lunge_esquerdo         between 0 and 3),
  add column if not exists fms_lunge_obs             text,

  add column if not exists fms_score_total           integer;

-- Bucket de fotos de anamnese (público para leitura, anon pode inserir)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'anamnesis-photos',
  'anamnesis-photos',
  true,
  10485760,
  array['image/jpeg','image/jpg','image/png','image/webp']
)
on conflict (id) do nothing;

-- Qualquer pessoa pode fazer upload (anon ou autenticado)
create policy "anon_upload_anamnesis_photos"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'anamnesis-photos');

-- Qualquer pessoa pode ler (bucket público)
create policy "public_read_anamnesis_photos"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'anamnesis-photos');

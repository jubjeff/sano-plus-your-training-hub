-- Deep Squat: substituição do Hurdle Step
-- Colunas genéricas de hurdle step ficam (podem ser nulas para novas submissões)
alter table public.anamneses
  add column if not exists deep_squat_score              integer check (deep_squat_score between 0 and 3),
  add column if not exists deep_squat_obs                text,
  add column if not exists deep_squat_video_frontal_url  text,
  add column if not exists deep_squat_video_lateral_url  text,
  add column if not exists deep_squat_video_posterior_url text;

-- Bucket de vídeos do Deep Squat (200 MB máx por arquivo)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'anamnesis-videos',
  'anamnesis-videos',
  true,
  209715200,
  array['video/mp4','video/quicktime','video/webm','video/x-msvideo']
)
on conflict (id) do nothing;

create policy "anon_upload_anamnesis_videos"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'anamnesis-videos');

create policy "public_read_anamnesis_videos"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'anamnesis-videos');

alter table public.exercises
  add column if not exists movement_category text,
  add column if not exists mechanical_type text,
  add column if not exists laterality text,
  add column if not exists movement_plane text,
  add column if not exists aliases text[] not null default '{}';

alter table public.exercises
  drop constraint if exists exercises_mechanical_type_chk,
  drop constraint if exists exercises_laterality_chk,
  drop constraint if exists exercises_movement_plane_chk;

alter table public.exercises
  add constraint exercises_mechanical_type_chk
    check (mechanical_type is null or mechanical_type in ('Composto', 'Isolado')),
  add constraint exercises_laterality_chk
    check (laterality is null or laterality in ('Bilateral', 'Unilateral')),
  add constraint exercises_movement_plane_chk
    check (movement_plane is null or movement_plane in ('Sagital', 'Frontal', 'Transversal', 'Multiplanar'));

create index if not exists exercises_movement_category_idx on public.exercises (movement_category);
create index if not exists exercises_mechanical_type_idx on public.exercises (mechanical_type);
create index if not exists exercises_laterality_idx on public.exercises (laterality);
create index if not exists exercises_movement_plane_idx on public.exercises (movement_plane);
create index if not exists exercises_aliases_gin_idx on public.exercises using gin (aliases);

update public.exercises
set slug = 'supino-reto'
where slug = 'supino-reto-com-barra'
  and not exists (select 1 from public.exercises existing where existing.slug = 'supino-reto');

update public.exercises
set slug = 'supino-inclinado'
where slug = 'supino-inclinado-com-halteres'
  and not exists (select 1 from public.exercises existing where existing.slug = 'supino-inclinado');

update public.exercises
set slug = 'leg-press'
where slug = 'leg-press-45'
  and not exists (select 1 from public.exercises existing where existing.slug = 'leg-press');

update public.exercises
set slug = 'remada-curvada'
where slug = 'remada-curvada-com-barra'
  and not exists (select 1 from public.exercises existing where existing.slug = 'remada-curvada');

update public.exercises
set slug = 'puxada-frontal'
where slug = 'puxada-frontal-na-polia'
  and not exists (select 1 from public.exercises existing where existing.slug = 'puxada-frontal');

update public.exercises
set slug = 'rosca-direta'
where slug = 'rosca-direta-com-barra'
  and not exists (select 1 from public.exercises existing where existing.slug = 'rosca-direta');

update public.exercises
set slug = 'triceps-corda'
where slug = 'triceps-na-polia-com-corda'
  and not exists (select 1 from public.exercises existing where existing.slug = 'triceps-corda');

update public.exercises
set slug = 'elevacao-pelvica'
where slug = 'hip-thrust-com-barra'
  and not exists (select 1 from public.exercises existing where existing.slug = 'elevacao-pelvica');

update public.exercises
set slug = 'panturrilha-em-pe'
where slug = 'panturrilha-em-pe-na-maquina'
  and not exists (select 1 from public.exercises existing where existing.slug = 'panturrilha-em-pe');

update public.exercises
set slug = 'prancha'
where slug = 'prancha-frontal'
  and not exists (select 1 from public.exercises existing where existing.slug = 'prancha');

update public.exercises
set slug = 'caminhada-do-fazendeiro'
where slug = 'farmer-walk-com-halteres'
  and not exists (select 1 from public.exercises existing where existing.slug = 'caminhada-do-fazendeiro');

with seed (
  name,
  slug,
  aliases,
  muscle_category,
  muscle_group_primary,
  muscle_groups_secondary,
  movement_type,
  movement_category,
  body_region,
  equipment,
  difficulty_level,
  exercise_type,
  mechanical_type,
  laterality,
  movement_plane
) as (
values
  ('Supino reto', 'supino-reto', array['Supino reto com barra']::text[], 'Peito', 'Peitoral maior', array['Deltoide anterior', 'TrÃ­ceps braquial']::text[], 'Empurrar', 'Empurrar horizontal', 'Membros superiores', 'Barra', 'IntermediÃ¡rio', 'ForÃ§a', 'Composto', 'Bilateral', 'Transversal'),
  ('Supino inclinado', 'supino-inclinado', array['Supino inclinado com halteres']::text[], 'Peito', 'Peitoral maior', array['Deltoide anterior', 'TrÃ­ceps braquial']::text[], 'Empurrar', 'Empurrar horizontal', 'Membros superiores', 'Banco inclinado', 'IntermediÃ¡rio', 'Hipertrofia', 'Composto', 'Bilateral', 'Transversal'),
  ('Supino declinado', 'supino-declinado', array[]::text[], 'Peito', 'Peitoral maior', array['Deltoide anterior', 'TrÃ­ceps braquial']::text[], 'Empurrar', 'Empurrar horizontal', 'Membros superiores', 'Banco declinado', 'IntermediÃ¡rio', 'Hipertrofia', 'Composto', 'Bilateral', 'Transversal'),
  ('Crucifixo reto', 'crucifixo-reto', array[]::text[], 'Peito', 'Peitoral maior', array['Deltoide anterior']::text[], 'Empurrar', 'Empurrar horizontal', 'Membros superiores', 'Halteres', 'Iniciante', 'Hipertrofia', 'Isolado', 'Bilateral', 'Transversal'),
  ('Crucifixo inclinado', 'crucifixo-inclinado', array[]::text[], 'Peito', 'Peitoral maior', array['Deltoide anterior']::text[], 'Empurrar', 'Empurrar horizontal', 'Membros superiores', 'Halteres', 'Iniciante', 'Hipertrofia', 'Isolado', 'Bilateral', 'Transversal'),
  ('Crossover', 'crossover', array['Crossover na polia']::text[], 'Peito', 'Peitoral maior', array['Deltoide anterior']::text[], 'Empurrar', 'Empurrar horizontal', 'Membros superiores', 'Cabo', 'Iniciante', 'Hipertrofia', 'Isolado', 'Bilateral', 'Transversal'),
  ('Peck deck', 'peck-deck', array['Voador']::text[], 'Peito', 'Peitoral maior', array['Deltoide anterior']::text[], 'Empurrar', 'Empurrar horizontal', 'Membros superiores', 'MÃ¡quina', 'Iniciante', 'Hipertrofia', 'Isolado', 'Bilateral', 'Transversal'),
  ('Pullover', 'pullover', array[]::text[], 'Peito', 'Peitoral maior', array['LatÃ­ssimo do dorso', 'TrÃ­ceps braquial']::text[], 'Empurrar', 'FlexÃ£o de ombro', 'Membros superiores', 'Halteres', 'IntermediÃ¡rio', 'Hipertrofia', 'Composto', 'Bilateral', 'Sagital'),
  ('Puxada frontal', 'puxada-frontal', array['Puxada frontal na polia']::text[], 'Costas', 'LatÃ­ssimo do dorso', array['BÃ­ceps braquial', 'Romboides']::text[], 'Puxar', 'Puxar vertical', 'Membros superiores', 'Cabo', 'Iniciante', 'Hipertrofia', 'Composto', 'Bilateral', 'Frontal'),
  ('Puxada atrÃ¡s', 'puxada-atras', array[]::text[], 'Costas', 'LatÃ­ssimo do dorso', array['BÃ­ceps braquial', 'Romboides']::text[], 'Puxar', 'Puxar vertical', 'Membros superiores', 'Cabo', 'AvanÃ§ado', 'Hipertrofia', 'Composto', 'Bilateral', 'Frontal'),
  ('Barra fixa', 'barra-fixa', array[]::text[], 'Costas', 'LatÃ­ssimo do dorso', array['BÃ­ceps braquial', 'Romboides']::text[], 'Puxar', 'Puxar vertical', 'Membros superiores', 'Barra fixa', 'IntermediÃ¡rio', 'ForÃ§a', 'Composto', 'Bilateral', 'Frontal'),
  ('Remada curvada', 'remada-curvada', array['Remada curvada com barra']::text[], 'Costas', 'LatÃ­ssimo do dorso', array['Romboides', 'TrapÃ©zio', 'BÃ­ceps braquial']::text[], 'Puxar', 'Puxar horizontal', 'Membros superiores', 'Barra', 'IntermediÃ¡rio', 'ForÃ§a', 'Composto', 'Bilateral', 'Transversal'),
  ('Remada unilateral', 'remada-unilateral', array[]::text[], 'Costas', 'LatÃ­ssimo do dorso', array['Romboides', 'BÃ­ceps braquial']::text[], 'Puxar', 'Puxar horizontal', 'Membros superiores', 'Halteres', 'Iniciante', 'Hipertrofia', 'Composto', 'Unilateral', 'Transversal'),
  ('Remada cavalinho', 'remada-cavalinho', array[]::text[], 'Costas', 'LatÃ­ssimo do dorso', array['Romboides', 'TrapÃ©zio', 'BÃ­ceps braquial']::text[], 'Puxar', 'Puxar horizontal', 'Membros superiores', 'Barra T', 'IntermediÃ¡rio', 'ForÃ§a', 'Composto', 'Bilateral', 'Transversal'),
  ('Remada baixa', 'remada-baixa', array[]::text[], 'Costas', 'LatÃ­ssimo do dorso', array['Romboides', 'BÃ­ceps braquial']::text[], 'Puxar', 'Puxar horizontal', 'Membros superiores', 'Cabo', 'Iniciante', 'Hipertrofia', 'Composto', 'Bilateral', 'Transversal'),
  ('Remada alta', 'remada-alta', array[]::text[], 'Costas', 'TrapÃ©zio', array['Deltoide posterior', 'Romboides']::text[], 'Puxar', 'Puxar horizontal', 'Membros superiores', 'Cabo', 'IntermediÃ¡rio', 'Hipertrofia', 'Composto', 'Bilateral', 'Transversal'),
  ('Pulldown', 'pulldown', array['Pulldown na polia']::text[], 'Costas', 'LatÃ­ssimo do dorso', array['Reto abdominal', 'TrÃ­ceps braquial']::text[], 'Puxar', 'FlexÃ£o de ombro', 'Membros superiores', 'Cabo', 'Iniciante', 'Hipertrofia', 'Isolado', 'Bilateral', 'Sagital'),
  ('Levantamento terra', 'levantamento-terra', array[]::text[], 'Corpo inteiro', 'Posterior de coxa', array['GlÃºteo mÃ¡ximo', 'Eretores da espinha', 'TrapÃ©zio']::text[], 'Levantar', 'Hinge', 'Corpo inteiro', 'Barra', 'AvanÃ§ado', 'ForÃ§a', 'Composto', 'Bilateral', 'Sagital'),
  ('Desenvolvimento militar', 'desenvolvimento-militar', array[]::text[], 'Ombros', 'Deltoide anterior', array['Deltoide lateral', 'TrÃ­ceps braquial']::text[], 'Empurrar', 'Empurrar vertical', 'Membros superiores', 'Barra', 'IntermediÃ¡rio', 'ForÃ§a', 'Composto', 'Bilateral', 'Frontal'),
  ('Desenvolvimento com halteres', 'desenvolvimento-com-halteres', array[]::text[], 'Ombros', 'Deltoide anterior', array['Deltoide lateral', 'TrÃ­ceps braquial']::text[], 'Empurrar', 'Empurrar vertical', 'Membros superiores', 'Halteres', 'IntermediÃ¡rio', 'Hipertrofia', 'Composto', 'Bilateral', 'Frontal'),
  ('ElevaÃ§Ã£o lateral', 'elevacao-lateral', array[]::text[], 'Ombros', 'Deltoide lateral', array['TrapÃ©zio']::text[], 'Empurrar', 'AbduÃ§Ã£o de ombro', 'Membros superiores', 'Halteres', 'Iniciante', 'Hipertrofia', 'Isolado', 'Bilateral', 'Frontal'),
  ('ElevaÃ§Ã£o frontal', 'elevacao-frontal', array[]::text[], 'Ombros', 'Deltoide anterior', array['TrapÃ©zio']::text[], 'Empurrar', 'FlexÃ£o de ombro', 'Membros superiores', 'Halteres', 'Iniciante', 'Hipertrofia', 'Isolado', 'Bilateral', 'Sagital'),
  ('Crucifixo invertido', 'crucifixo-invertido', array[]::text[], 'Ombros', 'Deltoide posterior', array['Romboides', 'TrapÃ©zio']::text[], 'Puxar', 'Puxar horizontal', 'Membros superiores', 'Halteres', 'Iniciante', 'Hipertrofia', 'Isolado', 'Bilateral', 'Transversal'),
  ('Face pull', 'face-pull', array[]::text[], 'Ombros', 'Deltoide posterior', array['TrapÃ©zio', 'Romboides']::text[], 'Puxar', 'RetraÃ§Ã£o escapular', 'Membros superiores', 'Cabo', 'Iniciante', 'AtivaÃ§Ã£o', 'Composto', 'Bilateral', 'Transversal'),
  ('Encolhimento', 'encolhimento', array[]::text[], 'Ombros', 'TrapÃ©zio', array[]::text[], 'Puxar', 'RetraÃ§Ã£o escapular', 'Membros superiores', 'Halteres', 'Iniciante', 'Hipertrofia', 'Isolado', 'Bilateral', 'Frontal'),
  ('Arnold press', 'arnold-press', array['Desenvolvimento Arnold']::text[], 'Ombros', 'Deltoide anterior', array['Deltoide lateral', 'TrÃ­ceps braquial']::text[], 'Empurrar', 'Empurrar vertical', 'Membros superiores', 'Halteres', 'IntermediÃ¡rio', 'Hipertrofia', 'Composto', 'Bilateral', 'Multiplanar'),
  ('Rosca direta', 'rosca-direta', array['Rosca direta com barra']::text[], 'BÃ­ceps', 'BÃ­ceps braquial', array['Braquial', 'AntebraÃ§os']::text[], 'Puxar', 'FlexÃ£o de cotovelo', 'Membros superiores', 'Barra', 'Iniciante', 'Hipertrofia', 'Isolado', 'Bilateral', 'Sagital'),
  ('Rosca alternada', 'rosca-alternada', array[]::text[], 'BÃ­ceps', 'BÃ­ceps braquial', array['Braquial', 'AntebraÃ§os']::text[], 'Puxar', 'FlexÃ£o de cotovelo', 'Membros superiores', 'Halteres', 'Iniciante', 'Hipertrofia', 'Isolado', 'Unilateral', 'Sagital'),
  ('Rosca martelo', 'rosca-martelo', array[]::text[], 'BÃ­ceps', 'Braquial', array['BÃ­ceps braquial', 'AntebraÃ§os']::text[], 'Puxar', 'FlexÃ£o de cotovelo', 'Membros superiores', 'Halteres', 'Iniciante', 'Hipertrofia', 'Isolado', 'Unilateral', 'Sagital'),
  ('Rosca concentrada', 'rosca-concentrada', array[]::text[], 'BÃ­ceps', 'BÃ­ceps braquial', array['Braquial']::text[], 'Puxar', 'FlexÃ£o de cotovelo', 'Membros superiores', 'Halteres', 'Iniciante', 'Hipertrofia', 'Isolado', 'Unilateral', 'Sagital'),
  ('Rosca Scott', 'rosca-scott', array[]::text[], 'BÃ­ceps', 'BÃ­ceps braquial', array['Braquial']::text[], 'Puxar', 'FlexÃ£o de cotovelo', 'Membros superiores', 'Banco Scott', 'Iniciante', 'Hipertrofia', 'Isolado', 'Bilateral', 'Sagital'),
  ('Rosca inclinada', 'rosca-inclinada', array[]::text[], 'BÃ­ceps', 'BÃ­ceps braquial', array['Braquial']::text[], 'Puxar', 'FlexÃ£o de cotovelo', 'Membros superiores', 'Banco inclinado', 'Iniciante', 'Hipertrofia', 'Isolado', 'Bilateral', 'Sagital'),
  ('Rosca inversa', 'rosca-inversa', array[]::text[], 'AntebraÃ§o', 'AntebraÃ§os', array['Braquial', 'BÃ­ceps braquial']::text[], 'Puxar', 'FlexÃ£o de cotovelo', 'Membros superiores', 'Barra', 'Iniciante', 'Hipertrofia', 'Isolado', 'Bilateral', 'Sagital'),
  ('Rosca no cabo', 'rosca-no-cabo', array[]::text[], 'BÃ­ceps', 'BÃ­ceps braquial', array['Braquial']::text[], 'Puxar', 'FlexÃ£o de cotovelo', 'Membros superiores', 'Cabo', 'Iniciante', 'Hipertrofia', 'Isolado', 'Bilateral', 'Sagital'),
  ('TrÃ­ceps pulley', 'triceps-pulley', array[]::text[], 'TrÃ­ceps', 'TrÃ­ceps braquial', array[]::text[], 'Empurrar', 'ExtensÃ£o de cotovelo', 'Membros superiores', 'Cabo', 'Iniciante', 'Hipertrofia', 'Isolado', 'Bilateral', 'Sagital'),
  ('TrÃ­ceps corda', 'triceps-corda', array['TrÃ­ceps na polia com corda']::text[], 'TrÃ­ceps', 'TrÃ­ceps braquial', array[]::text[], 'Empurrar', 'ExtensÃ£o de cotovelo', 'Membros superiores', 'Cabo', 'Iniciante', 'Hipertrofia', 'Isolado', 'Bilateral', 'Sagital'),
  ('TrÃ­ceps francÃªs', 'triceps-frances', array[]::text[], 'TrÃ­ceps', 'TrÃ­ceps braquial', array[]::text[], 'Empurrar', 'ExtensÃ£o de cotovelo', 'Membros superiores', 'Halteres', 'IntermediÃ¡rio', 'Hipertrofia', 'Isolado', 'Unilateral', 'Sagital'),
  ('TrÃ­ceps testa', 'triceps-testa', array[]::text[], 'TrÃ­ceps', 'TrÃ­ceps braquial', array[]::text[], 'Empurrar', 'ExtensÃ£o de cotovelo', 'Membros superiores', 'Barra', 'IntermediÃ¡rio', 'Hipertrofia', 'Isolado', 'Bilateral', 'Sagital'),
  ('TrÃ­ceps banco', 'triceps-banco', array[]::text[], 'TrÃ­ceps', 'TrÃ­ceps braquial', array['Deltoide anterior', 'Peitoral maior']::text[], 'Empurrar', 'ExtensÃ£o de cotovelo', 'Membros superiores', 'Banco', 'IntermediÃ¡rio', 'ResistÃªncia', 'Composto', 'Bilateral', 'Sagital'),
  ('TrÃ­ceps coice', 'triceps-coice', array[]::text[], 'TrÃ­ceps', 'TrÃ­ceps braquial', array[]::text[], 'Empurrar', 'ExtensÃ£o de cotovelo', 'Membros superiores', 'Halteres', 'Iniciante', 'Hipertrofia', 'Isolado', 'Unilateral', 'Sagital'),
  ('Paralelas', 'paralelas', array[]::text[], 'TrÃ­ceps', 'TrÃ­ceps braquial', array['Peitoral maior', 'Deltoide anterior']::text[], 'Empurrar', 'Empurrar vertical', 'Membros superiores', 'Paralelas', 'IntermediÃ¡rio', 'ForÃ§a', 'Composto', 'Bilateral', 'Sagital'),
  ('Supino fechado', 'supino-fechado', array[]::text[], 'TrÃ­ceps', 'TrÃ­ceps braquial', array['Peitoral maior', 'Deltoide anterior']::text[], 'Empurrar', 'Empurrar horizontal', 'Membros superiores', 'Barra', 'IntermediÃ¡rio', 'ForÃ§a', 'Composto', 'Bilateral', 'Transversal'),
  ('Agachamento livre', 'agachamento-livre', array[]::text[], 'QuadrÃ­ceps e glÃºteos', 'QuadrÃ­ceps', array['GlÃºteo mÃ¡ximo', 'Core']::text[], 'Agachar', 'Agachar', 'Membros inferiores', 'Barra', 'IntermediÃ¡rio', 'ForÃ§a', 'Composto', 'Bilateral', 'Sagital'),
  ('Agachamento frontal', 'agachamento-frontal', array[]::text[], 'QuadrÃ­ceps e glÃºteos', 'QuadrÃ­ceps', array['GlÃºteo mÃ¡ximo', 'Core']::text[], 'Agachar', 'Agachar', 'Membros inferiores', 'Barra', 'IntermediÃ¡rio', 'ForÃ§a', 'Composto', 'Bilateral', 'Sagital'),
  ('Agachamento sumÃ´', 'agachamento-sumo', array[]::text[], 'QuadrÃ­ceps e glÃºteos', 'Adutores', array['GlÃºteo mÃ¡ximo', 'QuadrÃ­ceps']::text[], 'Agachar', 'Agachar', 'Membros inferiores', 'Halteres', 'IntermediÃ¡rio', 'Hipertrofia', 'Composto', 'Bilateral', 'Sagital'),
  ('Leg press', 'leg-press', array['Leg press 45Â°']::text[], 'QuadrÃ­ceps e glÃºteos', 'QuadrÃ­ceps', array['GlÃºteo mÃ¡ximo', 'Posterior de coxa']::text[], 'Empurrar', 'Agachar', 'Membros inferiores', 'Leg press', 'Iniciante', 'Hipertrofia', 'Composto', 'Bilateral', 'Sagital'),
  ('Cadeira extensora', 'cadeira-extensora', array[]::text[], 'QuadrÃ­ceps e glÃºteos', 'QuadrÃ­ceps', array[]::text[], 'Empurrar', 'ExtensÃ£o de joelho', 'Membros inferiores', 'MÃ¡quina', 'Iniciante', 'Hipertrofia', 'Isolado', 'Bilateral', 'Sagital'),
  ('Afundo', 'afundo', array[]::text[], 'QuadrÃ­ceps e glÃºteos', 'QuadrÃ­ceps', array['GlÃºteo mÃ¡ximo', 'Posterior de coxa']::text[], 'Agachar', 'AvanÃ§o', 'Membros inferiores', 'Halteres', 'IntermediÃ¡rio', 'Hipertrofia', 'Composto', 'Unilateral', 'Sagital'),
  ('Passada', 'passada', array[]::text[], 'QuadrÃ­ceps e glÃºteos', 'QuadrÃ­ceps', array['GlÃºteo mÃ¡ximo', 'Posterior de coxa']::text[], 'Locomover', 'AvanÃ§o', 'Membros inferiores', 'Halteres', 'IntermediÃ¡rio', 'Condicionamento', 'Composto', 'Unilateral', 'Sagital'),
  ('Hack squat', 'hack-squat', array['Agachamento hack']::text[], 'QuadrÃ­ceps e glÃºteos', 'QuadrÃ­ceps', array['GlÃºteo mÃ¡ximo']::text[], 'Agachar', 'Agachar', 'Membros inferiores', 'Hack machine', 'Iniciante', 'Hipertrofia', 'Composto', 'Bilateral', 'Sagital'),
  ('Agachamento bÃºlgaro', 'agachamento-bulgaro', array[]::text[], 'QuadrÃ­ceps e glÃºteos', 'QuadrÃ­ceps', array['GlÃºteo mÃ¡ximo', 'Posterior de coxa']::text[], 'Agachar', 'AvanÃ§o', 'Membros inferiores', 'Banco', 'IntermediÃ¡rio', 'Hipertrofia', 'Composto', 'Unilateral', 'Sagital'),
  ('Smith squat', 'smith-squat', array['Agachamento no smith']::text[], 'QuadrÃ­ceps e glÃºteos', 'QuadrÃ­ceps', array['GlÃºteo mÃ¡ximo']::text[], 'Agachar', 'Agachar', 'Membros inferiores', 'Smith', 'Iniciante', 'Hipertrofia', 'Composto', 'Bilateral', 'Sagital'),
  ('Stiff', 'stiff', array[]::text[], 'Posterior de coxa', 'Posterior de coxa', array['GlÃºteo mÃ¡ximo', 'Eretores da espinha']::text[], 'Levantar', 'Hinge', 'Membros inferiores', 'Barra', 'IntermediÃ¡rio', 'Hipertrofia', 'Composto', 'Bilateral', 'Sagital'),
  ('Levantamento terra romeno', 'levantamento-terra-romeno', array['Terra romeno']::text[], 'Posterior de coxa', 'Posterior de coxa', array['GlÃºteo mÃ¡ximo', 'Eretores da espinha']::text[], 'Levantar', 'Hinge', 'Membros inferiores', 'Barra', 'IntermediÃ¡rio', 'ForÃ§a', 'Composto', 'Bilateral', 'Sagital'),
  ('ElevaÃ§Ã£o pÃ©lvica', 'elevacao-pelvica', array['Hip thrust com barra']::text[], 'QuadrÃ­ceps e glÃºteos', 'GlÃºteo mÃ¡ximo', array['Posterior de coxa', 'Core']::text[], 'Levantar', 'Hinge', 'Membros inferiores', 'Barra', 'IntermediÃ¡rio', 'Hipertrofia', 'Composto', 'Bilateral', 'Sagital'),
  ('Glute bridge', 'glute-bridge', array['Ponte de glÃºteos']::text[], 'QuadrÃ­ceps e glÃºteos', 'GlÃºteo mÃ¡ximo', array['Posterior de coxa', 'Core']::text[], 'Levantar', 'Hinge', 'Membros inferiores', 'Peso corporal', 'Iniciante', 'AtivaÃ§Ã£o', 'Composto', 'Bilateral', 'Sagital'),
  ('Coice no cabo', 'coice-no-cabo', array[]::text[], 'QuadrÃ­ceps e glÃºteos', 'GlÃºteo mÃ¡ximo', array['Posterior de coxa']::text[], 'Empurrar', 'ExtensÃ£o de quadril', 'Membros inferiores', 'Cabo', 'Iniciante', 'Hipertrofia', 'Isolado', 'Unilateral', 'Sagital'),
  ('AbduÃ§Ã£o de quadril', 'abducao-de-quadril', array[]::text[], 'QuadrÃ­ceps e glÃºteos', 'GlÃºteo mÃ©dio', array['GlÃºteo mÃ¡ximo']::text[], 'Empurrar', 'AbduÃ§Ã£o de quadril', 'Membros inferiores', 'Cabo', 'Iniciante', 'AtivaÃ§Ã£o', 'Isolado', 'Unilateral', 'Frontal'),
  ('Adutora', 'adutora', array['Cadeira adutora']::text[], 'QuadrÃ­ceps e glÃºteos', 'Adutores', array[]::text[], 'Empurrar', 'AduÃ§Ã£o de quadril', 'Membros inferiores', 'MÃ¡quina', 'Iniciante', 'Hipertrofia', 'Isolado', 'Bilateral', 'Frontal'),
  ('Abdutora', 'abdutora', array['Cadeira abdutora']::text[], 'QuadrÃ­ceps e glÃºteos', 'GlÃºteo mÃ©dio', array['GlÃºteo mÃ¡ximo']::text[], 'Empurrar', 'AbduÃ§Ã£o de quadril', 'Membros inferiores', 'MÃ¡quina', 'Iniciante', 'Hipertrofia', 'Isolado', 'Bilateral', 'Frontal'),
  ('Mesa flexora', 'mesa-flexora', array[]::text[], 'Posterior de coxa', 'Posterior de coxa', array['Panturrilhas']::text[], 'Puxar', 'FlexÃ£o de joelho', 'Membros inferiores', 'MÃ¡quina', 'Iniciante', 'Hipertrofia', 'Isolado', 'Bilateral', 'Sagital'),
  ('Cadeira flexora', 'cadeira-flexora', array[]::text[], 'Posterior de coxa', 'Posterior de coxa', array['Panturrilhas']::text[], 'Puxar', 'FlexÃ£o de joelho', 'Membros inferiores', 'MÃ¡quina', 'Iniciante', 'Hipertrofia', 'Isolado', 'Bilateral', 'Sagital'),
  ('Good morning', 'good-morning', array[]::text[], 'Posterior de coxa', 'Posterior de coxa', array['GlÃºteo mÃ¡ximo', 'Eretores da espinha']::text[], 'Levantar', 'Hinge', 'Membros inferiores', 'Barra', 'AvanÃ§ado', 'TÃ©cnica', 'Composto', 'Bilateral', 'Sagital'),
  ('Panturrilha em pÃ©', 'panturrilha-em-pe', array['Panturrilha em pÃ© na mÃ¡quina']::text[], 'Panturrilhas', 'Panturrilhas', array[]::text[], 'Empurrar', 'FlexÃ£o plantar', 'Membros inferiores', 'MÃ¡quina', 'Iniciante', 'ResistÃªncia', 'Isolado', 'Bilateral', 'Sagital'),
  ('Panturrilha sentada', 'panturrilha-sentada', array[]::text[], 'Panturrilhas', 'Panturrilhas', array[]::text[], 'Empurrar', 'FlexÃ£o plantar', 'Membros inferiores', 'MÃ¡quina', 'Iniciante', 'ResistÃªncia', 'Isolado', 'Bilateral', 'Sagital'),
  ('Panturrilha no leg press', 'panturrilha-no-leg-press', array[]::text[], 'Panturrilhas', 'Panturrilhas', array[]::text[], 'Empurrar', 'FlexÃ£o plantar', 'Membros inferiores', 'Leg press', 'Iniciante', 'ResistÃªncia', 'Isolado', 'Bilateral', 'Sagital'),
  ('Panturrilha no smith', 'panturrilha-no-smith', array[]::text[], 'Panturrilhas', 'Panturrilhas', array[]::text[], 'Empurrar', 'FlexÃ£o plantar', 'Membros inferiores', 'Smith', 'Iniciante', 'ResistÃªncia', 'Isolado', 'Bilateral', 'Sagital'),
  ('Abdominal reto', 'abdominal-reto', array['Crunch']::text[], 'AbdÃ´men', 'Reto abdominal', array['Core']::text[], 'Estabilizar', 'FlexÃ£o de tronco', 'Tronco', 'Peso corporal', 'Iniciante', 'AtivaÃ§Ã£o', 'Isolado', 'Bilateral', 'Sagital'),
  ('Abdominal infra', 'abdominal-infra', array[]::text[], 'AbdÃ´men', 'Reto abdominal', array['Flexores do quadril']::text[], 'Estabilizar', 'FlexÃ£o de tronco', 'Tronco', 'Peso corporal', 'Iniciante', 'AtivaÃ§Ã£o', 'Isolado', 'Bilateral', 'Sagital'),
  ('Abdominal oblÃ­quo', 'abdominal-obliquo', array[]::text[], 'AbdÃ´men', 'OblÃ­quos', array['Reto abdominal']::text[], 'Rotacionar', 'RotaÃ§Ã£o de tronco', 'Tronco', 'Peso corporal', 'Iniciante', 'AtivaÃ§Ã£o', 'Isolado', 'Bilateral', 'Transversal'),
  ('Abdominal na polia', 'abdominal-na-polia', array[]::text[], 'AbdÃ´men', 'Reto abdominal', array['OblÃ­quos']::text[], 'Estabilizar', 'FlexÃ£o de tronco', 'Tronco', 'Cabo', 'Iniciante', 'Hipertrofia', 'Isolado', 'Bilateral', 'Sagital'),
  ('Prancha', 'prancha', array['Prancha frontal']::text[], 'AbdÃ´men', 'Core', array['Reto abdominal', 'OblÃ­quos']::text[], 'IsomÃ©trico', 'Anti-extensÃ£o', 'Tronco', 'Peso corporal', 'Iniciante', 'AtivaÃ§Ã£o', 'Composto', 'Bilateral', 'Sagital'),
  ('ElevaÃ§Ã£o de pernas', 'elevacao-de-pernas', array[]::text[], 'AbdÃ´men', 'Reto abdominal', array['Flexores do quadril']::text[], 'Estabilizar', 'FlexÃ£o de tronco', 'Tronco', 'Barra fixa', 'IntermediÃ¡rio', 'AtivaÃ§Ã£o', 'Composto', 'Bilateral', 'Sagital'),
  ('Ab wheel', 'ab-wheel', array['Roda abdominal']::text[], 'AbdÃ´men', 'Core', array['Reto abdominal', 'Deltoide anterior']::text[], 'Estabilizar', 'Anti-extensÃ£o', 'Tronco', 'Roda abdominal', 'IntermediÃ¡rio', 'ForÃ§a', 'Composto', 'Bilateral', 'Sagital'),
  ('Russian twist', 'russian-twist', array[]::text[], 'AbdÃ´men', 'OblÃ­quos', array['Reto abdominal', 'Flexores do quadril']::text[], 'Rotacionar', 'RotaÃ§Ã£o de tronco', 'Tronco', 'Peso corporal', 'IntermediÃ¡rio', 'AtivaÃ§Ã£o', 'Isolado', 'Bilateral', 'Transversal'),
  ('FlexÃ£o de punho', 'flexao-de-punho', array[]::text[], 'AntebraÃ§o', 'AntebraÃ§os', array[]::text[], 'Puxar', 'FlexÃ£o de cotovelo', 'Membros superiores', 'Barra', 'Iniciante', 'Hipertrofia', 'Isolado', 'Bilateral', 'Sagital'),
  ('ExtensÃ£o de punho', 'extensao-de-punho', array[]::text[], 'AntebraÃ§o', 'AntebraÃ§os', array[]::text[], 'Empurrar', 'ExtensÃ£o de cotovelo', 'Membros superiores', 'Barra', 'Iniciante', 'Hipertrofia', 'Isolado', 'Bilateral', 'Sagital'),
  ('Caminhada do fazendeiro', 'caminhada-do-fazendeiro', array['Farmer''s walk', 'Farmer walk com halteres']::text[], 'AntebraÃ§o', 'AntebraÃ§os', array['TrapÃ©zio', 'Core']::text[], 'Locomover', 'Carregada', 'Corpo inteiro', 'Halteres', 'IntermediÃ¡rio', 'Condicionamento', 'Composto', 'Bilateral', 'Multiplanar'),
  ('Power clean', 'power-clean', array[]::text[], 'Corpo inteiro', 'Corpo inteiro', array['Posterior de coxa', 'QuadrÃ­ceps', 'TrapÃ©zio']::text[], 'Levantar', 'PotÃªncia', 'Corpo inteiro', 'Barra', 'AvanÃ§ado', 'TÃ©cnica', 'Composto', 'Bilateral', 'Sagital'),
  ('Swing com kettlebell', 'swing-com-kettlebell', array['Kettlebell swing']::text[], 'Corpo inteiro', 'Posterior de coxa', array['GlÃºteo mÃ¡ximo', 'Core']::text[], 'Levantar', 'Hinge', 'Corpo inteiro', 'Kettlebell', 'IntermediÃ¡rio', 'Condicionamento', 'Composto', 'Bilateral', 'Sagital'),
  ('Burpee', 'burpee', array[]::text[], 'Corpo inteiro', 'Corpo inteiro', array['Peitoral maior', 'QuadrÃ­ceps', 'Core']::text[], 'Locomover', 'LocomoÃ§Ã£o', 'Corpo inteiro', 'Peso corporal', 'IntermediÃ¡rio', 'Condicionamento', 'Composto', 'Bilateral', 'Multiplanar'),
  ('Thruster', 'thruster', array[]::text[], 'Corpo inteiro', 'QuadrÃ­ceps', array['Deltoide anterior', 'GlÃºteo mÃ¡ximo', 'TrÃ­ceps braquial']::text[], 'Empurrar', 'Empurrar vertical', 'Corpo inteiro', 'Barra', 'AvanÃ§ado', 'Condicionamento', 'Composto', 'Bilateral', 'Sagital')
)
insert into public.exercises (
  name,
  slug,
  aliases,
  category,
  muscle_category,
  muscle_group_primary,
  muscle_groups_secondary,
  movement_type,
  movement_category,
  body_region,
  equipment,
  difficulty_level,
  exercise_type,
  mechanical_type,
  laterality,
  movement_plane,
  is_active,
  is_global
)
select
  name,
  slug,
  aliases,
  U&'Muscula\\00E7\\00E3o',
  muscle_category,
  muscle_group_primary,
  muscle_groups_secondary,
  movement_type,
  movement_category,
  body_region,
  equipment,
  difficulty_level,
  exercise_type,
  mechanical_type,
  laterality,
  movement_plane,
  true,
  true
from seed
on conflict (slug) do update set
  name = excluded.name,
  aliases = excluded.aliases,
  category = excluded.category,
  muscle_category = excluded.muscle_category,
  muscle_group_primary = excluded.muscle_group_primary,
  muscle_groups_secondary = excluded.muscle_groups_secondary,
  movement_type = excluded.movement_type,
  movement_category = excluded.movement_category,
  body_region = excluded.body_region,
  equipment = excluded.equipment,
  difficulty_level = excluded.difficulty_level,
  exercise_type = excluded.exercise_type,
  mechanical_type = excluded.mechanical_type,
  laterality = excluded.laterality,
  movement_plane = excluded.movement_plane,
  is_active = true,
  is_global = true,
  updated_at = now();


create extension if not exists pg_trgm;

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  category text not null check (category in ('Musculação', 'Mobilidade', 'Alongamento', 'Cardio')),
  muscle_category text,
  muscle_group_primary text,
  muscle_groups_secondary text[] not null default '{}',
  movement_type text,
  body_region text,
  equipment text,
  difficulty_level text,
  exercise_type text,
  description text not null default '',
  execution_instructions text not null default '',
  breathing_tips text not null default '',
  posture_tips text not null default '',
  contraindications text not null default '',
  common_mistakes text not null default '',
  video_url text,
  video_storage_path text,
  thumbnail_url text,
  thumbnail_storage_path text,
  duration_limit_seconds integer,
  is_active boolean not null default true,
  is_global boolean not null default true,
  created_by uuid references public.teachers (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exercises_name_length_chk check (char_length(trim(name)) >= 3),
  constraint exercises_slug_length_chk check (char_length(trim(slug)) >= 3),
  constraint exercises_duration_limit_chk check (duration_limit_seconds is null or duration_limit_seconds between 1 and 6)
);

create unique index if not exists exercises_slug_uidx on public.exercises (slug);
create index if not exists exercises_active_category_idx on public.exercises (is_active, category);
create index if not exists exercises_primary_group_idx on public.exercises (muscle_group_primary);
create index if not exists exercises_equipment_idx on public.exercises (equipment);
create index if not exists exercises_difficulty_idx on public.exercises (difficulty_level);
create index if not exists exercises_movement_idx on public.exercises (movement_type);
create index if not exists exercises_name_trgm_idx on public.exercises using gin (name gin_trgm_ops);

create trigger set_exercises_updated_at
before update on public.exercises
for each row execute procedure public.set_updated_at();

alter table public.exercises enable row level security;

drop policy if exists "exercises_select_authenticated" on public.exercises;
create policy "exercises_select_authenticated"
on public.exercises
for select
to authenticated
using (
  is_active = true
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'professor'
  )
);

drop policy if exists "exercises_insert_professors" on public.exercises;
create policy "exercises_insert_professors"
on public.exercises
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'professor'
  )
);

drop policy if exists "exercises_update_professors" on public.exercises;
create policy "exercises_update_professors"
on public.exercises
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'professor'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'professor'
  )
);

drop policy if exists "exercises_delete_professors" on public.exercises;
create policy "exercises_delete_professors"
on public.exercises
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'professor'
  )
);

insert into storage.buckets (id, name, public)
values ('exercise-media', 'exercise-media', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "exercise_media_write_professors" on storage.objects;
create policy "exercise_media_write_professors"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'exercise-media'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'professor'
  )
)
with check (
  bucket_id = 'exercise-media'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'professor'
  )
);

insert into public.exercises (
  id, name, slug, category, muscle_category, muscle_group_primary, muscle_groups_secondary,
  movement_type, body_region, equipment, difficulty_level, exercise_type,
  description, execution_instructions, breathing_tips, posture_tips, contraindications, common_mistakes,
  duration_limit_seconds, is_active, is_global
)
values
  ('00000000-0000-0000-0000-000000000001', 'Agachamento livre', 'agachamento-livre', 'Musculação', 'Quadríceps', 'Quadríceps', array['Glúteo máximo','Core'], 'Agachar', 'Membros inferiores', 'Barra', 'Intermediário', 'Força', 'Exercício base para pernas e controle global.', 'Desça com o quadril para trás e suba empurrando o chão.', 'Inspire na descida e expire na subida.', 'Mantenha o tronco firme e joelhos alinhados.', 'Evite em crises agudas sem adaptação.', 'Arredondar a coluna e perder o apoio dos pés.', 6, true, true),
  ('00000000-0000-0000-0000-000000000002', 'Leg press 45°', 'leg-press-45', 'Musculação', 'Quadríceps', 'Quadríceps', array['Glúteo máximo','Posterior de coxa'], 'Empurrar', 'Membros inferiores', 'Máquina', 'Iniciante', 'Hipertrofia', 'Movimento guiado para membros inferiores.', 'Desça até uma amplitude segura e empurre sem travar os joelhos.', 'Inspire na descida e expire ao empurrar.', 'Mantenha a lombar apoiada no encosto.', 'Ajuste a amplitude em joelhos sensíveis.', 'Tirar o quadril do banco e travar os joelhos.', 6, true, true),
  ('00000000-0000-0000-0000-000000000003', 'Levantamento terra romeno', 'levantamento-terra-romeno', 'Musculação', 'Posterior de coxa', 'Posterior de coxa', array['Glúteo máximo','Eretores da espinha'], 'Levantar', 'Membros inferiores', 'Barra', 'Intermediário', 'Força', 'Padrão dominante de quadril para cadeia posterior.', 'Projete o quadril para trás e retorne mantendo a barra próxima do corpo.', 'Inspire antes da descida e expire ao subir.', 'Preserve a coluna neutra durante o movimento.', 'Adapte em dor lombar aguda.', 'Arredondar as costas e flexionar demais os joelhos.', 6, true, true),
  ('00000000-0000-0000-0000-000000000004', 'Supino reto com barra', 'supino-reto-com-barra', 'Musculação', 'Peito', 'Peitoral maior', array['Deltoide anterior','Tríceps braquial'], 'Empurrar', 'Membros superiores', 'Barra', 'Intermediário', 'Força', 'Exercício clássico para peitoral.', 'Desça a barra até o peito com controle e empurre mantendo os punhos alinhados.', 'Inspire na descida e expire na subida.', 'Escápulas apoiadas e pés firmes no chão.', 'Reduza a amplitude em ombros sensíveis.', 'Quicar a barra no peito e perder estabilidade.', 6, true, true),
  ('00000000-0000-0000-0000-000000000005', 'Supino inclinado com halteres', 'supino-inclinado-com-halteres', 'Musculação', 'Peito', 'Peitoral maior', array['Deltoide anterior','Tríceps braquial'], 'Empurrar', 'Membros superiores', 'Halteres', 'Intermediário', 'Hipertrofia', 'Variação inclinada com foco na porção superior do peitoral.', 'Desça os halteres com controle e suba sem bater no topo.', 'Inspire na descida e expire na subida.', 'Mantenha escápulas firmes no banco.', 'Ajuste a inclinação em desconforto no ombro.', 'Abrir demais os cotovelos e perder o punho.', 6, true, true),
  ('00000000-0000-0000-0000-000000000006', 'Remada curvada com barra', 'remada-curvada-com-barra', 'Musculação', 'Costas', 'Latíssimo do dorso', array['Romboides','Trapézio','Bíceps braquial'], 'Puxar', 'Membros superiores', 'Barra', 'Intermediário', 'Força', 'Remada livre para dorsais e estabilidade do tronco.', 'Puxe a barra em direção ao abdômen mantendo o tronco inclinado e estável.', 'Expire na puxada e inspire na volta.', 'Segure o abdômen ativo e ombros longe das orelhas.', 'Adapte em baixa tolerância à inclinação do tronco.', 'Usar impulso do quadril e puxar só com os braços.', 6, true, true),
  ('00000000-0000-0000-0000-000000000007', 'Puxada frontal na polia', 'puxada-frontal-na-polia', 'Musculação', 'Costas', 'Latíssimo do dorso', array['Bíceps braquial','Romboides'], 'Puxar', 'Membros superiores', 'Cabo', 'Iniciante', 'Hipertrofia', 'Puxada guiada para desenvolvimento de dorsais.', 'Puxe a barra até a parte superior do peito sem balançar o tronco.', 'Expire ao puxar e inspire na volta.', 'Mantenha o peito aberto e o tronco firme.', 'Ajuste a amplitude em casos de dor no ombro.', 'Puxar atrás da nuca e exagerar no balanço.', 6, true, true),
  ('00000000-0000-0000-0000-000000000008', 'Desenvolvimento com halteres', 'desenvolvimento-com-halteres', 'Musculação', 'Ombros', 'Deltoide anterior', array['Deltoide lateral','Tríceps braquial'], 'Empurrar', 'Membros superiores', 'Halteres', 'Intermediário', 'Hipertrofia', 'Press vertical para ombros.', 'Empurre os halteres acima da cabeça mantendo o tronco estável.', 'Expire ao subir e inspire ao descer.', 'Evite compensar com hiperextensão lombar.', 'Ajuste a amplitude em limitação articular do ombro.', 'Arquear a lombar e perder o alinhamento dos punhos.', 6, true, true),
  ('00000000-0000-0000-0000-000000000009', 'Elevação lateral', 'elevacao-lateral', 'Musculação', 'Ombros', 'Deltoide lateral', array['Trapézio'], 'Empurrar', 'Membros superiores', 'Halteres', 'Iniciante', 'Hipertrofia', 'Isolamento para deltoide lateral.', 'Eleve os braços lateralmente até a linha dos ombros com leve flexão de cotovelos.', 'Expire ao elevar e inspire ao descer.', 'Mantenha o pescoço relaxado e o tronco sem balanço.', 'Adapte em impacto subacromial.', 'Usar impulso do tronco e subir os ombros.', 6, true, true),
  ('00000000-0000-0000-0000-000000000010', 'Rosca direta com barra', 'rosca-direta-com-barra', 'Musculação', 'Bíceps', 'Bíceps braquial', array['Braquial','Antebraços'], 'Puxar', 'Membros superiores', 'Barra', 'Iniciante', 'Hipertrofia', 'Flexão de cotovelos para bíceps.', 'Suba a barra sem mover os ombros e retorne controlando a descida.', 'Expire na subida e inspire na descida.', 'Cotovelos próximos ao corpo e tronco estável.', 'Ajuste a pegada em desconforto no punho.', 'Roubar com balanço e elevar os cotovelos.', 6, true, true),
  ('00000000-0000-0000-0000-000000000011', 'Tríceps na polia com corda', 'triceps-na-polia-com-corda', 'Musculação', 'Tríceps', 'Tríceps braquial', array['Deltoide posterior'], 'Empurrar', 'Membros superiores', 'Cabo', 'Iniciante', 'Hipertrofia', 'Extensão de cotovelos guiada para tríceps.', 'Empurre a corda para baixo e abra levemente no final.', 'Expire ao estender e inspire ao voltar.', 'Cotovelos fixos ao lado do tronco.', 'Evite cargas altas em irritações recentes no cotovelo.', 'Mover o ombro junto e encurtar a amplitude.', 6, true, true),
  ('00000000-0000-0000-0000-000000000012', 'Hip thrust com barra', 'hip-thrust-com-barra', 'Musculação', 'Glúteos', 'Glúteo máximo', array['Posterior de coxa','Core'], 'Levantar', 'Membros inferiores', 'Barra', 'Intermediário', 'Hipertrofia', 'Exercício dominante de quadril para glúteos.', 'Eleve o quadril até alinhar joelhos, quadril e ombros e desça com controle.', 'Expire no topo e inspire na descida.', 'Queixo levemente recolhido e costelas encaixadas.', 'Ajuste o apoio em desconforto lombar.', 'Hiperestender a lombar e posicionar mal os pés.', 6, true, true),
  ('00000000-0000-0000-0000-000000000013', 'Panturrilha em pé na máquina', 'panturrilha-em-pe-na-maquina', 'Musculação', 'Panturrilhas', 'Panturrilhas', array[]::text[], 'Empurrar', 'Membros inferiores', 'Máquina', 'Iniciante', 'Resistência', 'Movimento guiado para flexão plantar.', 'Suba na ponta dos pés, segure um instante e desça por completo.', 'Expire ao subir e inspire ao descer.', 'Controle a amplitude e evite balanço do tronco.', 'Adapte em sensibilidade no tendão calcâneo.', 'Fazer repetições curtas e rápidas demais.', 6, true, true),
  ('00000000-0000-0000-0000-000000000014', 'Prancha frontal', 'prancha-frontal', 'Musculação', 'Abdômen', 'Core', array['Reto abdominal','Oblíquos'], 'Isométrico', 'Tronco', 'Peso corporal', 'Iniciante', 'Ativação', 'Exercício isométrico para estabilidade do tronco.', 'Apoie antebraços e pontas dos pés mantendo o corpo alinhado.', 'Respire continuamente sem prender o ar.', 'Ative glúteos e abdômen para evitar queda do quadril.', 'Adapte em dor no ombro ou punhos.', 'Subir demais o quadril ou deixar a lombar cair.', 6, true, true),
  ('00000000-0000-0000-0000-000000000015', 'Abdominal dead bug', 'abdominal-dead-bug', 'Musculação', 'Abdômen', 'Core', array['Reto abdominal','Flexores do quadril'], 'Estabilizar', 'Tronco', 'Peso corporal', 'Iniciante', 'Ativação', 'Padrão anti-extensão para estabilidade central.', 'Afaste braço e perna opostos sem perder a lombar apoiada.', 'Expire ao afastar e inspire ao retornar.', 'Mantenha costelas encaixadas e lombar estável.', 'Reduza a amplitude em desconforto lombar.', 'Arquear a lombar ao mover os membros.', 6, true, true),
  ('00000000-0000-0000-0000-000000000016', 'Farmer walk com halteres', 'farmer-walk-com-halteres', 'Musculação', 'Corpo inteiro', 'Corpo inteiro', array['Trapézio','Core','Antebraços'], 'Locomover', 'Corpo inteiro', 'Halteres', 'Intermediário', 'Condicionamento', 'Caminhada carregada para pegada e estabilidade global.', 'Caminhe com passadas curtas e postura alta segurando os halteres ao lado do corpo.', 'Respire de forma contínua durante o deslocamento.', 'Ombros para baixo, abdômen ativo e olhar à frente.', 'Ajuste a carga em dor lombar ou baixa tolerância.', 'Inclinar o tronco e perder o controle das passadas.', 6, true, true),
  ('00000000-0000-0000-0000-000000000017', 'Mobilidade torácica em quatro apoios', 'mobilidade-toracica-em-quatro-apoios', 'Mobilidade', 'Mobilidade', 'Mobilidade', array['Trapézio','Romboides'], 'Mobilidade', 'Tronco', 'Peso corporal', 'Iniciante', 'Mobilidade', 'Melhora rotação torácica e consciência de tronco.', 'Em quatro apoios, gire o tronco abrindo o cotovelo para cima.', 'Expire na rotação e inspire na volta.', 'Mantenha o quadril estável e a mão de apoio ativa.', 'Reduza a amplitude em dor aguda na coluna.', 'Compensar com rotação excessiva do quadril.', 6, true, true),
  ('00000000-0000-0000-0000-000000000018', 'Mobilidade de tornozelo na parede', 'mobilidade-de-tornozelo-na-parede', 'Mobilidade', 'Mobilidade', 'Mobilidade', array['Panturrilhas','Tibial anterior'], 'Mobilidade', 'Membros inferiores', 'Sem equipamento', 'Iniciante', 'Mobilidade', 'Ganho de dorsiflexão de tornozelo.', 'Leve o joelho à parede sem tirar o calcanhar do chão.', 'Respire normalmente e mantenha o ritmo controlado.', 'Evite colapsar o arco do pé.', 'Respeite desconfortos articulares locais.', 'Tirar o calcanhar do chão para ganhar amplitude.', 6, true, true),
  ('00000000-0000-0000-0000-000000000019', '90/90 de quadril', '90-90-de-quadril', 'Mobilidade', 'Mobilidade', 'Mobilidade', array['Glúteo médio','Adutores'], 'Mobilidade', 'Membros inferiores', 'Peso corporal', 'Intermediário', 'Mobilidade', 'Mobilidade de quadril com rotações interna e externa.', 'Sente-se em 90/90 e alterne o tronco sobre a perna da frente com controle.', 'Expire ao aproximar o tronco e inspire ao retornar.', 'Mantenha a pelve apoiada e o tronco longo.', 'Adapte em dor no joelho.', 'Forçar amplitude sem estabilidade do quadril.', 6, true, true),
  ('00000000-0000-0000-0000-000000000020', 'Rotação externa de ombro com elástico', 'rotacao-externa-de-ombro-com-elastico', 'Mobilidade', 'Mobilidade', 'Manguito rotador', array['Deltoide posterior'], 'Mobilidade', 'Membros superiores', 'Elástico', 'Iniciante', 'Ativação', 'Ativação do manguito rotador para estabilidade do ombro.', 'Com o cotovelo junto ao corpo, puxe o elástico para fora sem rodar o tronco.', 'Expire na rotação e inspire na volta.', 'Mantenha peito aberto e escápulas estáveis.', 'Controle a tensão em ombros sensíveis.', 'Afastar o cotovelo do corpo e girar o tronco.', 6, true, true),
  ('00000000-0000-0000-0000-000000000021', 'Cat-camel', 'cat-camel', 'Mobilidade', 'Mobilidade', 'Mobilidade', array['Eretores da espinha','Core'], 'Mobilidade', 'Tronco', 'Peso corporal', 'Iniciante', 'Mobilidade', 'Movimento fluido para mobilidade segmentar da coluna.', 'Alterne flexão e extensão da coluna em quatro apoios, de forma lenta.', 'Expire na flexão e inspire na extensão.', 'Distribua o movimento por toda a coluna.', 'Evite amplitudes extremas em crises dolorosas.', 'Executar rápido demais e sem percepção segmentar.', 6, true, true),
  ('00000000-0000-0000-0000-000000000022', 'Deep squat hold assistido', 'deep-squat-hold-assistido', 'Mobilidade', 'Mobilidade', 'Mobilidade', array['Quadríceps','Glúteo máximo','Panturrilhas'], 'Mobilidade', 'Membros inferiores', 'TRX', 'Intermediário', 'Mobilidade', 'Permanência em agachamento profundo com apoio.', 'Segure no apoio e mantenha o quadril baixo com a coluna o mais neutra possível.', 'Respire continuamente enquanto sustenta a posição.', 'Distribua o peso nos pés e abra o peito.', 'Ajuste a profundidade em desconforto no joelho.', 'Elevar os calcanhares e colapsar o tronco.', 6, true, true),
  ('00000000-0000-0000-0000-000000000023', 'Passagem de bastão sobre a cabeça', 'passagem-de-bastao-sobre-a-cabeca', 'Mobilidade', 'Mobilidade', 'Mobilidade', array['Deltoide anterior','Peitoral menor'], 'Mobilidade', 'Membros superiores', 'Barra', 'Iniciante', 'Mobilidade', 'Mobilidade de ombros com bastão ou barra leve.', 'Leve o bastão da frente para trás por cima da cabeça com cotovelos estendidos.', 'Respire normalmente durante a passagem.', 'Mantenha costelas encaixadas e pescoço relaxado.', 'Reduza a amplitude em ombros sensíveis.', 'Compensar com hiperextensão lombar.', 6, true, true),
  ('00000000-0000-0000-0000-000000000024', 'World''s greatest stretch', 'worlds-greatest-stretch', 'Mobilidade', 'Mobilidade', 'Mobilidade', array['Flexores do quadril','Posterior de coxa'], 'Mobilidade', 'Corpo inteiro', 'Peso corporal', 'Intermediário', 'Mobilidade', 'Sequência dinâmica para quadril, torácica e cadeia posterior.', 'Avance uma perna, apoie a mão no chão e combine extensão, rotação e alongamento.', 'Expire nas rotações e inspire nas transições.', 'Mantenha o quadril alinhado e a perna de trás ativa.', 'Modere a amplitude em desconfortos no quadril ou punhos.', 'Fazer transições rápidas demais.', 6, true, true),
  ('00000000-0000-0000-0000-000000000025', 'Alongamento de peitoral na parede', 'alongamento-de-peitoral-na-parede', 'Alongamento', 'Alongamento', 'Peitoral maior', array['Peitoral menor','Deltoide anterior'], 'Alongamento', 'Membros superiores', 'Sem equipamento', 'Iniciante', 'Alongamento', 'Alongamento estático para peitoral.', 'Apoie o braço na parede e gire o tronco suavemente para o lado oposto.', 'Respire fundo e relaxe a musculatura.', 'Mantenha ombros baixos e pescoço solto.', 'Evite intensidade alta em instabilidade de ombro.', 'Girar rápido demais e tensionar a lombar.', 6, true, true),
  ('00000000-0000-0000-0000-000000000026', 'Alongamento de posterior sentado', 'alongamento-de-posterior-sentado', 'Alongamento', 'Alongamento', 'Posterior de coxa', array['Panturrilhas'], 'Alongamento', 'Membros inferiores', 'Sem equipamento', 'Iniciante', 'Alongamento', 'Alongamento estático para cadeia posterior da perna.', 'Incline o tronco à frente sem arredondar demais as costas.', 'Respire fundo e avance gradualmente a cada expiração.', 'Cresça o tronco antes de inclinar.', 'Evite forçar em irritação ciática.', 'Arredondar demais a lombar para alcançar o pé.', 6, true, true),
  ('00000000-0000-0000-0000-000000000027', 'Alongamento de flexores do quadril ajoelhado', 'alongamento-de-flexores-do-quadril-ajoelhado', 'Alongamento', 'Alongamento', 'Flexores do quadril', array['Quadríceps'], 'Alongamento', 'Membros inferiores', 'Sem equipamento', 'Iniciante', 'Alongamento', 'Alongamento para região anterior do quadril.', 'Em meio-ajoelhado, projete o quadril à frente mantendo a pelve encaixada.', 'Expire lentamente para aprofundar o alongamento.', 'Contraia levemente o glúteo da perna de trás.', 'Proteja o joelho com apoio quando necessário.', 'Inclinar o tronco e exagerar na lombar.', 6, true, true),
  ('00000000-0000-0000-0000-000000000028', 'Alongamento de glúteos deitado', 'alongamento-de-gluteos-deitado', 'Alongamento', 'Alongamento', 'Glúteo máximo', array['Glúteo médio'], 'Alongamento', 'Membros inferiores', 'Sem equipamento', 'Iniciante', 'Alongamento', 'Alongamento de glúteos e região posterior do quadril.', 'Cruze uma perna sobre a outra e aproxime a coxa do peito com as mãos.', 'Respire fundo e relaxe o quadril a cada expiração.', 'Mantenha a cabeça apoiada e os ombros soltos.', 'Ajuste se houver desconforto no joelho cruzado.', 'Puxar demais sem manter alinhamento do quadril.', 6, true, true),
  ('00000000-0000-0000-0000-000000000029', 'Alongamento de panturrilha na parede', 'alongamento-de-panturrilha-na-parede', 'Alongamento', 'Alongamento', 'Panturrilhas', array[]::text[], 'Alongamento', 'Membros inferiores', 'Sem equipamento', 'Iniciante', 'Alongamento', 'Alongamento estático para panturrilhas.', 'Apoie as mãos na parede, mantenha o calcanhar no chão e incline o corpo à frente.', 'Respire de forma cadenciada.', 'Mantenha o pé apontado para frente.', 'Modere a intensidade em tendão de Aquiles sensível.', 'Rodar o pé para fora e tirar o calcanhar do chão.', 6, true, true),
  ('00000000-0000-0000-0000-000000000030', 'Alongamento de tríceps acima da cabeça', 'alongamento-de-triceps-acima-da-cabeca', 'Alongamento', 'Alongamento', 'Tríceps braquial', array['Latíssimo do dorso'], 'Alongamento', 'Membros superiores', 'Sem equipamento', 'Iniciante', 'Alongamento', 'Alongamento para tríceps e cadeia superior posterior.', 'Eleve um braço, dobre o cotovelo e auxilie suavemente com a outra mão.', 'Respire devagar, sem elevar os ombros.', 'Mantenha o tronco ereto e estável.', 'Reduza a amplitude em limitação do ombro.', 'Projetar a cabeça à frente e arquear a lombar.', 6, true, true),
  ('00000000-0000-0000-0000-000000000031', 'Alongamento lateral de tronco', 'alongamento-lateral-de-tronco', 'Alongamento', 'Alongamento', 'Oblíquos', array['Latíssimo do dorso'], 'Alongamento', 'Tronco', 'Sem equipamento', 'Iniciante', 'Alongamento', 'Alongamento da lateral do tronco.', 'Eleve um braço acima da cabeça e incline o tronco para o lado oposto.', 'Expire ao inclinar e inspire ao retornar.', 'Evite rodar o tronco e mantenha os quadris estáveis.', 'Adapte em dor aguda na coluna.', 'Compensar com flexão para frente.', 6, true, true),
  ('00000000-0000-0000-0000-000000000032', 'Alongamento de adutores em borboleta', 'alongamento-de-adutores-em-borboleta', 'Alongamento', 'Alongamento', 'Adutores', array[]::text[], 'Alongamento', 'Membros inferiores', 'Sem equipamento', 'Iniciante', 'Alongamento', 'Alongamento de adutores com sola dos pés unidas.', 'Sente-se, una as plantas dos pés e aproxime os joelhos do chão sem forçar.', 'Respire profundamente e relaxe a musculatura.', 'Mantenha a coluna alta antes de aproximar o tronco.', 'Ajuste a posição em irritações do quadril.', 'Empurrar os joelhos agressivamente com as mãos.', 6, true, true),
  ('00000000-0000-0000-0000-000000000033', 'Corrida na esteira', 'corrida-na-esteira', 'Cardio', 'Cardiorrespiratório', 'Cardiorrespiratório', array['Quadríceps','Panturrilhas','Glúteo máximo'], 'Cardio', 'Corpo inteiro', 'Esteira', 'Intermediário', 'Condicionamento', 'Exercício cardiovascular contínuo em esteira.', 'Ajuste ritmo e inclinação conforme o objetivo da sessão.', 'Busque uma cadência respiratória estável.', 'Mantenha tronco alto e passadas naturais.', 'Controle o impacto em alunos com baixa tolerância.', 'Segurar nas barras e exagerar na passada.', 6, true, true),
  ('00000000-0000-0000-0000-000000000034', 'Bicicleta ergométrica', 'bicicleta-ergometrica', 'Cardio', 'Cardiorrespiratório', 'Cardiorrespiratório', array['Quadríceps','Glúteo máximo','Panturrilhas'], 'Cardio', 'Membros inferiores', 'Bicicleta', 'Iniciante', 'Condicionamento', 'Cardio de baixo impacto com ajuste fino de intensidade.', 'Pedale com cadência constante e resistência compatível com a meta da aula.', 'Mantenha a respiração ritmada durante o esforço.', 'Ajuste banco e guidão para evitar sobrecarga.', 'Observe desconfortos patelofemorais.', 'Pedalar com joelhos colapsando para dentro.', 6, true, true),
  ('00000000-0000-0000-0000-000000000035', 'Pular corda', 'pular-corda', 'Cardio', 'Cardiorrespiratório', 'Cardiorrespiratório', array['Panturrilhas','Core'], 'Cardio', 'Corpo inteiro', 'Corda', 'Intermediário', 'Condicionamento', 'Cardio coordenativo com alto gasto energético.', 'Realize saltos curtos e ritmados usando os punhos para girar a corda.', 'Estabilize a respiração conforme a cadência.', 'Pouse com suavidade e mantenha cotovelos próximos ao corpo.', 'Modere o impacto em alunos com baixa tolerância articular.', 'Saltar alto demais e usar os ombros para girar a corda.', 6, true, true),
  ('00000000-0000-0000-0000-000000000036', 'Remo ergométrico', 'remo-ergometrico', 'Cardio', 'Cardiorrespiratório', 'Cardiorrespiratório', array['Latíssimo do dorso','Quadríceps','Core'], 'Cardio', 'Corpo inteiro', 'Máquina', 'Intermediário', 'Condicionamento', 'Cardio global com coordenação entre pernas, tronco e braços.', 'Empurre com as pernas, incline o tronco e finalize com os braços em sequência fluida.', 'Expire na puxada e inspire na volta.', 'Mantenha a coluna longa durante a recuperação.', 'Controle a amplitude em lombalgia sensível.', 'Puxar só com os braços e perder a sequência.', 6, true, true),
  ('00000000-0000-0000-0000-000000000037', 'Escada ergométrica', 'escada-ergometrica', 'Cardio', 'Cardiorrespiratório', 'Cardiorrespiratório', array['Glúteo máximo','Quadríceps','Panturrilhas'], 'Cardio', 'Membros inferiores', 'Escada', 'Intermediário', 'Condicionamento', 'Cardio vertical com grande demanda de membros inferiores.', 'Suba degraus mantendo ritmo controlado e apoio estável dos pés.', 'Respire em cadência constante.', 'Evite se apoiar excessivamente nos corrimãos.', 'Ajuste a intensidade em dor anterior no joelho.', 'Curvar o tronco e descarregar o peso nos braços.', 6, true, true),
  ('00000000-0000-0000-0000-000000000038', 'Polichinelo', 'polichinelo', 'Cardio', 'Cardiorrespiratório', 'Cardiorrespiratório', array['Deltoide lateral','Panturrilhas','Quadríceps'], 'Cardio', 'Corpo inteiro', 'Peso corporal', 'Iniciante', 'Condicionamento', 'Exercício cardiovascular simples para aquecimento ou blocos metabólicos.', 'Alterne abertura de pernas e braços acima da cabeça em ritmo contínuo.', 'Estabeleça respiração ritmada conforme a cadência.', 'Aterrisse de forma suave com joelhos alinhados.', 'Ajuste o impacto para iniciantes.', 'Aterrissar pesado e perder coordenação.', 6, true, true),
  ('00000000-0000-0000-0000-000000000039', 'Mountain climber', 'mountain-climber', 'Cardio', 'Cardiorrespiratório', 'Cardiorrespiratório', array['Core','Flexores do quadril','Deltoide anterior'], 'Cardio', 'Corpo inteiro', 'Peso corporal', 'Intermediário', 'Condicionamento', 'Cardio em apoio de braços com demanda de estabilidade.', 'Em prancha alta, alterne a aproximação dos joelhos ao peito em ritmo controlado.', 'Respire de forma cadenciada sem prender o ar.', 'Mantenha ombros sobre as mãos e quadril estável.', 'Modere a velocidade em sensibilidade de punhos.', 'Subir demais o quadril e perder a linha corporal.', 6, true, true),
  ('00000000-0000-0000-0000-000000000040', 'Bike air', 'bike-air', 'Cardio', 'Cardiorrespiratório', 'Cardiorrespiratório', array['Quadríceps','Glúteo máximo','Corpo inteiro'], 'Cardio', 'Corpo inteiro', 'Bicicleta', 'Avançado', 'Condicionamento', 'Cardio intervalado de alta intensidade em bicicleta com braços.', 'Empurre e puxe os manetes mantendo cadência forte durante o intervalo planejado.', 'Use respiração rápida e ritmada para sustentar o esforço.', 'Mantenha o tronco firme e ajuste o assento antes de iniciar.', 'Exige progressão para iniciantes e descondicionados.', 'Começar forte demais e perder consistência no intervalo.', 6, true, true)
on conflict (id) do nothing;

-- Preenche exercises.thumbnail_url com imagem de demonstracao.
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
  ('ab-wheel', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Ab_Roller/0.jpg'), -- Ab Roller
  ('abdominal-dead-bug', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Dead_Bug/0.jpg'), -- Dead Bug
  ('abdominal-na-polia', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Cable_Crunch/0.jpg'), -- Cable Crunch
  ('abdominal-obliquo', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Cross-Body_Crunch/0.jpg'), -- Cross-Body Crunch
  ('abdominal-reto', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Crunches/0.jpg'), -- Crunches
  ('abducao-de-quadril', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Thigh_Abductor/0.jpg'), -- Thigh Abductor
  ('abdutora', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Thigh_Abductor/0.jpg'), -- Thigh Abductor
  ('adutora', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Thigh_Adductor/0.jpg'), -- Thigh Adductor
  ('afundo', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Barbell_Lunge/0.jpg'), -- Barbell Lunge
  ('agachamento-frontal', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Front_Barbell_Squat/0.jpg'), -- Front Barbell Squat
  ('agachamento-livre', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Barbell_Squat/0.jpg'), -- Barbell Squat
  ('alongamento-de-panturrilha-na-parede', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Calf_Stretch_Hands_Against_Wall/0.jpg'), -- Calf Stretch Hands Against Wall
  ('alongamento-de-peitoral-na-parede', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Chest_And_Front_Of_Shoulder_Stretch/0.jpg'), -- Chest And Front Of Shoulder Stretch
  ('alongamento-de-quadriceps-deitado', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/All_Fours_Quad_Stretch/0.jpg'), -- All Fours Quad Stretch
  ('alongamento-de-soleo', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Seated_Calf_Stretch/0.jpg'), -- Seated Calf Stretch
  ('alongamento-do-piriforme', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Piriformis-SMR/0.jpg'), -- Piriformis-SMR
  ('alongamento-peitoral-na-parede', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Chest_And_Front_Of_Shoulder_Stretch/0.jpg'), -- Chest And Front Of Shoulder Stretch
  ('arnold-press', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Arnold_Dumbbell_Press/0.jpg'), -- Arnold Dumbbell Press
  ('barra-fixa', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Pullups/0.jpg'), -- Pullups
  ('bicicleta-ergometrica', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Bicycling_Stationary/0.jpg'), -- Bicycling, Stationary
  ('cadeira-extensora', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Leg_Extensions/0.jpg'), -- Leg Extensions
  ('cadeira-flexora', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Seated_Leg_Curl/0.jpg'), -- Seated Leg Curl
  ('cat-camel', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Cat_Stretch/0.jpg'), -- Cat Stretch
  ('cat-cow', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Cat_Stretch/0.jpg'), -- Cat Stretch
  ('coice-no-cabo', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/One-Legged_Cable_Kickback/0.jpg'), -- One-Legged Cable Kickback
  ('corrida-na-esteira', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Running_Treadmill/0.jpg'), -- Running, Treadmill
  ('crossover', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Cable_Crossover/0.jpg'), -- Cable Crossover
  ('crucifixo-inclinado', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Incline_Dumbbell_Flyes/0.jpg'), -- Incline Dumbbell Flyes
  ('crucifixo-invertido', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Reverse_Machine_Flyes/0.jpg'), -- Reverse Machine Flyes
  ('crucifixo-reto', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Dumbbell_Flyes/0.jpg'), -- Dumbbell Flyes
  ('crunch', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Crunches/0.jpg'), -- Crunches
  ('dead-bug', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Dead_Bug/0.jpg'), -- Dead Bug
  ('desenvolvimento-com-halteres', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Dumbbell_Shoulder_Press/0.jpg'), -- Dumbbell Shoulder Press
  ('desenvolvimento-militar', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Barbell_Shoulder_Press/0.jpg'), -- Barbell Shoulder Press
  ('elevacao-de-ombros', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Barbell_Shrug/0.jpg'), -- Barbell Shrug
  ('elevacao-de-pernas', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Flat_Bench_Lying_Leg_Raise/0.jpg'), -- Flat Bench Lying Leg Raise
  ('elevacao-frontal', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Front_Dumbbell_Raise/0.jpg'), -- Front Dumbbell Raise
  ('elevacao-lateral', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Side_Lateral_Raise/0.jpg'), -- Side Lateral Raise
  ('elevacao-pelvica', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Butt_Lift_Bridge/0.jpg'), -- Butt Lift (Bridge)
  ('encolhimento', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Barbell_Shrug/0.jpg'), -- Barbell Shrug
  ('face-pull', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Face_Pull/0.jpg'), -- Face Pull
  ('farmer-walk-com-halteres', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Farmers_Walk/0.jpg'), -- Farmer's Walk
  ('farmers-walk', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Farmers_Walk/0.jpg'), -- Farmer's Walk
  ('glute-bridge', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Butt_Lift_Bridge/0.jpg'), -- Butt Lift (Bridge)
  ('good-morning', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Good_Morning/0.jpg'), -- Good Morning
  ('good-morning-com-amplitude-leve', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Good_Morning/0.jpg'), -- Good Morning
  ('hack-squat', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Hack_Squat/0.jpg'), -- Hack Squat
  ('hip-thrust-com-barra', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Barbell_Hip_Thrust/0.jpg'), -- Barbell Hip Thrust
  ('inchworm', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Inchworm/0.jpg'), -- Inchworm
  ('leg-press', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Leg_Press/0.jpg'), -- Leg Press
  ('leg-press-45', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Leg_Press/0.jpg'), -- Leg Press
  ('levantamento-terra', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Barbell_Deadlift/0.jpg'), -- Barbell Deadlift
  ('levantamento-terra-romeno', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Romanian_Deadlift/0.jpg'), -- Romanian Deadlift
  ('mesa-flexora', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Lying_Leg_Curls/0.jpg'), -- Lying Leg Curls
  ('mountain-climber', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Mountain_Climbers/0.jpg'), -- Mountain Climbers
  ('panturrilha-em-pe', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Standing_Calf_Raises/0.jpg'), -- Standing Calf Raises
  ('panturrilha-em-pe-na-maquina', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Standing_Calf_Raises/0.jpg'), -- Standing Calf Raises
  ('panturrilha-no-leg-press', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Calf_Press_On_The_Leg_Press_Machine/0.jpg'), -- Calf Press On The Leg Press Machine
  ('panturrilha-no-smith', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Smith_Machine_Calf_Raise/0.jpg'), -- Smith Machine Calf Raise
  ('panturrilha-sentada', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Seated_Calf_Raise/0.jpg'), -- Seated Calf Raise
  ('paralelas', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Dips_-_Chest_Version/0.jpg'), -- Dips - Chest Version
  ('passada', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Barbell_Walking_Lunge/0.jpg'), -- Barbell Walking Lunge
  ('peck-deck', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Butterfly/0.jpg'), -- Butterfly
  ('power-clean', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Power_Clean/0.jpg'), -- Power Clean
  ('prancha', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Plank/0.jpg'), -- Plank
  ('prancha-frontal', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Plank/0.jpg'), -- Plank
  ('pular-corda', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Rope_Jumping/0.jpg'), -- Rope Jumping
  ('pulldown', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Wide-Grip_Lat_Pulldown/0.jpg'), -- Wide-Grip Lat Pulldown
  ('pullover', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Straight-Arm_Dumbbell_Pullover/0.jpg'), -- Straight-Arm Dumbbell Pullover
  ('puxada-frontal', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Wide-Grip_Lat_Pulldown/0.jpg'), -- Wide-Grip Lat Pulldown
  ('puxada-frontal-na-polia', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Wide-Grip_Lat_Pulldown/0.jpg'), -- Wide-Grip Lat Pulldown
  ('remada-alta', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Upright_Barbell_Row/0.jpg'), -- Upright Barbell Row
  ('remada-baixa', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Seated_Cable_Rows/0.jpg'), -- Seated Cable Rows
  ('remada-cavalinho', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/T-Bar_Row_with_Handle/0.jpg'), -- T-Bar Row with Handle
  ('remada-curvada', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Bent_Over_Barbell_Row/0.jpg'), -- Bent Over Barbell Row
  ('remada-curvada-com-barra', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Bent_Over_Barbell_Row/0.jpg'), -- Bent Over Barbell Row
  ('remada-unilateral', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/One-Arm_Dumbbell_Row/0.jpg'), -- One-Arm Dumbbell Row
  ('remo-ergometrico', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Rowing_Stationary/0.jpg'), -- Rowing, Stationary
  ('rosca-alternada', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Dumbbell_Alternate_Bicep_Curl/0.jpg'), -- Dumbbell Alternate Bicep Curl
  ('rosca-concentrada', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Concentration_Curls/0.jpg'), -- Concentration Curls
  ('rosca-direta', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Barbell_Curl/0.jpg'), -- Barbell Curl
  ('rosca-direta-com-barra', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Barbell_Curl/0.jpg'), -- Barbell Curl
  ('rosca-inclinada', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Incline_Dumbbell_Curl/0.jpg'), -- Incline Dumbbell Curl
  ('rosca-inversa', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Standing_Dumbbell_Reverse_Curl/0.jpg'), -- Standing Dumbbell Reverse Curl
  ('rosca-martelo', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Hammer_Curls/0.jpg'), -- Hammer Curls
  ('rosca-no-cabo', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/High_Cable_Curls/0.jpg'), -- High Cable Curls
  ('rosca-scott', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Preacher_Curl/0.jpg'), -- Preacher Curl
  ('russian-twist', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Russian_Twist/0.jpg'), -- Russian Twist
  ('smith-squat', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Smith_Machine_Squat/0.jpg'), -- Smith Machine Squat
  ('stiff', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Stiff-Legged_Barbell_Deadlift/0.jpg'), -- Stiff-Legged Barbell Deadlift
  ('supino-declinado', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Decline_Barbell_Bench_Press/0.jpg'), -- Decline Barbell Bench Press
  ('supino-fechado', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Close-Grip_Barbell_Bench_Press/0.jpg'), -- Close-Grip Barbell Bench Press
  ('supino-inclinado', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Barbell_Incline_Bench_Press_-_Medium_Grip/0.jpg'), -- Barbell Incline Bench Press - Medium Grip
  ('supino-inclinado-com-halteres', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Incline_Dumbbell_Press/0.jpg'), -- Incline Dumbbell Press
  ('supino-reto', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Barbell_Bench_Press_-_Medium_Grip/0.jpg'), -- Barbell Bench Press - Medium Grip
  ('supino-reto-com-barra', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Barbell_Bench_Press_-_Medium_Grip/0.jpg'), -- Barbell Bench Press - Medium Grip
  ('terra-romeno', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Romanian_Deadlift/0.jpg'), -- Romanian Deadlift
  ('triceps-banco', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Bench_Dips/0.jpg'), -- Bench Dips
  ('triceps-coice', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Tricep_Dumbbell_Kickback/0.jpg'), -- Tricep Dumbbell Kickback
  ('triceps-corda', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Triceps_Pushdown_-_Rope_Attachment/0.jpg'), -- Triceps Pushdown - Rope Attachment
  ('triceps-frances', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Triceps_Overhead_Extension_with_Rope/0.jpg'), -- Triceps Overhead Extension with Rope
  ('triceps-na-polia-com-corda', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Triceps_Pushdown_-_Rope_Attachment/0.jpg'), -- Triceps Pushdown - Rope Attachment
  ('triceps-pulley', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Triceps_Pushdown/0.jpg'), -- Triceps Pushdown
  ('triceps-testa', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/EZ-Bar_Skullcrusher/0.jpg'), -- EZ-Bar Skullcrusher
  ('worlds-greatest-stretch', 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Worlds_Greatest_Stretch/0.jpg') -- World's Greatest Stretch
) as m (slug, url)
where e.slug = m.slug
  and coalesce(e.thumbnail_url, '') = '';

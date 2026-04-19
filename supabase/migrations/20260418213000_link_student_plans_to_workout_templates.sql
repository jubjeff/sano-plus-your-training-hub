alter table public.student_workout_plans
  add column if not exists source_workout_template_id uuid references public.workout_templates (id) on delete set null;

create index if not exists student_workout_plans_source_workout_template_idx
  on public.student_workout_plans (teacher_id, source_workout_template_id);

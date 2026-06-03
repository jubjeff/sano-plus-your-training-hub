-- Vincula anamneses ao professor que gerou o link
alter table public.anamneses
  add column if not exists teacher_id uuid references public.teachers(id) on delete set null;

create index if not exists anamneses_teacher_id_idx on public.anamneses(teacher_id);

-- Atualiza política de leitura: cada professor vê apenas as suas próprias anamneses
-- (anamneses sem teacher_id ainda são visíveis para qualquer professor por retrocompatibilidade)
drop policy if exists "coach_can_view_anamneses" on public.anamneses;
create policy "coach_can_view_anamneses"
  on public.anamneses for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'professor'
    )
    and (
      teacher_id is null
      or teacher_id in (
        select id from public.teachers where user_id = auth.uid()
      )
    )
  );

drop policy if exists "coach_can_update_anamnesis" on public.anamneses;
create policy "coach_can_update_anamnesis"
  on public.anamneses for update
  to authenticated
  using (
    teacher_id is null
    or teacher_id in (
      select id from public.teachers where user_id = auth.uid()
    )
  );

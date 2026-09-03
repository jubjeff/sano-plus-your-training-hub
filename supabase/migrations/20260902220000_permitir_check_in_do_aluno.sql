-- Destrava o check-in do aluno.
--
-- O aluno clicava em "Fazer check-in" e a operacao falhava com
-- "Voce nao pode alterar campos protegidos do seu cadastro." (42501).
--
-- Encadeamento: o insert em student_check_ins dispara
-- sync_student_last_check_in, que faz UPDATE em students.last_check_in_at.
-- Essa funcao NAO e security definer, entao roda com os privilegios do aluno,
-- e o guard_student_self_update trata last_check_in_at como campo protegido.
-- Como nao havia contexto para check-in, o guard lancava excecao e derrubava a
-- transacao inteira — o check-in nunca era gravado.
--
-- Correcao seguindo o padrao ja usado pelos outros fluxos do aluno
-- (first_access_complete, touch_last_login, submit_payment_proof): a trigger
-- declara o contexto 'check_in' e o guard libera exatamente essa mudanca,
-- nada alem dela.

-- ── 1. A trigger declara o contexto ──────────────────────────────────────────
create or replace function public.sync_student_last_check_in()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- true = escopo da transacao: o contexto morre junto com ela e nao vaza para
  -- outra operacao reaproveitando a mesma conexao do pool.
  perform set_config('app.student_update_context', 'check_in', true);

  update public.students
  set
    last_check_in_at = new.checked_in_at,
    updated_at = timezone('utc', now())
  where id = new.student_id
    and (last_check_in_at is null or last_check_in_at < new.checked_in_at);

  perform set_config('app.student_update_context', '', true);

  return new;
end;
$$;

-- ── 2. O guard passa a reconhecer 'check_in' ─────────────────────────────────
-- Identico ao de 20260418203000, mais o novo ramo. No ramo de check-in a lista
-- de proibidos inclui TUDO que os outros proibem e mais first_access_completed_at,
-- access_status e must_change_password: a unica coluna que a trigger toca e
-- last_check_in_at (alem de updated_at), entao qualquer outra mudanca sob esse
-- contexto e sinal de uso indevido.
create or replace function public.guard_student_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  update_context text := current_setting('app.student_update_context', true);
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if old.auth_user_id = auth.uid() then
    if update_context = 'check_in' then
      if new.id is distinct from old.id
        or new.teacher_id is distinct from old.teacher_id
        or new.auth_user_id is distinct from old.auth_user_id
        or new.email is distinct from old.email
        or new.full_name is distinct from old.full_name
        or new.status is distinct from old.status
        or new.access_status is distinct from old.access_status
        or new.must_change_password is distinct from old.must_change_password
        or new.temporary_password_generated_at is distinct from old.temporary_password_generated_at
        or new.first_access_completed_at is distinct from old.first_access_completed_at
        or new.last_login_at is distinct from old.last_login_at
        or new.payment_due_date is distinct from old.payment_due_date
        or new.payment_last_paid_at is distinct from old.payment_last_paid_at
        or new.proof_of_payment_status is distinct from old.proof_of_payment_status
        or new.proof_of_payment_storage_key is distinct from old.proof_of_payment_storage_key
        or new.proof_of_payment_file_url is distinct from old.proof_of_payment_file_url
        or new.proof_of_payment_file_name is distinct from old.proof_of_payment_file_name
        or new.proof_of_payment_mime_type is distinct from old.proof_of_payment_mime_type
        or new.proof_of_payment_sent_at is distinct from old.proof_of_payment_sent_at
        or new.start_date is distinct from old.start_date
        or new.workout_updated_at is distinct from old.workout_updated_at
        or new.next_workout_change is distinct from old.next_workout_change
        or new.metadata is distinct from old.metadata then
        raise exception 'Voce nao pode alterar campos protegidos do seu cadastro.'
          using errcode = '42501';
      end if;

      return new;
    end if;

    if update_context = 'first_access_complete' then
      if new.id is distinct from old.id
        or new.teacher_id is distinct from old.teacher_id
        or new.auth_user_id is distinct from old.auth_user_id
        or new.email is distinct from old.email
        or new.status is distinct from old.status
        or new.temporary_password_generated_at is distinct from old.temporary_password_generated_at
        or new.last_check_in_at is distinct from old.last_check_in_at
        or new.payment_due_date is distinct from old.payment_due_date
        or new.payment_last_paid_at is distinct from old.payment_last_paid_at
        or new.proof_of_payment_status is distinct from old.proof_of_payment_status
        or new.proof_of_payment_storage_key is distinct from old.proof_of_payment_storage_key
        or new.proof_of_payment_file_url is distinct from old.proof_of_payment_file_url
        or new.proof_of_payment_file_name is distinct from old.proof_of_payment_file_name
        or new.proof_of_payment_mime_type is distinct from old.proof_of_payment_mime_type
        or new.proof_of_payment_sent_at is distinct from old.proof_of_payment_sent_at
        or new.start_date is distinct from old.start_date
        or new.workout_updated_at is distinct from old.workout_updated_at
        or new.next_workout_change is distinct from old.next_workout_change
        or new.metadata is distinct from old.metadata then
        raise exception 'Voce nao pode alterar campos protegidos do seu cadastro.'
          using errcode = '42501';
      end if;

      return new;
    end if;

    if update_context = 'touch_last_login' then
      if new.id is distinct from old.id
        or new.teacher_id is distinct from old.teacher_id
        or new.auth_user_id is distinct from old.auth_user_id
        or new.email is distinct from old.email
        or new.status is distinct from old.status
        or new.access_status is distinct from old.access_status
        or new.must_change_password is distinct from old.must_change_password
        or new.temporary_password_generated_at is distinct from old.temporary_password_generated_at
        or new.first_access_completed_at is distinct from old.first_access_completed_at
        or new.last_check_in_at is distinct from old.last_check_in_at
        or new.payment_due_date is distinct from old.payment_due_date
        or new.payment_last_paid_at is distinct from old.payment_last_paid_at
        or new.proof_of_payment_status is distinct from old.proof_of_payment_status
        or new.proof_of_payment_storage_key is distinct from old.proof_of_payment_storage_key
        or new.proof_of_payment_file_url is distinct from old.proof_of_payment_file_url
        or new.proof_of_payment_file_name is distinct from old.proof_of_payment_file_name
        or new.proof_of_payment_mime_type is distinct from old.proof_of_payment_mime_type
        or new.proof_of_payment_sent_at is distinct from old.proof_of_payment_sent_at
        or new.start_date is distinct from old.start_date
        or new.workout_updated_at is distinct from old.workout_updated_at
        or new.next_workout_change is distinct from old.next_workout_change
        or new.metadata is distinct from old.metadata then
        raise exception 'Voce nao pode alterar campos protegidos do seu cadastro.'
          using errcode = '42501';
      end if;

      return new;
    end if;

    if update_context = 'submit_payment_proof' then
      if new.id is distinct from old.id
        or new.teacher_id is distinct from old.teacher_id
        or new.auth_user_id is distinct from old.auth_user_id
        or new.email is distinct from old.email
        or new.status is distinct from old.status
        or new.access_status is distinct from old.access_status
        or new.must_change_password is distinct from old.must_change_password
        or new.temporary_password_generated_at is distinct from old.temporary_password_generated_at
        or new.first_access_completed_at is distinct from old.first_access_completed_at
        or new.last_login_at is distinct from old.last_login_at
        or new.last_check_in_at is distinct from old.last_check_in_at
        or new.payment_due_date is distinct from old.payment_due_date
        or new.payment_last_paid_at is distinct from old.payment_last_paid_at
        or new.start_date is distinct from old.start_date
        or new.workout_updated_at is distinct from old.workout_updated_at
        or new.next_workout_change is distinct from old.next_workout_change
        or new.metadata is distinct from old.metadata then
        raise exception 'Voce nao pode alterar campos protegidos do seu cadastro.'
          using errcode = '42501';
      end if;

      return new;
    end if;

    if new.id is distinct from old.id
      or new.teacher_id is distinct from old.teacher_id
      or new.auth_user_id is distinct from old.auth_user_id
      or new.email is distinct from old.email
      or new.status is distinct from old.status
      or new.access_status is distinct from old.access_status
      or new.must_change_password is distinct from old.must_change_password
      or new.temporary_password_generated_at is distinct from old.temporary_password_generated_at
      or new.first_access_completed_at is distinct from old.first_access_completed_at
      or new.last_login_at is distinct from old.last_login_at
      or new.last_check_in_at is distinct from old.last_check_in_at
      or new.payment_due_date is distinct from old.payment_due_date
      or new.payment_last_paid_at is distinct from old.payment_last_paid_at
      or new.proof_of_payment_status is distinct from old.proof_of_payment_status
      or new.proof_of_payment_storage_key is distinct from old.proof_of_payment_storage_key
      or new.proof_of_payment_file_url is distinct from old.proof_of_payment_file_url
      or new.proof_of_payment_file_name is distinct from old.proof_of_payment_file_name
      or new.proof_of_payment_mime_type is distinct from old.proof_of_payment_mime_type
      or new.proof_of_payment_sent_at is distinct from old.proof_of_payment_sent_at
      or new.start_date is distinct from old.start_date
      or new.workout_updated_at is distinct from old.workout_updated_at
      or new.next_workout_change is distinct from old.next_workout_change
      or new.metadata is distinct from old.metadata then
      raise exception 'Voce nao pode alterar campos protegidos do seu cadastro.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

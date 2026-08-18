-- ─────────────────────────────────────────────────────────────────────────────
-- Chave PIX do professor
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.teachers
  add column if not exists pix_key      text,
  add column if not exists pix_key_type text
    check (
      pix_key_type is null or
      pix_key_type in ('cpf', 'cnpj', 'email', 'phone', 'random')
    );

-- ─────────────────────────────────────────────────────────────────────────────
-- Comprovante e aprovação PIX na assinatura
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.assinaturas
  add column if not exists payment_proof_url           text,
  add column if not exists payment_proof_status        text not null default 'none'
    check (payment_proof_status in ('none', 'submitted', 'approved', 'rejected')),
  add column if not exists payment_proof_submitted_at  timestamptz,
  add column if not exists payment_proof_approved_at   timestamptz,
  add column if not exists payer_note                  text;

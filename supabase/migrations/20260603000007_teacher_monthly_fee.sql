-- Valor mensal da consultoria definido pelo professor
alter table public.teachers
  add column if not exists monthly_fee numeric(10,2)
    check (monthly_fee is null or monthly_fee >= 0);

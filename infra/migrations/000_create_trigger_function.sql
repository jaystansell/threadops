-- 000: Shared trigger function for updated_at columns
-- Must run before any migration that creates updated_at triggers.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

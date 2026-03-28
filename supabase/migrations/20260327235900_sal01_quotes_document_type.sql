alter table public.quotes
  add column if not exists document_type text;

update public.quotes
set document_type = 'quote'
where document_type is null;

alter table public.quotes
  alter column document_type set default 'quote';

alter table public.quotes
  alter column document_type set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'quotes_document_type_check'
  ) then
    alter table public.quotes
      add constraint quotes_document_type_check
      check (document_type in ('quote', 'contract'));
  end if;
end $$;

create index if not exists idx_quotes_document_type
  on public.quotes (document_type);

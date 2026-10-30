-- Apply in the Supabase SQL editor. Public demo uses fictional local records only.
create table if not exists public.records (
 id text primary key, owner uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('profile','classroom','student','assessment','plan','activity','completion','observation','attendance')),
 value jsonb not null, revision integer not null default 1 check(revision>0), updated_at timestamptz not null default now()
);
alter table public.records enable row level security;
create policy "Read own records" on public.records for select to authenticated using(owner=auth.uid());
create policy "Insert own records" on public.records for insert to authenticated with check(owner=auth.uid());
create policy "Update own records" on public.records for update to authenticated using(owner=auth.uid()) with check(owner=auth.uid());
create policy "Delete own records" on public.records for delete to authenticated using(owner=auth.uid());
-- One typed record envelope keeps ownership and optimistic concurrency in a single place.
create or replace function public.save_record(record_id text, record_kind text, record_value jsonb, expected_revision integer)
returns void language plpgsql security invoker set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if expected_revision=0 then
   insert into public.records(id,owner,kind,value,revision) values(record_id,auth.uid(),record_kind,record_value,1);
 else
   update public.records set value=record_value,kind=record_kind,revision=expected_revision+1,updated_at=now() where id=record_id and owner=auth.uid() and revision=expected_revision;
   if not found then raise exception 'Conflict: remote revision changed'; end if;
 end if;
end $$;
revoke all on function public.save_record(text,text,jsonb,integer) from public;
grant execute on function public.save_record(text,text,jsonb,integer) to authenticated;

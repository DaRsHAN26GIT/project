-- Existing projects: allow conversation records under the same ownership RLS policies.
-- Run once in Supabase SQL Editor. No policies or data are removed.
alter table public.records drop constraint if exists records_kind_check;
alter table public.records add constraint records_kind_check check(kind in ('profile','classroom','student','assessment','plan','activity','completion','observation','attendance','conversation'));

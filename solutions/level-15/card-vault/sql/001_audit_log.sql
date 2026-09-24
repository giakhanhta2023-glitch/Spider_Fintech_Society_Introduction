-- An audit log the application cannot edit.
--
--   psql "$DATABASE_URL" -f sql/001_audit_log.sql
--
-- Every detokenisation is a row here. That is the point of putting all card
-- reads behind one service: there is one place to record them, and the record
-- is worth something only if the thing being audited cannot change it.
--
-- Two layers, because they fail differently.
--
-- **Layer one: roles.** The application connects as `vault_app`, which holds
-- select and insert on this table and nothing else. Update, delete and
-- truncate are refused with SQLSTATE 42501, and a dropped table is refused
-- with "must be owner". This is the layer that matters, because it also
-- contains an attacker who has the application's credentials.
--
-- **Layer two: a trigger.** `vault_auditor` owns the table and still cannot
-- delete from it, because a statement level trigger refuses update, delete and
-- truncate with SQLSTATE 23001. The owner could drop the trigger, so this
-- layer stops mistakes rather than a determined owner: a migration with a
-- careless `delete from audit_log`, a cleanup script, an ORM in a mood.
--
-- Verified on PostgreSQL 18.6, in this order, with these results:
--
--   as vault_app      insert    allowed
--   as vault_app      update    42501  permission denied for table audit_log
--   as vault_app      delete    42501  permission denied for table audit_log
--   as vault_app      truncate  42501  permission denied for table audit_log
--   as vault_app      drop      42501  must be owner of table audit_log
--   as vault_auditor  delete    23001  audit_log is append only: DELETE refused
--   as vault_auditor  truncate  23001  audit_log is append only: TRUNCATE refused
--
-- One row before the five refusals, one row after.
--
-- The remaining way past the trigger is `set session_replication_role =
-- replica`, which disables triggers for the session. On managed Postgres that
-- parameter needs a privilege nobody has: attempting it as the database owner
-- returns "permission denied to set parameter session_replication_role".

begin;

create table if not exists audit_log (
  id       bigserial   primary key,
  at       timestamptz not null default now(),
  actor    text        not null,          -- which service, from its client certificate
  action   text        not null,          -- detokenise, tokenise, rotate, retire
  token    text,                          -- never a PAN. Not once, not encrypted
  request_id text,                        -- joins to the level 16 trace
  detail   jsonb       not null default '{}'::jsonb
);

-- Reads of card numbers are the query this table exists to answer, so it gets
-- the index rather than being discovered later during an incident.
create index if not exists audit_log_detokenise_at
  on audit_log (at desc)
  where action = 'detokenise';

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'vault_auditor') then
    create role vault_auditor nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'vault_app') then
    create role vault_app nologin;
  end if;
end $$;

-- The owner is not the application. Everything else here follows from that one
-- decision, and no amount of trigger writing substitutes for it.
grant usage on schema public to vault_auditor, vault_app;
grant create on schema public to vault_auditor;
alter table audit_log owner to vault_auditor;
alter sequence audit_log_id_seq owner to vault_auditor;

revoke all on audit_log from public;
grant select, insert on audit_log to vault_app;
grant usage on sequence audit_log_id_seq to vault_app;

-- Layer two. Statement level rather than row level, so it fires even when the
-- statement would have matched no rows: the intent is refused, not the effect.
create or replace function audit_log_append_only() returns trigger
language plpgsql as $body$
begin
  raise exception 'audit_log is append only: % refused', tg_op
    using errcode = 'restrict_violation';
end
$body$;

drop trigger if exists audit_log_no_edit on audit_log;
create trigger audit_log_no_edit
  before update or delete on audit_log
  for each statement execute function audit_log_append_only();

drop trigger if exists audit_log_no_truncate on audit_log;
create trigger audit_log_no_truncate
  before truncate on audit_log
  for each statement execute function audit_log_append_only();

commit;

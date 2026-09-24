-- 001: EXPAND. Instant at any table size: nullable, no default.
set lock_timeout = '3s';
set statement_timeout = '30s';

alter table payments add column fee_minor numeric(18, 2);

-- Rollback: drop the column. Nothing reads it yet, so this is safe at any
-- point until deploy 4.

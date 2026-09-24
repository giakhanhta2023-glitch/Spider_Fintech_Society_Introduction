-- 006: CONTRACT. NOT TODAY.
--
-- Scheduled for 2026-02-15, which is two weeks after deploy 5 stopped
-- writing the old column. The date is here because this is the step
-- everybody skips, and then the old column sits there for two years being
-- written by code nobody understands.
--
-- Before running it, check: no code writes old_fee, no report reads it,
-- and deploy 5 has been live for at least a week with no rollback.

set lock_timeout = '3s';

-- alter table payments drop column old_fee;

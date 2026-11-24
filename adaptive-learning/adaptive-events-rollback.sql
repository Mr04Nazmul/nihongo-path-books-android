-- Use only after disabling adaptive upload and pull for deployed clients.
-- Keep the event table and all application/user rows available for recovery.
begin;
revoke execute on function public.nihongo_adaptive_sync(text, bigint, jsonb) from service_role;
commit;

grant usage on schema private to authenticated;

do $move$
declare
  v_definition text;
  v_old text := 'CREATE OR REPLACE FUNCTION public.admin_set_purchase_block';
  v_new text := 'CREATE OR REPLACE FUNCTION private.admin_set_purchase_block';
begin
  v_definition := pg_get_functiondef('public.admin_set_purchase_block(uuid,boolean,text)'::regprocedure);
  if position(v_old in v_definition) = 0 then
    raise exception 'Could not locate the public purchase-block function definition.';
  end if;
  execute replace(v_definition, v_old, v_new);
end;
$move$;

grant execute on function private.admin_set_purchase_block(uuid, boolean, text) to authenticated;

create or replace function public.admin_set_purchase_block(
  p_user_id uuid,
  p_blocked boolean,
  p_reason text default null
)
returns jsonb
language sql
security invoker
set search_path to 'pg_catalog', 'public', 'private'
as $function$
  select private.admin_set_purchase_block(p_user_id, p_blocked, p_reason);
$function$;

revoke all on function public.admin_set_purchase_block(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_purchase_block(uuid, boolean, text) to authenticated;

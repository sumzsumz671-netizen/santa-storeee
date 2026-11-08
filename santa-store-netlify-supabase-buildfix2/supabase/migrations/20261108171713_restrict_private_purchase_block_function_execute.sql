revoke all on function private.admin_set_purchase_block(uuid, boolean, text) from public, anon;
grant execute on function private.admin_set_purchase_block(uuid, boolean, text) to authenticated;

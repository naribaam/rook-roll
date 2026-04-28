REVOKE EXECUTE ON FUNCTION public.award_coins(uuid, integer, tx_type, text, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM anon, authenticated, public;
-- Keep purchase_item & equip_skin callable by authenticated (they enforce auth.uid() internally)
GRANT EXECUTE ON FUNCTION public.purchase_item(item_type, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equip_skin(item_type, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.purchase_item(item_type, text, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.equip_skin(item_type, text) FROM anon, public;

-- Admin can SELECT all clients (active and archived) across all users
CREATE POLICY "admin_clients_select_all" ON public.clients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- Admin can UPDATE all clients across all users (for soft delete / restore)
CREATE POLICY "admin_clients_update_all" ON public.clients
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );
;

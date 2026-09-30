-- 005: RLS szigorítás — csak szuperadmin olvashatja/kezelheti a beérkezett üzeneteket,
-- partner-regisztrációkat és claim-kérelmeket (eddig bármely bejelentkezett user hozzáfért)
-- Alkalmazva élesben: 2026-09-30 (Supabase migration: rls_tighten_contact_partner_claims)

DROP POLICY IF EXISTS "authenticated can read contact messages" ON public.contact_messages;
DROP POLICY IF EXISTS "authenticated can update contact messages" ON public.contact_messages;
DROP POLICY IF EXISTS "authenticated can delete contact messages" ON public.contact_messages;
CREATE POLICY "superadmin read contact messages" ON public.contact_messages
  FOR SELECT TO authenticated USING (get_my_role() = 'superadmin'::user_role);
CREATE POLICY "superadmin update contact messages" ON public.contact_messages
  FOR UPDATE TO authenticated USING (get_my_role() = 'superadmin'::user_role)
  WITH CHECK (get_my_role() = 'superadmin'::user_role);
CREATE POLICY "superadmin delete contact messages" ON public.contact_messages
  FOR DELETE TO authenticated USING (get_my_role() = 'superadmin'::user_role);

DROP POLICY IF EXISTS "auth_read_partner_reg" ON public.partner_registrations;
CREATE POLICY "superadmin read partner_reg" ON public.partner_registrations
  FOR SELECT TO authenticated USING (get_my_role() = 'superadmin'::user_role);

DROP POLICY IF EXISTS "Only admins can read" ON public.doctor_claim_requests;
DROP POLICY IF EXISTS "Only admins can update" ON public.doctor_claim_requests;
CREATE POLICY "superadmin read claims" ON public.doctor_claim_requests
  FOR SELECT TO authenticated USING (get_my_role() = 'superadmin'::user_role);
CREATE POLICY "superadmin update claims" ON public.doctor_claim_requests
  FOR UPDATE TO authenticated USING (get_my_role() = 'superadmin'::user_role)
  WITH CHECK (get_my_role() = 'superadmin'::user_role);

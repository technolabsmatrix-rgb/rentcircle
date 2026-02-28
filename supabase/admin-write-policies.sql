-- ============================================================
-- RentCircle – Admin Write Policies
--
-- Run this in: Supabase Dashboard → SQL Editor → New Query
--
-- WHY: RLS only had public SELECT policies. Admin panel also
-- needs INSERT / UPDATE / DELETE on all tables.
--
-- IMPORTANT: This uses a simple "service role" approach —
-- the anon key gets full write access. For production you
-- should switch to a proper admin role or service key.
-- ============================================================

-- ── Categories ────────────────────────────────────────────
drop policy if exists "Admin can insert categories"  on categories;
drop policy if exists "Admin can update categories"  on categories;
drop policy if exists "Admin can delete categories"  on categories;

create policy "Admin can insert categories"
  on categories for insert to anon, authenticated with check (true);

create policy "Admin can update categories"
  on categories for update to anon, authenticated using (true);

create policy "Admin can delete categories"
  on categories for delete to anon, authenticated using (true);

-- ── Tags ──────────────────────────────────────────────────
drop policy if exists "Admin can insert tags"  on tags;
drop policy if exists "Admin can update tags"  on tags;
drop policy if exists "Admin can delete tags"  on tags;

create policy "Admin can insert tags"
  on tags for insert to anon, authenticated with check (true);

create policy "Admin can update tags"
  on tags for update to anon, authenticated using (true);

create policy "Admin can delete tags"
  on tags for delete to anon, authenticated using (true);

-- ── Products ──────────────────────────────────────────────
drop policy if exists "Admin can insert products"  on products;
drop policy if exists "Admin can update products"  on products;
drop policy if exists "Admin can delete products"  on products;

create policy "Admin can insert products"
  on products for insert to anon, authenticated with check (true);

create policy "Admin can update products"
  on products for update to anon, authenticated using (true);

create policy "Admin can delete products"
  on products for delete to anon, authenticated using (true);

-- ── Plans ─────────────────────────────────────────────────
drop policy if exists "Admin can insert plans"  on plans;
drop policy if exists "Admin can update plans"  on plans;
drop policy if exists "Admin can delete plans"  on plans;

create policy "Admin can insert plans"
  on plans for insert to anon, authenticated with check (true);

create policy "Admin can update plans"
  on plans for update to anon, authenticated using (true);

create policy "Admin can delete plans"
  on plans for delete to anon, authenticated using (true);

-- ── Feature Flags ─────────────────────────────────────────
drop policy if exists "Admin can insert flags"  on feature_flags;
drop policy if exists "Admin can update flags"  on feature_flags;
drop policy if exists "Admin can delete flags"  on feature_flags;

create policy "Admin can insert flags"
  on feature_flags for insert to anon, authenticated with check (true);

create policy "Admin can update flags"
  on feature_flags for update to anon, authenticated using (true);

-- ── Custom Fields ─────────────────────────────────────────
drop policy if exists "Admin can insert custom fields"  on custom_fields;
drop policy if exists "Admin can update custom fields"  on custom_fields;
drop policy if exists "Admin can delete custom fields"  on custom_fields;

create policy "Admin can insert custom fields"
  on custom_fields for insert to anon, authenticated with check (true);

create policy "Admin can update custom fields"
  on custom_fields for update to anon, authenticated using (true);

create policy "Admin can delete custom fields"
  on custom_fields for delete to anon, authenticated using (true);

-- ── Orders ────────────────────────────────────────────────
drop policy if exists "Admin can manage orders"  on orders;

create policy "Admin can manage orders"
  on orders for all to anon, authenticated using (true) with check (true);

-- ── Verify: list all active policies ──────────────────────
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, cmd;

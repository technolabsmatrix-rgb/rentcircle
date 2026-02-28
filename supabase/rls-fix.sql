-- ============================================================
-- RentCircle – RLS Quick Fix
-- 
-- Run this in: Supabase Dashboard → SQL Editor → New Query
--
-- WHY: The most common reason data doesn't load is that Row Level
-- Security (RLS) is blocking anonymous reads. This script drops
-- any conflicting policies and adds clean ones that allow
-- public read access (safe for a public storefront).
-- ============================================================

-- Drop existing read policies (clean slate)
drop policy if exists "Public can read categories"    on categories;
drop policy if exists "Public can read tags"          on tags;
drop policy if exists "Public can read products"      on products;
drop policy if exists "Public can read plans"         on plans;
drop policy if exists "Public can read flags"         on feature_flags;
drop policy if exists "Public can read custom fields" on custom_fields;

-- Recreate with correct syntax
create policy "Public can read categories"
  on categories for select to anon, authenticated using (true);

create policy "Public can read tags"
  on tags for select to anon, authenticated using (true);

create policy "Public can read products"
  on products for select to anon, authenticated using (true);

create policy "Public can read plans"
  on plans for select to anon, authenticated using (true);

create policy "Public can read flags"
  on feature_flags for select to anon, authenticated using (true);

create policy "Public can read custom fields"
  on custom_fields for select to anon, authenticated using (true);

-- Also allow authenticated users to insert/update their own orders
drop policy if exists "Users can read own orders" on orders;
drop policy if exists "Users can insert orders"   on orders;

create policy "Users can read own orders"
  on orders for select to authenticated using (auth.uid() = user_id);

create policy "Users can insert orders"
  on orders for insert to authenticated with check (auth.uid() = user_id);

-- Verify: this should return rows if everything is working
select 'categories' as tbl, count(*) from categories
union all select 'tags',          count(*) from tags
union all select 'products',      count(*) from products
union all select 'plans',         count(*) from plans
union all select 'feature_flags', count(*) from feature_flags;

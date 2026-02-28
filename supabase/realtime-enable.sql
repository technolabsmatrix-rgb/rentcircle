-- ============================================================
-- RentCircle – Enable Supabase Realtime
--
-- Run this in: Supabase Dashboard → SQL Editor → New Query
--
-- This allows the frontend to receive live updates the moment
-- admin changes products, plans, tags or feature flags —
-- without the user needing to refresh the page.
-- ============================================================

-- Add tables to the realtime publication
alter publication supabase_realtime add table plans;
alter publication supabase_realtime add table products;
alter publication supabase_realtime add table tags;
alter publication supabase_realtime add table feature_flags;
alter publication supabase_realtime add table categories;
alter publication supabase_realtime add table custom_fields;

-- Verify which tables have realtime enabled
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
order by tablename;

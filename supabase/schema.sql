-- ============================================================
-- RentCircle – Supabase Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── Enable UUID extension ──────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Categories ────────────────────────────────────────────
create table if not exists categories (
  id         serial primary key,
  name       text not null unique,
  icon       text default '📦',
  active     boolean default true,
  products   integer default 0,
  created_at timestamptz default now()
);

-- ── Tags ──────────────────────────────────────────────────
create table if not exists tags (
  id             serial primary key,
  name           text not null unique,
  emoji          text default '🏷',
  color          text default '#f97316',
  bg             text default 'rgba(249,115,22,0.12)',
  active         boolean default true,
  is_banner_tag  boolean default false,
  max_products   integer default 10,
  created_at     timestamptz default now()
);

-- ── Products ──────────────────────────────────────────────
create table if not exists products (
  id          serial primary key,
  name        text not null,
  category    text not null,
  price_day   integer not null,
  price_month integer,
  price_year  integer,
  stock       integer default 0,
  status      text default 'active' check (status in ('active','low_stock','out_of_stock')),
  description text,
  image       text default '📦',
  condition   text default 'Excellent',
  location    text,
  rating      numeric(3,1) default 4.5,
  reviews     integer default 0,
  rentals     integer default 0,
  owner_id    uuid references auth.users(id) on delete set null,
  owner_name  text,
  owner_email text,
  tag_ids     integer[] default '{}',
  photos      text[] default '{}',
  created_at  timestamptz default now()
);

-- ── Plans ─────────────────────────────────────────────────
create table if not exists plans (
  id          serial primary key,
  name        text not null unique,
  price       integer not null,
  subscribers integer default 0,
  revenue     bigint default 0,
  rentals     integer default -1,
  features    text[] default '{}',
  active      boolean default true,
  created_at  timestamptz default now()
);

-- ── User Profiles (extends Supabase auth.users) ───────────
create table if not exists profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  name           text,
  email          text,
  phone          text,
  city           text,
  plan           text default 'Free',
  status         text default 'active' check (status in ('active','suspended')),
  rentals        integer default 0,
  email_verified boolean default false,
  phone_verified boolean default false,
  joined         text,
  created_at     timestamptz default now()
);

-- ── Orders ────────────────────────────────────────────────
create table if not exists orders (
  id          text primary key default ('RC' || floor(random()*90000+10000)::text),
  product_id  integer references products(id) on delete set null,
  product     text,
  user_id     uuid references auth.users(id) on delete set null,
  user_name   text,
  user_email  text,
  days        integer default 1,
  start_date  date,
  end_date    date,
  amount      integer not null,
  status      text default 'active' check (status in ('active','pending','completed','cancelled')),
  created_at  timestamptz default now()
);

-- ── Feature Flags ─────────────────────────────────────────
create table if not exists feature_flags (
  key        text primary key,
  value      boolean default true,
  updated_at timestamptz default now()
);

-- ── Custom Fields ─────────────────────────────────────────
create table if not exists custom_fields (
  id           serial primary key,
  key          text not null unique,
  label        text not null,
  type         text default 'text',
  required     boolean default false,
  show_in_list boolean default false,
  active       boolean default true,
  created_at   timestamptz default now()
);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

alter table categories   enable row level security;
alter table tags         enable row level security;
alter table products     enable row level security;
alter table plans        enable row level security;
alter table profiles     enable row level security;
alter table orders       enable row level security;
alter table feature_flags enable row level security;
alter table custom_fields enable row level security;

-- Public read access (anyone can browse)
create policy "Public can read categories"   on categories   for select using (true);
create policy "Public can read tags"         on tags         for select using (true);
create policy "Public can read products"     on products     for select using (true);
create policy "Public can read plans"        on plans        for select using (true);
create policy "Public can read flags"        on feature_flags for select using (true);
create policy "Public can read custom fields" on custom_fields for select using (true);

-- Users can read their own profile
create policy "Users can read own profile"
  on profiles for select using (auth.uid() = id);

-- Users can update their own profile
create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- Users can read their own orders
create policy "Users can read own orders"
  on orders for select using (auth.uid() = user_id);

-- NOTE: Admin writes are handled via Supabase Service Role key (server-side)
-- or by creating an 'admin' role. For simplicity, use the service role key
-- in your admin panel only (never expose it on the frontend).

-- ============================================================
-- Seed Data
-- ============================================================

insert into categories (name, icon, active, products) values
  ('Electronics', '📱', true, 1240),
  ('Sports',      '⚽', true, 865),
  ('Outdoor',     '🏕️', true, 430),
  ('Gaming',      '🎮', true, 290),
  ('Tools',       '🔧', false, 540),
  ('Fashion',     '👗', true, 780)
on conflict (name) do nothing;

insert into tags (name, emoji, color, bg, active, is_banner_tag, max_products) values
  ('Hot',          '🔥', '#ef4444', 'rgba(239,68,68,0.12)',    true, false, 10),
  ('Top Selling',  '⭐', '#f59e0b', 'rgba(245,158,11,0.12)',   true, false, 10),
  ('New Arrival',  '✨', '#10b981', 'rgba(16,185,129,0.12)',   true, false, 10),
  ('Limited Stock','⚡', '#7c3aed', 'rgba(124,58,237,0.12)',   true, false, 10),
  ('Best Value',   '💎', '#2563eb', 'rgba(37,99,235,0.12)',    true, false, 10),
  ('Popular',      '❤️', '#ec4899', 'rgba(236,72,153,0.12)',  true, false, 10),
  ('Featured',     '🌟', '#b45309', 'rgba(245,158,11,0.18)',   true, true,  4)
on conflict (name) do nothing;

insert into plans (name, price, subscribers, revenue, rentals, features, active) values
  ('Starter',  749,  1240, 928600,   5,  array['5 rentals/month','Standard delivery','Email support','Basic insurance'],            true),
  ('Pro',      2399, 3850, 9236150,  -1, array['Unlimited rentals','Priority delivery','24/7 support','Full insurance'],            true),
  ('Business', 6599, 420,  2771580,  -1, array['Team accounts (5)','Same-day delivery','Dedicated manager','API access'],           true)
on conflict (name) do nothing;

insert into feature_flags (key, value) values
  ('subscriptionPlans', true),
  ('tagging',           true),
  ('smartSearch',       true),
  ('phoneVerification', true),
  ('emailVerification', true),
  ('customFields',      true),
  ('ratingsReviews',    true),
  ('productBadges',     true),
  ('guestBrowsing',     true),
  ('deliveryTracking',  false),
  ('wishlist',          true),
  ('compareTool',       false)
on conflict (key) do nothing;

insert into custom_fields (key, label, type, required, show_in_list, active) values
  ('city',     'City',           'text', true,  true,  true),
  ('phone',    'Phone Number',   'tel',  true,  true,  true),
  ('dob',      'Date of Birth',  'date', false, false, true),
  ('referral', 'Referral Code',  'text', false, false, false)
on conflict (key) do nothing;

insert into products (name, category, price_day, price_month, price_year, stock, status, image, rating, reviews, rentals, owner_name, tag_ids) values
  ('Sony A7 III Camera',   'Electronics', 2099, 45000, 420000, 12, 'active',     '📷', 4.9, 128, 342, 'Priya Sharma', array[1,2,7]),
  ('DJI Mavic 3 Drone',    'Electronics', 3799, 75000, 720000, 5,  'active',     '🚁', 4.8, 89,  189, 'Ananya Iyer',  array[1,7]),
  ('Trek Mountain Bike',   'Sports',      1249, 22000, 199000, 20, 'active',     '🚵', 4.7, 213, 520, 'Rahul Mehta',  array[2,6,7]),
  ('Camping Tent (6p)',    'Outdoor',     1649, 28000, 260000, 8,  'active',     '⛺', 4.6, 156, 278, 'Sneha Patel',  array[3,7]),
  ('MacBook Pro 16"',      'Electronics', 2899, 58000, 550000, 3,  'low_stock',  '💻', 4.9, 302, 645, 'Priya Sharma', array[2,4]),
  ('PS5 Gaming Console',   'Gaming',      999,  18000, 170000, 0,  'out_of_stock','🎮', 4.9, 445, 891, 'Karan Verma',  array[1,6]),
  ('Surfboard (Longboard)','Sports',      1849, 32000, 300000, 14, 'active',     '🏄', 4.5, 94,  167, 'Ananya Iyer',  array[3,5])
on conflict do nothing;

import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY

// ── Always-visible startup log ────────────────────────────
console.group('%c🔌 Supabase Init', 'font-weight:bold;color:#7c3aed')
if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
  console.error('❌ VITE_SUPABASE_URL is missing!\n  1. Create .env in project root\n  2. Add: VITE_SUPABASE_URL=https://xxxx.supabase.co\n  3. Restart: npm run dev')
} else {
  console.log('✅ URL:', supabaseUrl)
}
if (!supabaseAnon || supabaseAnon.includes('placeholder')) {
  console.error('❌ VITE_SUPABASE_ANON_KEY is missing!')
} else {
  console.log('✅ KEY:', supabaseAnon.slice(0, 20) + '…')
}
console.groupEnd()

export const supabase = createClient(
  supabaseUrl  || 'https://placeholder.supabase.co',
  supabaseAnon || 'placeholder'
)

// ── Verbose query wrapper ─────────────────────────────────
async function q(label, fn) {
  console.log('%c📡 ' + label, 'color:#6366f1')
  try {
    const { data, error } = await fn()
    if (error) {
      console.error('❌ ' + label + ':', error.message, error)
      if (error.message?.includes('permission') || error.code === 'PGRST301') {
        console.warn('💡 RLS fix: Supabase Dashboard → Authentication → Policies → add SELECT policy for this table')
      }
      if (error.code === '42P01') {
        console.warn('💡 Table missing: run supabase/schema.sql in Supabase SQL Editor')
      }
      throw error
    }
    console.log('✅ ' + label + ':', Array.isArray(data) ? data.length + ' rows' : 'ok')
    return data
  } catch (e) {
    if (!e.code) console.error('❌ ' + label + ' network error:', e.message)
    throw e
  }
}

// ─── Auth ─────────────────────────────────────────────────
export const signUp  = (email, password, meta = {}) =>
  supabase.auth.signUp({ email, password, options: { data: meta } })
export const signIn  = (email, password) =>
  supabase.auth.signInWithPassword({ email, password })
export const signOut = () => supabase.auth.signOut()
export const getSession   = () => supabase.auth.getSession()
export const onAuthChange = (cb) => supabase.auth.onAuthStateChange(cb)

// ─── Products ─────────────────────────────────────────────
export const fetchProducts = () =>
  q('products', () => supabase.from('products').select('*').order('created_at', { ascending: false }))
    .then(rows => rows.map(fromDbProduct))

export const insertProduct = (product) =>
  q('products/insert', () =>
    supabase.from('products').insert(toDbProduct(product)).select().single()
  ).then(fromDbProduct)

export const updateProduct = (id, product) =>
  q('products/update', () =>
    supabase.from('products').update(toDbProduct(product)).eq('id', id).select().single()
  ).then(fromDbProduct)

export const deleteProduct = (id) =>
  q('products/delete', () => supabase.from('products').delete().eq('id', id).select())

// ─── Categories ───────────────────────────────────────────
export const fetchCategories = () =>
  q('categories', () => supabase.from('categories').select('*').order('name'))

export const upsertCategory = (cat) =>
  q('categories/upsert', () => supabase.from('categories').upsert(cat).select().single())

export const deleteCategory = (id) =>
  q('categories/delete', () => supabase.from('categories').delete().eq('id', id).select())

// ─── Tags ─────────────────────────────────────────────────
export const fetchTags = () =>
  q('tags', () => supabase.from('tags').select('*').order('id'))
    .then(rows => rows.map(t => ({ ...t, isBannerTag: t.is_banner_tag, maxProducts: t.max_products })))

export const upsertTag = (tag) => {
  const { isBannerTag, maxProducts, ...rest } = tag
  return q('tags/upsert', () =>
    supabase.from('tags').upsert({ ...rest, is_banner_tag: isBannerTag, max_products: maxProducts }).select().single()
  ).then(d => ({ ...d, isBannerTag: d.is_banner_tag, maxProducts: d.max_products }))
}

export const deleteTag = (id) =>
  q('tags/delete', () => supabase.from('tags').delete().eq('id', id).select())

// ─── Profiles ─────────────────────────────────────────────
function fromDbProfile(p) {
  return {
    ...p,
    emailVerified: p.emailVerified ?? p.email_verified ?? false,
    phoneVerified: p.phoneVerified ?? p.phone_verified ?? false,
  }
}

function toDbProfile(profile) {
  const { emailVerified, phoneVerified, ...rest } = profile
  return {
    ...rest,
    email_verified: emailVerified ?? rest.email_verified ?? false,
    phone_verified: phoneVerified ?? rest.phone_verified ?? false,
  }
}
// ─── Plans ────────────────────────────────────────────────
export const fetchPlans = () =>
  q('plans', () => supabase.from('plans').select('*').order('price'))
    .then(rows => rows.map(p => ({
      ...p,
      productExpiry: p.product_expiry ?? null,
    })))

export const upsertPlan = (plan) => {
  // Strip frontend-only UI fields before sending to DB
  const { color, accent, listingLimit, popular, productExpiry, ...dbPlan } = plan
  return q('plans/upsert', () =>
    supabase.from('plans')
      .upsert({ ...dbPlan, product_expiry: productExpiry ?? null }, { onConflict: 'id' })
      .select()
      .single()
  ).then(p => ({
    ...p,
    productExpiry: p.product_expiry ?? null,
  }))
}

// ─── Profiles ─────────────────────────────────────────────
export const fetchProfiles = () =>
  q('profiles', () => supabase.from('profiles').select('*').order('created_at', { ascending: false }))

export const upsertProfile = (profile) =>
  q('profiles/upsert', () => supabase.from('profiles').upsert(profile).select().single())

// ─── Orders ───────────────────────────────────────────────
export const fetchOrders = () =>
  q('orders', () => supabase.from('orders').select('*').order('created_at', { ascending: false }))

export const insertOrder = (order) =>
  q('orders/insert', () => supabase.from('orders').insert(order).select().single())

export const updateOrderStatus = (id, status) =>
  q('orders/update', () =>
    supabase.from('orders').update({ status }).eq('id', id).select().single()
  )

// ─── Feature Flags ────────────────────────────────────────
export const fetchFlags = () =>
  q('feature_flags', () => supabase.from('feature_flags').select('key, value'))
    .then(rows => Object.fromEntries(rows.map(r => [r.key, r.value])))

export const updateFlag = (key, value) =>
  q('feature_flags/update', () =>
    supabase.from('feature_flags').upsert({ key, value, updated_at: new Date().toISOString() }).select()
  )

// ─── Custom Fields ────────────────────────────────────────
export const fetchCustomFields = () =>
  q('custom_fields', () => supabase.from('custom_fields').select('*').order('id'))
    .then(rows => rows.map(f => ({ ...f, showInList: f.show_in_list })))

export const upsertCustomField = ({ showInList, ...rest }) =>
  q('custom_fields/upsert', () =>
    supabase.from('custom_fields').upsert({ ...rest, show_in_list: showInList }).select().single()
  ).then(d => ({ ...d, showInList: d.show_in_list }))

export const deleteCustomField = (id) =>
  q('custom_fields/delete', () => supabase.from('custom_fields').delete().eq('id', id).select())

// ─── Field mapping ────────────────────────────────────────
function toDbProduct(p) {
  // Photos: frontend stores [{id, url, name}], DB stores text[] of URLs
  const photoUrls = (p.photos || []).map(ph =>
    typeof ph === "string" ? ph : ph?.url
  ).filter(Boolean);

  return {
    ...(p.id && { id: p.id }),
    name:        p.name,
    category:    p.category,
    price_day:   p.priceDay  || p.price || 0,
    price_month: p.priceMonth,
    price_year:  p.priceYear,
    stock:       p.stock,
    status:      p.status    || 'active',
    badge:       p.badge     || 'Pending Review',
    description: p.description,
    image:       p.image     || '📦',
    condition:   p.condition,
    location:    p.location,
    rating:      p.rating,
    reviews:     p.reviews,
    rentals:     p.rentals,
    owner_name:  p.owner     || p.ownerName,
    owner_email: p.ownerEmail,
    tag_ids:          p.tags      || p.tagIds || [],
    photos:           photoUrls,   // ← save as plain URL strings
    min_duration:     p.minDuration     || p.min_duration     || null,
    min_duration_type: p.minDurationType || p.min_duration_type || 'days',
  }
}

export function fromDbProduct(p) {
  // Photos: DB returns text[] of URLs, convert back to {id, url} objects
  const photos = (p.photos || []).map((ph, i) =>
    typeof ph === "string"
      ? { id: `db-${p.id}-${i}`, url: ph, name: `photo-${i + 1}` }
      : ph
  );

  return {
    id:          p.id,
    name:        p.name,
    category:    p.category,
    priceDay:    p.price_day,
    price:       p.price_day,
    priceMonth:  p.price_month,
    priceYear:   p.price_year,
    stock:       p.stock,
    status:      p.status,
    badge:       p.badge,
    description: p.description,
    image:       p.image,
    condition:   p.condition,
    location:    p.location,
    rating:      p.rating,
    reviews:     p.reviews,
    rentals:     p.rentals,
    owner:       p.owner_name,
    ownerName:   p.owner_name,
    ownerEmail:  p.owner_email,
    tags:        p.tag_ids || [],
    photos,      // ← always {id, url} objects
    createdAt:   p.created_at,
    minDuration:     p.min_duration     || null,
    minDurationType: p.min_duration_type || 'days',
  }
}







// ─── Realtime subscriptions ───────────────────────────────
// Call once on app start — callback fires whenever a table changes
export function subscribeTo(table, callback) {
  const channel = supabase
    .channel(`realtime:${table}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table },
      (payload) => {
        console.log(`🔄 Realtime [${table}]:`, payload.eventType, payload)
        callback(payload)
      }
    )
    .subscribe((status) => {
      console.log(`📡 Realtime [${table}] status:`, status)
    })
  // Return unsubscribe function
  return () => supabase.removeChannel(channel)
}

/**
 * RentCircle – Supabase Connection Debugger
 * Run this in your browser console OR as: node src/lib/debug-supabase.js
 *
 * Usage in browser console:
 *   import('/src/lib/debug-supabase.js')
 *
 * What it checks:
 *   1. Env vars present
 *   2. Supabase reachable (ping)
 *   3. Each table readable
 *   4. RLS policies working
 *   5. Row counts
 */

const SUPABASE_URL  = import.meta.env?.VITE_SUPABASE_URL  || process.env?.VITE_SUPABASE_URL
const SUPABASE_KEY  = import.meta.env?.VITE_SUPABASE_ANON_KEY || process.env?.VITE_SUPABASE_ANON_KEY

const log  = (emoji, msg, data) => console.log(`${emoji} ${msg}`, data !== undefined ? data : '')
const ok   = (msg, data) => log('✅', msg, data)
const fail = (msg, data) => log('❌', msg, data)
const warn = (msg, data) => log('⚠️', msg, data)
const info = (msg, data) => log('ℹ️', msg, data)

async function debugSupabase() {
  console.log('\n════════════════════════════════════════')
  console.log('  RentCircle – Supabase Diagnostics')
  console.log('════════════════════════════════════════\n')

  // ── 1. Check env vars ──────────────────────────────────
  console.log('── Step 1: Environment Variables ──')
  if (!SUPABASE_URL || SUPABASE_URL.includes('placeholder')) {
    fail('VITE_SUPABASE_URL is missing or placeholder')
    fail('Fix: Add VITE_SUPABASE_URL=https://xxxx.supabase.co to your .env file')
    return
  }
  if (!SUPABASE_KEY || SUPABASE_KEY.includes('placeholder')) {
    fail('VITE_SUPABASE_ANON_KEY is missing or placeholder')
    fail('Fix: Add VITE_SUPABASE_ANON_KEY=eyJ... to your .env file')
    return
  }
  ok('VITE_SUPABASE_URL', SUPABASE_URL)
  ok('VITE_SUPABASE_ANON_KEY', SUPABASE_KEY.slice(0, 20) + '...')

  // ── 2. Check network reachability ─────────────────────
  console.log('\n── Step 2: Network Connectivity ──')
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      }
    })
    if (res.ok || res.status === 200) {
      ok('Supabase REST API reachable', `HTTP ${res.status}`)
    } else {
      warn('Supabase responded with', `HTTP ${res.status}`)
      const body = await res.text()
      info('Response body', body.slice(0, 200))
    }
  } catch (e) {
    fail('Cannot reach Supabase', e.message)
    fail('Possible causes: wrong URL, no internet, Supabase project paused')
    return
  }

  // ── 3. Check each table ───────────────────────────────
  console.log('\n── Step 3: Table Access ──')
  const tables = ['products', 'categories', 'tags', 'plans', 'feature_flags', 'custom_fields']

  for (const table of tables) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=count&limit=1`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Prefer': 'count=exact',
        }
      })
      if (res.ok) {
        const count = res.headers.get('content-range')?.split('/')[1] || '?'
        ok(`Table '${table}'`, `${count} rows`)
      } else {
        const err = await res.json()
        fail(`Table '${table}'`, err.message || err.hint || `HTTP ${res.status}`)
        if (res.status === 404) {
          warn(`  → Table '${table}' not found. Did you run schema.sql?`)
        }
        if (res.status === 401 || res.status === 403) {
          warn(`  → RLS policy blocking access. Check Supabase → Auth → Policies`)
        }
      }
    } catch (e) {
      fail(`Table '${table}'`, e.message)
    }
  }

  // ── 4. Test products fetch with actual data ───────────
  console.log('\n── Step 4: Data Fetch Test ──')
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/products?select=id,name,category&limit=3`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      }
    })
    if (res.ok) {
      const data = await res.json()
      if (data.length > 0) {
        ok(`Fetched ${data.length} products:`)
        data.forEach(p => info(`  Product`, `[${p.id}] ${p.name} (${p.category})`))
      } else {
        warn('Products table is empty')
        warn('Fix: Re-run the INSERT section of schema.sql')
      }
    } else {
      fail('Products fetch failed', await res.text())
    }
  } catch (e) {
    fail('Products fetch error', e.message)
  }

  // ── 5. Check if .env was loaded by Vite ───────────────
  console.log('\n── Step 5: Vite Config ──')
  if (typeof import.meta !== 'undefined') {
    const allEnv = Object.keys(import.meta.env || {}).filter(k => k.startsWith('VITE_'))
    if (allEnv.length > 0) {
      ok('Vite env vars loaded', allEnv.join(', '))
    } else {
      fail('No VITE_ env vars found in import.meta.env')
      fail('Fix: Make sure your .env file is in the project ROOT (same level as package.json)')
      fail('Fix: Restart the dev server after editing .env (npm run dev)')
    }
  }

  // ── Summary ───────────────────────────────────────────
  console.log('\n════════════════════════════════════════')
  console.log('  Done! Check ❌ lines above for issues.')
  console.log('════════════════════════════════════════\n')
}

debugSupabase()

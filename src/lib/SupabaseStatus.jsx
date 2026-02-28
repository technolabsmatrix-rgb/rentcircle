/**
 * SupabaseStatus – floating debug panel
 * Shows connection status and row counts for all tables
 *
 * Usage: Add <SupabaseStatus /> anywhere in your app temporarily
 * Remove before production!
 *
 * Example — add to Frontend.jsx temporarily:
 *   import SupabaseStatus from './SupabaseStatus'
 *   // Inside your JSX:
 *   <SupabaseStatus />
 */

import { useState, useEffect } from 'react'

const URL  = import.meta.env.VITE_SUPABASE_URL
const KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY
const TABLES = ['products', 'categories', 'tags', 'plans', 'feature_flags', 'custom_fields']

async function checkTable(table) {
  try {
    const res = await fetch(`${URL}/rest/v1/${table}?select=count&limit=1`, {
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        Prefer: 'count=exact',
      }
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { ok: false, error: err.message || `HTTP ${res.status}`, count: null }
    }
    const count = res.headers.get('content-range')?.split('/')[1] ?? '?'
    return { ok: true, count, error: null }
  } catch (e) {
    return { ok: false, error: e.message, count: null }
  }
}

export default function SupabaseStatus() {
  const [open, setOpen]       = useState(true)
  const [results, setResults] = useState({})
  const [loading, setLoading] = useState(true)
  const [envOk, setEnvOk]     = useState(false)

  useEffect(() => {
    const urlOk = URL && !URL.includes('placeholder')
    const keyOk = KEY && !KEY.includes('placeholder')
    setEnvOk(urlOk && keyOk)

    if (!urlOk || !keyOk) { setLoading(false); return }

    Promise.all(TABLES.map(t => checkTable(t).then(r => [t, r])))
      .then(entries => setResults(Object.fromEntries(entries)))
      .finally(() => setLoading(false))
  }, [])

  const allOk = !loading && envOk && Object.values(results).every(r => r.ok)

  return (
    <div style={{
      position: 'fixed', bottom: 16, left: 16, zIndex: 9999,
      background: '#0f172a', color: '#f8fafc', borderRadius: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      border: `1.5px solid ${allOk ? '#10b981' : '#ef4444'}`,
      fontFamily: 'monospace', fontSize: 12, minWidth: 280,
      transition: 'all 0.2s',
    }}>
      {/* Header */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          padding: '8px 12px', cursor: 'pointer', display: 'flex',
          alignItems: 'center', gap: 8, borderBottom: open ? '1px solid #1e293b' : 'none',
          borderRadius: open ? '12px 12px 0 0' : 12,
          background: allOk ? 'rgba(16,185,129,0.1)' : loading ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
        }}
      >
        <span style={{ fontSize: 16 }}>
          {loading ? '⏳' : allOk ? '🟢' : '🔴'}
        </span>
        <span style={{ fontWeight: 700, flex: 1 }}>
          Supabase {loading ? 'checking…' : allOk ? 'Connected' : 'Issue Detected'}
        </span>
        <span style={{ opacity: 0.5 }}>{open ? '▼' : '▶'}</span>
      </div>

      {open && (
        <div style={{ padding: '10px 12px' }}>
          {/* Env vars */}
          <div style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #1e293b' }}>
            <Row label="SUPABASE_URL"    ok={!!URL && !URL.includes('placeholder')}  val={URL ? URL.replace('https://', '').slice(0, 28) + '…' : 'MISSING'} />
            <Row label="SUPABASE_KEY"    ok={!!KEY && !KEY.includes('placeholder')}  val={KEY ? KEY.slice(0, 12) + '…' : 'MISSING'} />
          </div>

          {/* Tables */}
          {envOk && (
            <div>
              <div style={{ color: '#64748b', marginBottom: 4, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Tables</div>
              {TABLES.map(t => {
                const r = results[t]
                if (!r) return <Row key={t} label={t} ok={null} val="…" />
                return <Row key={t} label={t} ok={r.ok} val={r.ok ? `${r.count} rows` : r.error} />
              })}
            </div>
          )}

          {!envOk && (
            <div style={{ color: '#fbbf24', fontSize: 11, lineHeight: 1.6 }}>
              <div>1. Copy .env.example → .env</div>
              <div>2. Add your Supabase URL + key</div>
              <div>3. Restart: npm run dev</div>
            </div>
          )}

          {envOk && !loading && !allOk && (
            <div style={{ marginTop: 8, color: '#fbbf24', fontSize: 11, lineHeight: 1.6, borderTop: '1px solid #1e293b', paddingTop: 8 }}>
              ⚠ Run <span style={{ color: '#a78bfa' }}>supabase/schema.sql</span> in<br/>
              Supabase → SQL Editor → Run
            </div>
          )}

          <div style={{ marginTop: 8, opacity: 0.3, fontSize: 10 }}>
            Remove &lt;SupabaseStatus /&gt; before prod
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, ok, val }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0', gap: 8 }}>
      <span style={{ color: '#94a3b8' }}>{label}</span>
      <span style={{ color: ok === true ? '#34d399' : ok === false ? '#f87171' : '#fbbf24', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {ok === true ? '✓ ' : ok === false ? '✗ ' : ''}{val}
      </span>
    </div>
  )
}

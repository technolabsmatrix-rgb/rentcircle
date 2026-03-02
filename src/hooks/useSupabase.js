import { useState, useEffect, useCallback } from 'react'
import {
  fetchProducts, insertProduct, updateProduct, deleteProduct,
  fetchCategories, upsertCategory, deleteCategory,
  fetchTags, upsertTag, deleteTag,
  fetchPlans, upsertPlan,
  fetchProfiles, upsertProfile,
  fetchOrders, insertOrder, updateOrderStatus,
  fetchFlags, updateFlag as dbUpdateFlag,
  fetchCustomFields, upsertCustomField, deleteCustomField,
  fromDbProduct,
} from '../lib/supabase'

// ─── Products ─────────────────────────────────────────────
export function useProducts(initialFallback = []) {
  const [products, setProducts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchProducts()
      setProducts(rows.length ? rows : initialFallback)
      console.log('✅ useProducts: loaded', rows.length, 'products from Supabase')
    } catch (e) {
      console.error('❌ useProducts failed, showing fallback data:', e.message)
      setError(e.message)
      setProducts(initialFallback)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const add = async (product) => {
    const saved = await insertProduct(product)
    setProducts(prev => [saved, ...prev])
    return saved
  }

  const update = async (id, product) => {
    const saved = await updateProduct(id, product)
    setProducts(prev => prev.map(p => p.id === id ? saved : p))
    return saved
  }

  const remove = async (id) => {
    await deleteProduct(id)
    setProducts(prev => prev.filter(p => p.id !== id))
  }

  return { products, setProducts, loading, error, refresh: load, add, update, remove }
}

// ─── Categories ───────────────────────────────────────────
export function useCategories(initialFallback = []) {
  const [categories, setCategories] = useState([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    fetchCategories()
      .then(data => { setCategories(data.length ? data : initialFallback); console.log('✅ useCategories:', data.length, 'rows') })
      .catch(e  => { console.error('❌ useCategories failed:', e.message); setCategories(initialFallback) })
      .finally(() => setLoading(false))
  }, [])

  const save = async (cat) => {
    const saved = await upsertCategory(cat)
    setCategories(prev =>
      cat.id ? prev.map(c => c.id === cat.id ? saved : c) : [saved, ...prev]
    )
    return saved
  }

  const remove = async (id) => {
    await deleteCategory(id)
    setCategories(prev => prev.filter(c => c.id !== id))
  }

  return { categories, setCategories, loading, save, remove }
}

// ─── Tags ─────────────────────────────────────────────────
export function useTags(initialFallback = []) {
  const [tags, setTags]         = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    fetchTags()
      .then(data => { setTags(data.length ? data : initialFallback); console.log('✅ useTags:', data.length, 'rows') })
      .catch(e  => { console.error('❌ useTags failed:', e.message); setTags(initialFallback) })
      .finally(() => setLoading(false))
  }, [])

  const save = async (tag) => {
    const saved = await upsertTag(tag)
    setTags(prev =>
      tag.id ? prev.map(t => t.id === tag.id ? saved : t) : [...prev, saved]
    )
    return saved
  }

  const remove = async (id) => {
    await deleteTag(id)
    setTags(prev => prev.filter(t => t.id !== id))
  }

  return { tags, setTags, loading, save, remove }
}

// ─── Plans ────────────────────────────────────────────────
export function usePlans(initialFallback = []) {
  const [plans, setPlans]       = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    fetchPlans()
      .then(data => { setPlans(data.length ? data : initialFallback); console.log('✅ usePlans:', data.length, 'rows') })
      .catch(e  => { console.error('❌ usePlans failed:', e.message); setPlans(initialFallback) })
      .finally(() => setLoading(false))
  }, [])

  const save = async (plan) => {
    const saved = await upsertPlan(plan)
    setPlans(prev =>
      plan.id ? prev.map(p => p.id === plan.id ? saved : p) : [...prev, saved]
    )
    return saved
  }

  return { plans, setPlans, loading, save }
}

// ─── Users / Profiles ─────────────────────────────────────
export function useProfiles(initialFallback = []) {
  const [users, setUsers]       = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    fetchProfiles()
      .then(data => { setUsers(data.length ? data : initialFallback); console.log('✅ useProfiles:', data.length, 'rows') })
      .catch(e  => { console.error('❌ useProfiles failed:', e.message); setUsers(initialFallback) })
      .finally(() => setLoading(false))
  }, [])

  const save = async (profile) => {
    const saved = await upsertProfile(profile)
    setUsers(prev =>
      profile.id ? prev.map(u => u.id === profile.id ? saved : u) : [saved, ...prev]
    )
    return saved
  }

  return { users, setUsers, loading, save }
}

// ─── Orders ───────────────────────────────────────────────
export function useOrders(initialFallback = []) {
  const [orders, setOrders]     = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    fetchOrders()
      .then(data => { setOrders(data.length ? data : initialFallback); console.log('✅ useOrders:', data.length, 'rows') })
      .catch(e  => { console.error('❌ useOrders failed:', e.message); setOrders(initialFallback) })
      .finally(() => setLoading(false))
  }, [])

  const add = async (order) => {
    const saved = await insertOrder(order)
    setOrders(prev => [saved, ...prev])
    return saved
  }

  const updateStatus = async (id, status) => {
    const saved = await updateOrderStatus(id, status)
    setOrders(prev => prev.map(o => o.id === id ? saved : o))
    return saved
  }

  return { orders, setOrders, loading, add, updateStatus }
}

// ─── Feature Flags ────────────────────────────────────────
export function useFeatureFlags(defaultFlags = {}) {
  const [flags, setFlags]       = useState(defaultFlags)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    fetchFlags()
      .then(dbFlags => {
        setFlags({ ...defaultFlags, ...dbFlags })
        console.log('✅ useFeatureFlags:', Object.keys(dbFlags).length, 'flags')
      })
      .catch(e => { console.error('❌ useFeatureFlags failed:', e.message) })
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line

  const toggle = async (key, value) => {
    setFlags(prev => ({ ...prev, [key]: value })) // optimistic
    try {
      await dbUpdateFlag(key, value)
    } catch (e) {
      setFlags(prev => ({ ...prev, [key]: !value })) // rollback
    }
  }

  return { flags, setFlags, loading, toggle }
}

// ─── Custom Fields ────────────────────────────────────────
export function useCustomFields(initialFallback = []) {
  const [customFields, setCustomFields] = useState([])
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    fetchCustomFields()
      .then(data => { setCustomFields(data.length ? data : initialFallback); console.log('✅ useCustomFields:', data.length, 'rows') })
      .catch(e  => { console.error('❌ useCustomFields failed:', e.message); setCustomFields(initialFallback) })
      .finally(() => setLoading(false))
  }, [])

  const save = async (field) => {
    const saved = await upsertCustomField(field)
    setCustomFields(prev =>
      field.id ? prev.map(f => f.id === field.id ? saved : f) : [...prev, saved]
    )
    return saved
  }

  const remove = async (id) => {
    await deleteCustomField(id)
    setCustomFields(prev => prev.filter(f => f.id !== id))
  }

  return { customFields, setCustomFields, loading, save, remove }
}
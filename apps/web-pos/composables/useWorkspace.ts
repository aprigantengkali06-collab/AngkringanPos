interface WorkspaceProfile {
  id: string
  full_name: string
  role: 'owner' | 'manager' | 'cashier'
  pin_code?: string | null
  is_active?: boolean
}

interface OutletRow {
  id: string
  name: string
  brand_name?: string | null
  address?: string | null
  phone?: string | null
  timezone?: string | null
  is_active?: boolean
}

interface OutletMembershipRow {
  outlet_id: string
  outlets: OutletRow | OutletRow[] | null
}

const shouldFallbackToRpc = (message: string) => {
  const normalized = String(message || '').toLowerCase()
  return [
    'edge function',
    'failed to send a request',
    'fetch failed',
    'failed to fetch',
    'functionsfetcherror',
    'networkerror',
    'non-2xx status code',
    'cors'
  ].some((keyword) => normalized.includes(keyword))
}

export const useWorkspace = () => {
  const { $supabase } = useNuxtApp()
  const supabase = $supabase as any

  const loading = useState<boolean>('workspace:loading', () => false)
  const initialized = useState<boolean>('workspace:initialized', () => false)
  const error = useState<string>('workspace:error', () => '')
  const session = useState<any>('workspace:session', () => null)
  const profile = useState<WorkspaceProfile | null>('workspace:profile', () => null)
  const outlets = useState<OutletRow[]>('workspace:outlets', () => [])
  const activeOutletId = useState<string>('workspace:activeOutletId', () => '')
  const activeShift = useState<any>('workspace:activeShift', () => null)

  const fetchActiveShift = async (outletId: string) => {
    if (!outletId) return
    try {
      const { data } = await supabase
        .from('shifts')
        .select('id, opened_at, opening_cash, status')
        .eq('outlet_id', outletId)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      activeShift.value = data || null
    } catch {
      activeShift.value = null
    }
  }

  const activeOutlet = computed(() => outlets.value.find((item) => item.id === activeOutletId.value) || null)
  const canManage = computed(() => ['owner', 'manager'].includes(profile.value?.role || ''))
  const isCashier = computed(() => profile.value?.role === 'cashier')
  const hasOutlet = computed(() => Boolean(activeOutlet.value))

  const normalizeOutlet = (membership: OutletMembershipRow): OutletRow | null => {
    const outletValue = Array.isArray(membership.outlets) ? membership.outlets[0] : membership.outlets
    if (!outletValue) return null
    return {
      id: outletValue.id,
      name: outletValue.name,
      brand_name: outletValue.brand_name,
      address: outletValue.address,
      phone: outletValue.phone,
      timezone: outletValue.timezone,
      is_active: outletValue.is_active
    }
  }

  const persistOutlet = (outletId: string) => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('angkringan-active-outlet', outletId)
      }
    } catch {}
  }

  const getSavedOutletId = (): string => {
    try {
      if (typeof window !== 'undefined') {
        return window.localStorage.getItem('angkringan-active-outlet') || ''
      }
    } catch {}
    return ''
  }

  const reset = () => {
    session.value = null
    profile.value = null
    outlets.value = []
    activeOutletId.value = ''
    error.value = ''
  }

  const switchOutlet = async (outletId: string) => {
    activeOutletId.value = outletId
    persistOutlet(outletId)
    await fetchActiveShift(outletId)
  }

  const runBootstrapRepair = async () => {
    try {
      const { error: invokeError } = await supabase.functions.invoke('bootstrap-user', { body: {} })
      if (invokeError && !shouldFallbackToRpc(invokeError.message || '')) {
        throw invokeError
      }
    } catch (invokeError: any) {
      if (!shouldFallbackToRpc(invokeError?.message || '')) {
        console.warn('bootstrap-user invoke warning', invokeError)
      }
    }

    const { error: rpcError } = await supabase.rpc('bootstrap_workspace')
    if (rpcError && !/function .*bootstrap_workspace/i.test(rpcError.message || '')) {
      throw rpcError
    }
  }

  const bootstrap = async (force = false) => {
    if (loading.value) return
    if (initialized.value && !force) return

    loading.value = true
    error.value = ''

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      session.value = sessionData.session

      if (!sessionData.session) {
        reset()
        initialized.value = true
        return
      }

      await runBootstrapRepair()

      const userId = sessionData.session.user.id

      const [profileRes, outletRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, role, pin_code, is_active')
          .eq('id', userId)
          .single(),
        supabase
          .from('user_outlets')
          .select('outlet_id, outlets(id, name, brand_name, address, phone, timezone, is_active)')
          .eq('user_id', userId)
      ])

      if (profileRes.error) throw profileRes.error
      if (outletRes.error) throw outletRes.error

      profile.value = profileRes.data as WorkspaceProfile
      outlets.value = (outletRes.data || [])
        .map((row: any) => normalizeOutlet(row as unknown as OutletMembershipRow))
        .filter(Boolean) as OutletRow[]

      const savedId = getSavedOutletId()
      const chosen = outlets.value.find((o) => o.id === savedId) || outlets.value[0] || null
      activeOutletId.value = chosen?.id || ''
      if (activeOutletId.value) {
        persistOutlet(activeOutletId.value)
        await fetchActiveShift(activeOutletId.value)
      }

      if (!outlets.value.length) {
        error.value = 'Akun belum terhubung ke outlet. Jalankan SQL bootstrap dan hubungkan user ke outlet.'
      }
    } catch (err: any) {
      console.error('workspace bootstrap error', err)
      error.value = err?.message || 'Gagal memuat data workspace'
    } finally {
      initialized.value = true
      loading.value = false
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    reset()
    initialized.value = true
    await navigateTo('/login')
  }

  return {
    loading,
    initialized,
    error,
    session,
    profile,
    outlets,
    activeOutletId,
    activeOutlet,
    hasOutlet,
    canManage,
    isCashier,
    bootstrap,
    switchOutlet,
    signOut,
    reset,
    activeShift,
    fetchActiveShift
  }
}

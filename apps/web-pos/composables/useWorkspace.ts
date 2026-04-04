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

export const useWorkspace = () => {
  const supabase = useSupabaseClient()

  const loading = useState<boolean>('workspace:loading', () => false)
  const initialized = useState<boolean>('workspace:initialized', () => false)
  const error = useState<string>('workspace:error', () => '')
  const session = useState<any>('workspace:session', () => null)
  const profile = useState<WorkspaceProfile | null>('workspace:profile', () => null)
  const outlets = useState<OutletRow[]>('workspace:outlets', () => [])
  const activeOutletId = useState<string>('workspace:activeOutletId', () => '')

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
    if (!process.client) return
    localStorage.setItem('angkringan-active-outlet', outletId)
  }

  const reset = () => {
    session.value = null
    profile.value = null
    outlets.value = []
    activeOutletId.value = ''
    error.value = ''
  }

  const switchOutlet = (outletId: string) => {
    activeOutletId.value = outletId
    persistOutlet(outletId)
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

      try {
        await supabase.functions.invoke('bootstrap-user', { body: {} })
      } catch {
        // best effort only
      }

      const [{ data: userData }, profileRes, outletRes] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('profiles').select('id, full_name, role, pin_code, is_active').single(),
        supabase
          .from('user_outlets')
          .select('outlet_id, outlets(id, name, brand_name, address, phone, timezone, is_active)')
          .eq('user_id', sessionData.session.user.id)
      ])

      if (!userData.user) {
        reset()
        initialized.value = true
        return
      }

      if (profileRes.error) throw profileRes.error
      if (outletRes.error) throw outletRes.error

      profile.value = profileRes.data as WorkspaceProfile
      outlets.value = (outletRes.data || [])
        .map((row) => normalizeOutlet(row as unknown as OutletMembershipRow))
        .filter(Boolean) as OutletRow[]

      const savedOutletId = process.client ? localStorage.getItem('angkringan-active-outlet') || '' : ''
      const preferredOutletId = savedOutletId || activeOutletId.value
      const chosenOutlet = outlets.value.find((item) => item.id === preferredOutletId) || outlets.value[0] || null
      activeOutletId.value = chosenOutlet?.id || ''
      if (activeOutletId.value) persistOutlet(activeOutletId.value)

      if (!outlets.value.length) {
        error.value = 'Akun ini belum terhubung ke outlet mana pun. Hubungi owner atau manager untuk menambahkan akses outlet.'
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
    reset
  }
}

import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { 'Content-Type': 'application/json', ...corsHeaders }
})

const normalizeRole = (value: string) => ['owner', 'manager', 'cashier'].includes(value) ? value : 'cashier'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ ok: false, error: 'Missing authorization header' }, 401)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: userData, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !userData.user) return json({ ok: false, error: 'Token tidak valid.' }, 401)

    const body = await req.json().catch(() => ({}))
    const action = String(body.action || '')
    const outletId = String(body.outlet_id || '')

    if (!outletId) return json({ ok: false, error: 'outlet_id wajib diisi.' }, 400)

    const { data: requesterProfile, error: requesterError } = await supabaseAdmin
      .from('profiles')
      .select('id, role, is_active, full_name, email')
      .eq('id', userData.user.id)
      .maybeSingle()

    if (requesterError || !requesterProfile?.is_active) return json({ ok: false, error: 'Profil pengguna tidak aktif.' }, 403)

    const { data: requesterAccess } = await supabaseAdmin
      .from('user_outlets')
      .select('id')
      .eq('user_id', userData.user.id)
      .eq('outlet_id', outletId)
      .maybeSingle()

    if (!requesterAccess) return json({ ok: false, error: 'Anda tidak punya akses ke outlet ini.' }, 403)
    if (!['owner', 'manager'].includes(requesterProfile.role)) return json({ ok: false, error: 'Hanya owner/manager yang boleh mengelola tim.' }, 403)

    if (action === 'list') {
      const { data, error } = await supabaseAdmin
        .from('user_outlets')
        .select('user_id, profiles(id, full_name, role, pin_code, is_active, email)')
        .eq('outlet_id', outletId)
        .order('created_at', { ascending: true })

      if (error) return json({ ok: false, error: error.message }, 500)

      const users = (data || []).map((row: any) => {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
        return profile
      }).filter(Boolean)

      return json({ ok: true, users })
    }

    if (action === 'create') {
      const email = String(body.email || '').trim().toLowerCase()
      const password = String(body.password || '')
      const fullName = String(body.full_name || '').trim()
      const role = normalizeRole(String(body.role || 'cashier'))
      const pinCode = body.pin_code ? String(body.pin_code) : null
      const isActive = body.is_active !== false

      if (!email || !password || !fullName) return json({ ok: false, error: 'Nama, email, dan password wajib diisi.' }, 400)
      if (password.length < 6) return json({ ok: false, error: 'Password minimal 6 karakter.' }, 400)
      if (requesterProfile.role !== 'owner' && role === 'owner') return json({ ok: false, error: 'Hanya owner yang dapat membuat akun owner.' }, 403)

      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, role, outlet_id: outletId, pin_code: pinCode },
      })

      if (createError || !created.user) return json({ ok: false, error: createError?.message || 'Gagal membuat user auth.' }, 500)

      const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
        id: created.user.id,
        email,
        full_name: fullName,
        role,
        pin_code: pinCode,
        is_active: isActive,
      })
      if (profileError) return json({ ok: false, error: profileError.message }, 500)

      const { error: outletError } = await supabaseAdmin.from('user_outlets').upsert({ user_id: created.user.id, outlet_id: outletId })
      if (outletError) return json({ ok: false, error: outletError.message }, 500)

      return json({ ok: true, user: { id: created.user.id, email, full_name: fullName, role, pin_code: pinCode, is_active: isActive } })
    }

    if (action === 'update') {
      const userId = String(body.user_id || '')
      const fullName = String(body.full_name || '').trim()
      const role = normalizeRole(String(body.role || 'cashier'))
      const pinCode = body.pin_code ? String(body.pin_code) : null
      const isActive = body.is_active !== false
      const password = String(body.password || '')

      if (!userId || !fullName) return json({ ok: false, error: 'user_id dan full_name wajib diisi.' }, 400)
      if (requesterProfile.role !== 'owner' && role === 'owner') return json({ ok: false, error: 'Hanya owner yang dapat menetapkan role owner.' }, 403)

      const { data: targetAssignment } = await supabaseAdmin
        .from('user_outlets')
        .select('id')
        .eq('user_id', userId)
        .eq('outlet_id', outletId)
        .maybeSingle()
      if (!targetAssignment) return json({ ok: false, error: 'User tidak terhubung ke outlet ini.' }, 404)

      const { error: profileError } = await supabaseAdmin.from('profiles').update({
        full_name: fullName,
        role,
        pin_code: pinCode,
        is_active: isActive,
      }).eq('id', userId)
      if (profileError) return json({ ok: false, error: profileError.message }, 500)

      if (password) {
        if (password.length < 6) return json({ ok: false, error: 'Password minimal 6 karakter.' }, 400)
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password,
          user_metadata: { full_name: fullName, role, pin_code: pinCode, outlet_id: outletId },
        })
        if (authError) return json({ ok: false, error: authError.message }, 500)
      }

      return json({ ok: true })
    }

    return json({ ok: false, error: 'Action tidak dikenali.' }, 400)
  } catch (error) {
    console.error('manage-staff error', error)
    return json({ ok: false, error: error instanceof Error ? error.message : 'Internal server error' }, 500)
  }
})

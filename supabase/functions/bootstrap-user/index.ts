import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { 'Content-Type': 'application/json', ...corsHeaders }
})

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

    const user = userData.user
    const metadata = user.user_metadata || {}
    const fullName = String(metadata.full_name || metadata.name || user.email?.split('@')[0] || 'User POS').trim()
    const requestedRole = String(metadata.role || 'cashier').trim()
    const role = ['owner', 'manager', 'cashier'].includes(requestedRole) ? requestedRole : 'cashier'

    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: user.id,
      email: user.email,
      full_name: fullName,
      role,
      pin_code: metadata.pin_code || null,
      is_active: true,
    })

    if (profileError) return json({ ok: false, error: profileError.message }, 500)

    const { data: existingAssignments, error: assignmentError } = await supabaseAdmin
      .from('user_outlets')
      .select('outlet_id')
      .eq('user_id', user.id)

    if (assignmentError) return json({ ok: false, error: assignmentError.message }, 500)

    if (!existingAssignments?.length) {
      const preferredOutletId = metadata.outlet_id || metadata.outletId || null
      let outletId = preferredOutletId

      if (!outletId) {
        const { data: firstOutlet } = await supabaseAdmin
          .from('outlets')
          .select('id')
          .eq('is_active', true)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()
        outletId = firstOutlet?.id || null
      }

      if (outletId) {
        await supabaseAdmin.from('user_outlets').upsert({ user_id: user.id, outlet_id: outletId })
      }
    }

    const { data: memberships, error: membershipsError } = await supabaseAdmin
      .from('user_outlets')
      .select('outlet_id, outlets(id, name, brand_name, address, phone, timezone, is_active)')
      .eq('user_id', user.id)

    if (membershipsError) return json({ ok: false, error: membershipsError.message }, 500)

    return json({
      ok: true,
      profile: {
        id: user.id,
        email: user.email,
        full_name: fullName,
        role,
      },
      outlets: memberships || [],
    })
  } catch (error) {
    console.error('bootstrap-user error', error)
    return json({ ok: false, error: error instanceof Error ? error.message : 'Internal server error' }, 500)
  }
})

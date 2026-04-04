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

    const body = await req.json()
    const shiftId = String(body.shift_id || '')
    const actualCash = Number(body.actual_cash || 0)
    const notes = body.notes ? String(body.notes).trim() : null

    if (!shiftId) return json({ ok: false, error: 'shift_id wajib diisi.' }, 400)

    const { data: shift, error: shiftError } = await supabaseAdmin
      .from('shifts')
      .select('*')
      .eq('id', shiftId)
      .maybeSingle()
    if (shiftError || !shift) return json({ ok: false, error: 'Shift tidak ditemukan.' }, 404)
    if (shift.status !== 'open') return json({ ok: false, error: 'Shift ini sudah ditutup.' }, 400)

    const { data: access } = await supabaseAdmin
      .from('user_outlets')
      .select('id')
      .eq('user_id', userData.user.id)
      .eq('outlet_id', shift.outlet_id)
      .maybeSingle()
    if (!access) return json({ ok: false, error: 'Anda tidak punya akses ke outlet shift ini.' }, 403)

    await supabaseAdmin.from('profiles').upsert({
      id: userData.user.id,
      email: userData.user.email,
      full_name: String(userData.user.user_metadata?.full_name || userData.user.email?.split('@')[0] || 'User POS').trim(),
      role: ['owner', 'manager', 'cashier'].includes(String(userData.user.user_metadata?.role || 'cashier')) ? String(userData.user.user_metadata?.role || 'cashier') : 'cashier',
      is_active: true,
    })

    const openedAt = new Date(shift.opened_at).toISOString()
    const now = new Date().toISOString()

    const [{ data: cashOrders }, { data: outletExpenses }] = await Promise.all([
      supabaseAdmin
        .from('orders')
        .select('total')
        .eq('shift_id', shiftId)
        .eq('payment_method', 'cash')
        .eq('status', 'paid'),
      supabaseAdmin
        .from('expenses')
        .select('amount')
        .eq('outlet_id', shift.outlet_id)
        .gte('spent_at', openedAt)
        .lte('spent_at', now)
    ])

    const cashSales = (cashOrders || []).reduce((sum: number, row: any) => sum + Number(row.total || 0), 0)
    const expenseTotal = (outletExpenses || []).reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0)
    const expectedCash = Number(shift.opening_cash || 0) + cashSales - expenseTotal
    const cashDifference = Number(actualCash || 0) - expectedCash

    const { data: updatedShift, error: updateError } = await supabaseAdmin
      .from('shifts')
      .update({
        closed_by: userData.user.id,
        closed_at: now,
        expected_cash: expectedCash,
        actual_cash: actualCash,
        cash_difference: cashDifference,
        status: 'closed',
        notes,
      })
      .eq('id', shiftId)
      .select('*')
      .single()

    if (updateError) return json({ ok: false, error: updateError.message }, 500)

    const { error: auditError } = await supabaseAdmin.from('audit_logs').insert({
      outlet_id: shift.outlet_id,
      user_id: userData.user.id,
      action: 'close',
      entity: 'shifts',
      entity_id: shiftId,
      payload: { expected_cash: expectedCash, actual_cash: actualCash, cash_difference: cashDifference },
    })
    if (auditError) console.error('close-shift audit error', auditError)

    return json({ ok: true, shift: updatedShift })
  } catch (error) {
    console.error('close-shift error', error)
    return json({ ok: false, error: error instanceof Error ? error.message : 'Internal server error' }, 500)
  }
})


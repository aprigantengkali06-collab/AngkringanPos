import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { 'Content-Type': 'application/json', ...corsHeaders }
})

const formatJakartaOrderNo = () => {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }))
  const pad = (value: number) => String(value).padStart(2, '0')
  const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const randomPart = crypto.randomUUID().slice(0, 4).toUpperCase()
  return `ORD-${datePart}-${timePart}-${randomPart}`
}

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
    const body = await req.json()
    const outletId = String(body.outlet_id || '')
    const paymentMethod = String(body.payment_method || '')
    const orderType = String(body.order_type || 'dine_in')
    const items = Array.isArray(body.items) ? body.items : []
    const customerName = body.customer_name ? String(body.customer_name).trim() : null
    const notes = body.notes ? String(body.notes).trim() : null
    const requestedPaidAmount = body.paid_amount != null ? Number(body.paid_amount) : null

    if (!outletId) return json({ ok: false, error: 'outlet_id wajib diisi.' }, 400)
    if (!['cash', 'transfer', 'qris'].includes(paymentMethod)) return json({ ok: false, error: 'payment_method tidak valid.' }, 400)
    if (!['dine_in', 'takeaway', 'online'].includes(orderType)) return json({ ok: false, error: 'order_type tidak valid.' }, 400)
    if (!items.length) return json({ ok: false, error: 'items tidak boleh kosong.' }, 400)

    const { data: access } = await supabaseAdmin
      .from('user_outlets')
      .select('id')
      .eq('user_id', user.id)
      .eq('outlet_id', outletId)
      .maybeSingle()
    if (!access) return json({ ok: false, error: 'Anda tidak punya akses ke outlet ini.' }, 403)

    await supabaseAdmin.from('profiles').upsert({
      id: user.id,
      email: user.email,
      full_name: String(user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User POS').trim(),
      role: ['owner', 'manager', 'cashier'].includes(String(user.user_metadata?.role || 'cashier')) ? String(user.user_metadata?.role || 'cashier') : 'cashier',
      is_active: true,
    })

    const normalizedItems = items.map((item: any) => ({
      menu_id: item.menu_id || null,
      product_name: String(item.item_name || item.name || '').trim(),
      quantity: Number(item.qty || 0),
      product_price: Number(item.unit_price || item.price || 0),
      cost_price: Number(item.cost_price || 0),
      discount_amount: Number(item.discount_amount || 0),
      subtotal: Number(item.qty || 0) * Number(item.unit_price || item.price || 0) - Number(item.discount_amount || 0),
      notes: item.notes ? String(item.notes).trim() : null,
    }))

    if (normalizedItems.some((item) => !item.product_name || item.quantity <= 0 || item.product_price < 0 || item.subtotal < 0)) {
      return json({ ok: false, error: 'Ada item transaksi yang tidak valid.' }, 400)
    }

    const subtotal = normalizedItems.reduce((sum, item) => sum + item.subtotal, 0)
    const total = subtotal
    const paidAmount = requestedPaidAmount == null || Number.isNaN(requestedPaidAmount) ? total : requestedPaidAmount
    if (paidAmount < total) return json({ ok: false, error: 'Nominal dibayar kurang dari total transaksi.' }, 400)
    const changeAmount = Math.max(0, paidAmount - total)

    let shiftId = body.shift_id ? String(body.shift_id) : null
    if (!shiftId) {
      const { data: activeShift } = await supabaseAdmin
        .from('shifts')
        .select('id')
        .eq('outlet_id', outletId)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      shiftId = activeShift?.id || null
    }

    const orderNo = formatJakartaOrderNo()
    const paidAt = new Date().toISOString()

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        outlet_id: outletId,
        shift_id: shiftId,
        order_no: orderNo,
        customer_name: customerName,
        order_type: orderType,
        source: 'pos',
        status: 'paid',
        payment_method: paymentMethod,
        subtotal,
        discount_amount: 0,
        service_amount: 0,
        tax_amount: 0,
        total,
        paid_amount: paidAmount,
        change_amount: changeAmount,
        notes,
        created_by: user.id,
        paid_at: paidAt,
      })
      .select('id, order_no, total, change_amount, paid_at')
      .single()

    if (orderError || !order) return json({ ok: false, error: orderError?.message || 'Gagal menyimpan order.' }, 500)

    const orderItemsPayload = normalizedItems.map((item) => ({ ...item, order_id: order.id }))
    const { error: itemsError } = await supabaseAdmin.from('order_items').insert(orderItemsPayload)
    if (itemsError) {
      await supabaseAdmin.from('orders').delete().eq('id', order.id)
      return json({ ok: false, error: itemsError.message }, 500)
    }

    const { error: paymentError } = await supabaseAdmin.from('order_payments').insert({
      order_id: order.id,
      payment_method: paymentMethod,
      amount: paidAmount,
      paid_at: paidAt,
    })
    if (paymentError) console.error('order payment insert error', paymentError)

    const { error: auditError } = await supabaseAdmin.from('audit_logs').insert({
      outlet_id: outletId,
      user_id: user.id,
      action: 'create',
      entity: 'orders',
      entity_id: order.id,
      payload: {
        order_no: order.order_no,
        total,
        item_count: normalizedItems.length,
        payment_method: paymentMethod,
      },
    })
    if (auditError) console.error('audit insert error', auditError)

    return json({ ok: true, order_id: order.id, order_no: order.order_no, total: order.total, change_amount: order.change_amount, paid_at: order.paid_at })
  } catch (error) {
    console.error('create-order error', error)
    return json({ ok: false, error: error instanceof Error ? error.message : 'Internal server error' }, 500)
  }
})


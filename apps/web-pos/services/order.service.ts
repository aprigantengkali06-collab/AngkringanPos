export const orderService = {
  async createOrder(payload: Record<string, unknown>) {
    const supabase = useSupabaseClient()

    // Ambil shift aktif
    const { data: shifts } = await supabase
      .from('shifts')
      .select('id')
      .eq('outlet_id', payload.outlet_id)
      .eq('status', 'open')
      .limit(1)

    const shiftId = shifts?.[0]?.id || null

    // Generate nomor order
    const { data: orderCount } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('outlet_id', payload.outlet_id)

    const date = new Date()
    const dateStr = date.toLocaleDateString('id-ID', {
      year: '2-digit', month: '2-digit', day: '2-digit',
      timeZone: 'Asia/Jakarta'
    }).replace(/\//g, '')
    const count = String((orderCount as any) + 1 || 1).padStart(4, '0')
    const orderNumber = `ORD-${dateStr}-${count}`

    const items = payload.items as any[]
    const subtotal = items.reduce((sum: number, item: any) => sum + item.subtotal, 0)
    const discount = Number(payload.discount || 0)
    const total = subtotal - discount
    const paidAmount = Number(payload.paid_amount || subtotal)
    const change = paidAmount - total

    // Insert order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        outlet_id: payload.outlet_id,
        shift_id: shiftId,
        order_number: orderNumber,
        payment_method: payload.payment_method || 'cash',
        subtotal,
        discount,
        total,
        cash_received: paidAmount,
        cash_change: change,
        notes: payload.notes || null,
        status: 'paid'
      })
      .select('id, order_number, total')
      .single()

    if (orderError) throw new Error(orderError.message)

    // Insert items
    const orderItems = items.map((item: any) => ({
      order_id: order.id,
      product_id: item.menu_id || item.product_id || null,
      product_name: item.item_name || item.product_name || item.name,
      product_price: item.unit_price || item.product_price || item.price,
      quantity: item.qty || item.quantity || 1,
      subtotal: item.subtotal,
      notes: item.notes || null
    }))

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems)

    if (itemsError) throw new Error(itemsError.message)

    return {
      ok: true,
      order_id: order.id,
      order_number: order.order_number,
      total: order.total,
      change
    }
  },

  async listLatest(outletId: string, limit = 100) {
    const supabase = useSupabaseClient()
    const { data, error } = await supabase
      .from('orders')
      .select('id, outlet_id, order_number, status, total, subtotal, discount, payment_method, cash_received, cash_change, notes, created_at')
      .eq('outlet_id', outletId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  },

  async getOrderDetails(orderId: string) {
    const supabase = useSupabaseClient()
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', orderId)
      .single()

    if (error) throw error
    return data
  }
}

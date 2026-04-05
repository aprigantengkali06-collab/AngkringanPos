const normalizeCreateOrderResponse = (payload: any) => ({
  ok: payload?.ok !== false,
  order_id: payload?.order_id,
  total: Number(payload?.total || 0),
  change_amount: Number(payload?.change_amount || 0),
  paid_at: payload?.paid_at || new Date().toISOString()
})

export const orderService = {
  async createOrder(payload: Record<string, unknown>) {
    const supabase = useSupabaseClient()

    // Coba edge function dulu, fallback ke RPC kalau gagal apapun alasannya
    try {
      const result = await supabase.functions.invoke('create-order', {
        body: payload
      })

      // Kalau sukses dan data ok, pakai hasilnya
      if (!result.error && result.data?.ok !== false) {
        return normalizeCreateOrderResponse(result.data)
      }

      // Edge function ada tapi return error / ok: false → langsung ke RPC
    } catch {
      // Edge function tidak bisa dijangkau → ke RPC
    }

    // Fallback: panggil RPC langsung ke database
    const rpcResult = await supabase.rpc('create_order_pos', {
      payload
    })

    if (rpcResult.error) throw new Error(rpcResult.error.message || 'Gagal membuat transaksi.')
    if (rpcResult.data?.ok === false) throw new Error(rpcResult.data.error || 'Gagal membuat transaksi.')

    return normalizeCreateOrderResponse(rpcResult.data)
  },

  async listLatest(outletId: string, limit = 100) {
    const supabase = useSupabaseClient()
    const { data, error } = await supabase
      .from('orders')
      .select('id, outlet_id, customer_name, order_type, status, total, subtotal, discount_amount, payment_method, paid_amount, change_amount, notes, created_at, paid_at')
      .eq('outlet_id', outletId)
      .order('paid_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  },

  async getOrderDetails(orderId: string) {
    const supabase = useSupabaseClient()
    const { data, error } = await supabase
      .from('orders')
      .select('id, customer_name, order_type, payment_method, status, subtotal, discount_amount, total, paid_amount, change_amount, notes, created_at, paid_at, order_items(id, item_name, qty, unit_price, subtotal, notes)')
      .eq('id', orderId)
      .single()

    if (error) throw error
    return data
  }
}

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

export const orderService = {
  async createOrder(payload: Record<string, unknown>) {
    const supabase = useSupabaseClient()

    try {
      const { data, error } = await supabase.functions.invoke('create-order', { body: payload })
      if (error) throw new Error(error.message || 'Gagal memproses transaksi')
      if (data?.ok === false) throw new Error(data.error || 'Gagal memproses transaksi')
      return data
    } catch (error: any) {
      if (!shouldFallbackToRpc(error?.message || '')) {
        throw error
      }

      const { data, error: rpcError } = await supabase.rpc('create_order_pos', {
        payload
      })

      if (rpcError) {
        throw new Error(rpcError.message || 'Gagal memproses transaksi')
      }

      if (!data || data.ok === false) {
        throw new Error(data?.error || 'Gagal memproses transaksi')
      }

      return data
    }
  },

  async listLatest(outletId: string, limit = 100) {
    const supabase = useSupabaseClient()
    const { data, error } = await supabase
      .from('orders')
      .select('id, outlet_id, order_no, customer_name, status, order_type, total, subtotal, discount_amount, payment_method, paid_amount, change_amount, created_at, paid_at, created_by')
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

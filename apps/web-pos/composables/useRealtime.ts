export const useRealtimeOrders = (outletId: string, onChange: () => Promise<void> | void) => {
  const supabase = useSupabaseClient()
  let channel: ReturnType<typeof supabase.channel> | null = null
  onMounted(() => {
    channel = supabase.channel(`orders:${outletId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `outlet_id=eq.${outletId}` }, async () => { await onChange() }).subscribe()
  })
  onBeforeUnmount(() => { if (channel) supabase.removeChannel(channel) })
}

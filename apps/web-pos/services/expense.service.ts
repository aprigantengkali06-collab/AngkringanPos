export const expenseService = {
  async listByOutlet(outletId: string) {
    const supabase = useSupabaseClient()
    const { data, error } = await supabase
      .from('expenses')
      .select('id,category,description,amount,spent_at')
      .eq('outlet_id', outletId)
      .order('spent_at', { ascending: false })
      .limit(100)
    if (error) throw error
    return data || []
  }
}

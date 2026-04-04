export const menuService = {
  async listByOutlet(outletId: string) {
    const supabase = useSupabaseClient()
    const { data, error } = await supabase
      .from('menus')
      .select('id, outlet_id, category_id, sku, name, description, price, cost_price, is_available')
      .eq('outlet_id', outletId)
      .eq('is_available', true)
      .order('name')

    if (error) throw error
    return data || []
  }
}

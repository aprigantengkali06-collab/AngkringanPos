export const reportService = {
  async dailySummary(outletId: string, date: string) {
    const supabase = useSupabaseClient()
    const { data, error } = await supabase.from('vw_daily_sales_summary').select('*').eq('outlet_id', outletId).eq('business_date', date).maybeSingle()
    if (error) throw error
    return data
  }
}

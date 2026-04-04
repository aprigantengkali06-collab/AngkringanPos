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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const body = await req.json().catch(() => ({}))
    const outletId = String(body.outlet_id || '')
    const businessDate = String(body.business_date || new Date().toISOString().slice(0, 10))
    if (!outletId) return json({ ok: false, error: 'outlet_id wajib diisi.' }, 400)

    const { data, error } = await supabase
      .from('vw_daily_sales_summary')
      .select('*')
      .eq('outlet_id', outletId)
      .eq('business_date', businessDate)
      .maybeSingle()

    if (error) return json({ ok: false, error: error.message }, 500)
    return json({ ok: true, summary: data })
  } catch (error) {
    console.error('generate-report error', error)
    return json({ ok: false, error: error instanceof Error ? error.message : 'Internal server error' }, 500)
  }
})

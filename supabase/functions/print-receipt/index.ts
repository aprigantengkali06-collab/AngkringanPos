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
    const gatewayUrl = Deno.env.get('PRINTER_GATEWAY_URL')
    if (!gatewayUrl) return json({ ok: true, queued: false, message: 'PRINTER_GATEWAY_URL belum diatur. Simpan payload di frontend/gateway lokal.' })

    const payload = await req.json().catch(() => ({}))
    const response = await fetch(`${gatewayUrl}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const result = await response.text()
    return json({ ok: response.ok, status: response.status, result })
  } catch (error) {
    console.error('print-receipt error', error)
    return json({ ok: false, error: error instanceof Error ? error.message : 'Internal server error' }, 500)
  }
})

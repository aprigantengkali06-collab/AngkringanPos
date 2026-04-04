import express from 'express'
const app = express()
app.use(express.json())
app.get('/health', (_req, res) => res.json({ ok: true, service: 'printer-gateway', ts: new Date().toISOString() }))
app.post('/print', (req, res) => {
  // TODO: mapping payload ke driver ESC/POS aktual.
  console.log('PRINT JOB', JSON.stringify(req.body))
  res.json({ ok: true, queued: true })
})
app.listen(8788, () => console.log('printer-gateway listening on :8788'))

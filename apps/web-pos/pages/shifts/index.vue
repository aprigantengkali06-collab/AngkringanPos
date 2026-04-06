<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const supabase = useSupabaseClient()
const workspace = useWorkspace()

interface ShiftRow {
  id: string
  outlet_id: string
  opened_by: string
  closed_by: string | null
  opened_at: string
  closed_at: string | null
  opening_cash: number
  expected_cash: number | null
  actual_cash: number | null
  cash_difference: number | null
  status: 'open' | 'closed'
  notes: string | null
}

const loading = ref(false)
const opening = ref(false)
const closing = ref(false)
const shifts = ref<ShiftRow[]>([])
const activeShift = ref<ShiftRow | null>(null)
const errorMessage = ref('')
const successMessage = ref('')
const closeCash = ref<number | null>(null)
const closeNotes = ref('')

// Kalkulasi otomatis kas aktual
const expectedCashDetail = ref({ cashSales: 0, expenses: 0, expectedTotal: 0 })
const loadingExpected = ref(false)

const formatCurrency = (value: number | null | undefined) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`
const formatDateTime = (value?: string | null) => value ? new Date(value).toLocaleString('id-ID') : '-'

const calcExpectedCash = async (shift: ShiftRow) => {
  loadingExpected.value = true
  try {
    const [{ data: cashOrders }, { data: expenses }] = await Promise.all([
      supabase.from('orders').select('total').eq('shift_id', shift.id).eq('payment_method', 'cash').eq('status', 'paid'),
      supabase.from('expenses').select('amount').eq('outlet_id', shift.outlet_id).gte('spent_at', shift.opened_at)
    ])
    const cashSales = (cashOrders || []).reduce((s: number, r: any) => s + Number(r.total || 0), 0)
    const expTotal  = (expenses    || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0)
    const expected  = cashSales - expTotal
    expectedCashDetail.value = { cashSales, expenses: expTotal, expectedTotal: expected }
    closeCash.value = expected
  } catch {
    // gagal hitung, user input manual
  } finally {
    loadingExpected.value = false
  }
}

const load = async () => {
  if (!workspace.activeOutletId.value) return
  loading.value = true
  errorMessage.value = ''

  try {
    const { data, error } = await supabase
      .from('shifts')
      .select('id, outlet_id, opened_by, closed_by, opened_at, closed_at, opening_cash, expected_cash, actual_cash, cash_difference, status, notes')
      .eq('outlet_id', workspace.activeOutletId.value)
      .order('opened_at', { ascending: false })
      .limit(50)

    if (error) throw error
    shifts.value = (data || []) as ShiftRow[]
    activeShift.value = shifts.value.find((item) => item.status === 'open') || null
    if (activeShift.value) await calcExpectedCash(activeShift.value)
  } catch (error: any) {
    errorMessage.value = error?.message || 'Gagal memuat data shift.'
  } finally {
    loading.value = false
  }
}

const openShift = async () => {
  if (!workspace.activeOutletId.value || !workspace.profile.value?.id) return
  opening.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const { error } = await supabase.from('shifts').insert({
      outlet_id: workspace.activeOutletId.value,
      opened_by: workspace.profile.value.id,
      opening_cash: 0,
      status: 'open'
    })

    if (error) throw error
    successMessage.value = 'Shift berhasil dibuka.'
    await load()
  } catch (error: any) {
    errorMessage.value = error?.message || 'Gagal membuka shift.'
  } finally {
    opening.value = false
  }
}

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

const closeShift = async () => {
  if (!activeShift.value) return
  closing.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    let data: any = null

    try {
      const result = await supabase.functions.invoke('close-shift', {
        body: {
          shift_id: activeShift.value.id,
          actual_cash: Number(closeCash.value || 0),
          notes: closeNotes.value.trim() || null
        }
      })

      if (result.error) throw result.error
      data = result.data
    } catch (invokeError: any) {
      if (!shouldFallbackToRpc(invokeError?.message || '')) throw invokeError

      const rpcResult = await supabase.rpc('close_shift_pos', {
        p_shift_id: activeShift.value.id,
        p_actual_cash: Number(closeCash.value || 0),
        p_notes: closeNotes.value.trim() || null
      })

      if (rpcResult.error) throw rpcResult.error
      data = rpcResult.data
    }

    if (data?.ok === false) throw new Error(data.error || 'Gagal menutup shift')

    successMessage.value = 'Shift berhasil ditutup dan direkonsiliasi.'
    closeCash.value = null
    closeNotes.value = ''
    await load()
  } catch (error: any) {
    errorMessage.value = error?.message || 'Gagal menutup shift.'
  } finally {
    closing.value = false
  }
}

const totalShifts = computed(() => shifts.value.length)
const closedShifts = computed(() => shifts.value.filter((item) => item.status === 'closed').length)
const totalOpeningCash = computed(() => shifts.value.reduce((sum, item) => sum + Number(item.opening_cash || 0), 0))
const averageDifference = computed(() => {
  const closed = shifts.value.filter((item) => item.status === 'closed')
  if (!closed.length) return 0
  return closed.reduce((sum, item) => sum + Number(item.cash_difference || 0), 0) / closed.length
})

onMounted(async () => {
  await workspace.bootstrap()
  await load()
})

watch(() => workspace.activeOutletId.value, async (value, oldValue) => {
  if (!value || value === oldValue) return
  await load()
})
</script>

<template>
  <div class="page">

    <section class="page-hero">
      <div class="page-hero-top">
        <div>
          <p class="eyebrow">Operasional</p>
          <h1 class="page-hero-title">Shift Kasir</h1>
        </div>
        <div class="toolbar page-header-actions">
          <button class="btn btn-secondary" :disabled="loading" @click="load">
            {{ loading ? 'Memuat...' : 'Refresh' }}
          </button>
        </div>
      </div>
    </section>

    <div class="shift-kpi-grid">
      <article class="kpi-card">
        <h3>Shift aktif</h3>
        <div class="value">{{ activeShift ? '1' : '0' }}</div>
        <div class="hint">Status outlet saat ini</div>
      </article>
      <article class="kpi-card">
        <h3>Total shift</h3>
        <div class="value">{{ totalShifts }}</div>
        <div class="hint">Riwayat 50 terakhir</div>
      </article>
      <article class="kpi-card">
        <h3>Ditutup</h3>
        <div class="value">{{ closedShifts }}</div>
        <div class="hint">Sudah direkonsiliasi</div>
      </article>
      <article class="kpi-card">
        <h3>Rata selisih</h3>
        <div class="value">{{ formatCurrency(averageDifference) }}</div>
        <div class="hint">Akumulasi selisih kas</div>
      </article>
    </div>

    <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div>
    <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>

    <div class="shift-panels">

      <!-- SHIFT AKTIF -->
      <section class="card stack">
        <div class="shift-section-head">
          <h2 class="shift-section-title">Shift aktif</h2>
          <span v-if="activeShift" class="badge badge-success">● Berjalan</span>
          <span v-else class="badge">Tidak ada</span>
        </div>

        <div v-if="activeShift" class="stack">
          <!-- Info bar -->
          <div class="shift-info-bar">
            <div class="shift-info-item">
              <span class="summary-label">Dibuka</span>
              <strong>{{ formatDateTime(activeShift.opened_at) }}</strong>
            </div>
          </div>

          <!-- Ringkasan kalkulasi otomatis -->
          <div class="calc-summary">
            <p class="summary-label" style="margin-bottom:8px;">
              {{ loadingExpected ? 'Menghitung...' : 'Kalkulasi otomatis' }}
            </p>
            <div class="calc-rows">
              <div class="calc-row positive">
                <span>+ Omzet cash</span>
                <strong>{{ formatCurrency(expectedCashDetail.cashSales) }}</strong>
              </div>
              <div class="calc-row negative" v-if="expectedCashDetail.expenses > 0">
                <span>− Pengeluaran</span>
                <strong>{{ formatCurrency(expectedCashDetail.expenses) }}</strong>
              </div>
              <div class="calc-row total">
                <span>= Kas di laci</span>
                <strong>{{ formatCurrency(expectedCashDetail.expectedTotal) }}</strong>
              </div>
            </div>
          </div>

          <div class="stack" style="gap:8px;">
            <label class="field-label">Kas aktual saat tutup shift</label>
            <input v-model.number="closeCash" class="input" type="number" min="0" placeholder="Terisi otomatis, edit jika beda" />
            <p class="muted small">Terisi otomatis dari omzet cash − pengeluaran. Edit jika ada selisih fisik.</p>
          </div>

          <div class="stack" style="gap:8px;">
            <label class="field-label">Catatan penutupan</label>
            <textarea v-model="closeNotes" class="textarea" placeholder="Catatan selisih, setor bank, kas kurang..." />
          </div>

          <button class="btn btn-danger" :disabled="closing" @click="closeShift">
            {{ closing ? 'Menutup shift...' : 'Tutup shift' }}
          </button>
        </div>

        <div v-else class="stack">
          <p class="muted small">Belum ada shift berjalan. Buka shift untuk mulai mencatat transaksi.</p>
          <button class="btn btn-primary" :disabled="opening" @click="openShift">
            {{ opening ? 'Membuka shift...' : 'Buka shift baru' }}
          </button>
        </div>
      </section>

      <!-- RIWAYAT SHIFT -->
      <section class="card stack">
        <h2 class="shift-section-title">Riwayat shift</h2>

        <div v-if="loading" class="empty-state">Memuat shift...</div>
        <div v-else-if="!shifts.length" class="empty-state">Belum ada data shift.</div>

        <template v-else>
          <div class="table-wrap desktop-table-only">
            <table class="table">
              <thead>
                <tr>
                  <th>Status</th><th>Dibuka</th><th>Ditutup</th>
<th>Ekspektasi</th><th>Aktual</th><th>Selisih</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="shift in shifts" :key="shift.id">
                  <td><span class="badge" :class="shift.status === 'open' ? 'badge-soft' : 'badge-success'">{{ shift.status }}</span></td>
                  <td>{{ formatDateTime(shift.opened_at) }}</td>
                  <td>{{ formatDateTime(shift.closed_at) }}</td>
                  <td>{{ formatCurrency(shift.expected_cash) }}</td>
                  <td>{{ formatCurrency(shift.actual_cash) }}</td>
                  <td>{{ formatCurrency(shift.cash_difference) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="shift-history-list mobile-card-only">
            <article v-for="shift in shifts" :key="shift.id" class="shift-row">
              <div class="shift-row-top">
                <div>
                  <strong class="shift-row-label">{{ shift.status === 'open' ? 'Shift aktif' : 'Shift selesai' }}</strong>
                  <p class="muted small" style="margin:2px 0 0;">{{ formatDateTime(shift.opened_at) }}</p>
                </div>
                <span class="badge" :class="shift.status === 'open' ? 'badge-soft' : 'badge-success'">{{ shift.status }}</span>
              </div>
              <div class="shift-row-stats">
                <div class="shift-stat">
                  <span class="summary-label">Ekspektasi</span>
                  <strong>{{ formatCurrency(shift.expected_cash) }}</strong>
                </div>
                <div class="shift-stat">
                  <span class="summary-label">Aktual</span>
                  <strong>{{ formatCurrency(shift.actual_cash) }}</strong>
                </div>
                <div class="shift-stat">
                  <span class="summary-label">Selisih</span>
                  <strong>{{ formatCurrency(shift.cash_difference) }}</strong>
                </div>
              </div>
              <p v-if="shift.closed_at" class="muted small" style="margin-top:4px;">
                Ditutup: {{ formatDateTime(shift.closed_at) }}
              </p>
            </article>
          </div>
        </template>
      </section>

    </div>
  </div>
</template>

<style scoped>
.shift-kpi-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
@media (min-width: 768px) {
  .shift-kpi-grid { grid-template-columns: repeat(4, 1fr); }
}

.shift-panels {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}
@media (min-width: 768px) {
  .shift-panels { grid-template-columns: repeat(2, 1fr); align-items: start; }
}

.shift-section-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.shift-section-title {
  font-size: 16px;
  font-weight: 700;
  margin: 0;
  flex: 1;
}

.shift-info-bar {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  padding: 12px 14px;
  background: var(--bg-soft);
  border-radius: var(--r-lg);
  border: 1px solid var(--line);
}
.shift-info-item {
  display: grid;
  gap: 2px;
}
.shift-info-item strong { font-size: 13px; }

/* Kalkulasi otomatis */
.calc-summary {
  background: var(--bg-soft);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  padding: 14px;
}
.calc-rows { display: grid; gap: 6px; }
.calc-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--text-2);
}
.calc-row.positive strong { color: #16a34a; }
.calc-row.negative strong { color: #dc2626; }
.calc-row.total {
  border-top: 1px solid var(--line);
  padding-top: 6px;
  margin-top: 2px;
  font-weight: 700;
  color: var(--text);
}
.calc-row.total strong { font-size: 15px; color: var(--text); }

/* Riwayat */
.shift-history-list { display: grid; gap: 10px; }
.shift-row {
  padding: 14px;
  border: 1.5px solid var(--line);
  border-radius: var(--r-lg);
  background: var(--bg-soft);
  display: grid;
  gap: 10px;
}
.shift-row-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.shift-row-label { font-size: 14px; }
.shift-row-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}
.shift-stat { display: grid; gap: 2px; }
.shift-stat strong { font-size: 13px; }
</style>

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
const openCash = ref(0)
const closeCash = ref<number | null>(null)
const closeNotes = ref('')

const formatCurrency = (value: number | null | undefined) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`
const formatDateTime = (value?: string | null) => value ? new Date(value).toLocaleString('id-ID') : '-'

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
      opening_cash: Number(openCash.value || 0),
      status: 'open'
    })

    if (error) throw error
    successMessage.value = 'Shift berhasil dibuka.'
    openCash.value = 0
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
          <button class="btn btn-secondary" :disabled="loading" @click="load">{{ loading ? 'Memuat...' : 'Refresh' }}</button>
        </div>
      </div>
    </section>

    <div class="grid grid-4">
      <article class="kpi-card">
        <h3>Shift aktif</h3>
        <div class="value">{{ activeShift ? '1' : '0' }}</div>
        <div class="hint">Status outlet saat ini</div>
      </article>
      <article class="kpi-card">
        <h3>Total shift</h3>
        <div class="value">{{ totalShifts }}</div>
        <div class="hint">Riwayat 50 shift terakhir</div>
      </article>
      <article class="kpi-card">
        <h3>Shift ditutup</h3>
        <div class="value">{{ closedShifts }}</div>
        <div class="hint">Sudah direkonsiliasi</div>
      </article>
      <article class="kpi-card">
        <h3>Rata-rata selisih</h3>
        <div class="value">{{ formatCurrency(averageDifference) }}</div>
        <div class="hint">Total kas awal: {{ formatCurrency(totalOpeningCash) }}</div>
      </article>
    </div>

    <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div>
    <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>

    <div class="shift-panels">
      <section class="card stack">
        <div class="section-title" style="padding-bottom:14px;">
          <h2 style="margin:0; font-size:17px;">Shift aktif</h2>
        </div>

        <div v-if="activeShift" class="stack">
          <article class="management-card">
            <div class="management-card-top">
              <div>
                <h3>Shift sedang berjalan</h3>
                <p class="management-card-description">Dibuka pada {{ formatDateTime(activeShift.opened_at) }}</p>
              </div>
              <span class="badge badge-soft">{{ activeShift.status }}</span>
            </div>

            <div class="management-card-stats detail-grid-2">
              <div>
                <span class="muted small">Kas awal</span>
                <strong>{{ formatCurrency(activeShift.opening_cash) }}</strong>
              </div>
              <div>
                <span class="muted small">Catatan</span>
                <strong>{{ activeShift.notes || '-' }}</strong>
              </div>
            </div>
          </article>

          <div class="stack" style="gap:8px;">
            <label class="field-label">Kas aktual saat tutup shift</label>
            <input v-model.number="closeCash" class="input" type="number" min="0" placeholder="Masukkan kas fisik yang dihitung" />
          </div>

          <div class="stack" style="gap:8px;">
            <label class="field-label">Catatan penutupan</label>
            <textarea v-model="closeNotes" class="textarea" placeholder="Catatan selisih, setor bank, kas kurang, atau informasi lain"></textarea>
          </div>

          <div class="toolbar form-actions-row">
            <button class="btn btn-danger" :disabled="closing" @click="closeShift">{{ closing ? 'Menutup shift...' : 'Tutup shift' }}</button>
          </div>
        </div>

        <div v-else class="stack">
          <div class="empty-state">Belum ada shift yang sedang berjalan.</div>
          <div class="stack" style="gap:8px;">
            <label class="field-label">Kas awal</label>
            <input v-model.number="openCash" class="input" type="number" min="0" placeholder="Contoh: 100000" />
          </div>
          <div class="toolbar form-actions-row">
            <button class="btn btn-primary" :disabled="opening" @click="openShift">{{ opening ? 'Membuka shift...' : 'Buka shift baru' }}</button>
          </div>
        </div>
      </section>

      <section class="card stack">
        <div class="section-title" style="padding-bottom:14px;">
          <h2 style="margin:0; font-size:17px;">Riwayat shift</h2>
        </div>

        <div v-if="loading" class="empty-state">Memuat shift...</div>
        <div v-else-if="!shifts.length" class="empty-state">Belum ada data shift.</div>

        <template v-else>
          <div class="table-wrap desktop-table-only">
            <table class="table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Dibuka</th>
                  <th>Ditutup</th>
                  <th>Kas awal</th>
                  <th>Kas ekspektasi</th>
                  <th>Kas aktual</th>
                  <th>Selisih</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="shift in shifts" :key="shift.id">
                  <td><span class="badge" :class="shift.status === 'open' ? 'badge-soft' : 'badge-success'">{{ shift.status }}</span></td>
                  <td>{{ formatDateTime(shift.opened_at) }}</td>
                  <td>{{ formatDateTime(shift.closed_at) }}</td>
                  <td>{{ formatCurrency(shift.opening_cash) }}</td>
                  <td>{{ formatCurrency(shift.expected_cash) }}</td>
                  <td>{{ formatCurrency(shift.actual_cash) }}</td>
                  <td>{{ formatCurrency(shift.cash_difference) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="management-card-list mobile-card-only">
            <article v-for="shift in shifts" :key="shift.id" class="management-card compact-card">
              <div class="management-card-top">
                <div>
                  <h3>{{ shift.status === 'open' ? 'Shift aktif' : 'Shift selesai' }}</h3>
                  <p class="management-card-description">Dibuka {{ formatDateTime(shift.opened_at) }}</p>
                </div>
                <span class="badge" :class="shift.status === 'open' ? 'badge-soft' : 'badge-success'">{{ shift.status }}</span>
              </div>

              <div class="management-card-stats detail-grid-2">
                <div>
                  <span class="muted small">Kas awal</span>
                  <strong>{{ formatCurrency(shift.opening_cash) }}</strong>
                </div>
                <div>
                  <span class="muted small">Kas ekspektasi</span>
                  <strong>{{ formatCurrency(shift.expected_cash) }}</strong>
                </div>
                <div>
                  <span class="muted small">Kas aktual</span>
                  <strong>{{ formatCurrency(shift.actual_cash) }}</strong>
                </div>
                <div>
                  <span class="muted small">Selisih</span>
                  <strong>{{ formatCurrency(shift.cash_difference) }}</strong>
                </div>
              </div>

              <div class="stack" style="gap:6px;">
                <span class="muted small">Ditutup</span>
                <strong>{{ formatDateTime(shift.closed_at) }}</strong>
                <span class="muted small">Catatan: {{ shift.notes || '-' }}</span>
              </div>
            </article>
          </div>
        </template>
      </section>
    </div>
  </div>
</template>

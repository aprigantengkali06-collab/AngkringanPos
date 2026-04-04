<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const supabase = useSupabaseClient()
const workspace = useWorkspace()

const loading = ref(false)
const opening = ref(false)
const closing = ref(false)
const shifts = ref<any[]>([])
const activeShift = ref<any | null>(null)
const errorMessage = ref('')
const successMessage = ref('')
const openCash = ref(0)
const closeCash = ref<number | null>(null)
const closeNotes = ref('')

const formatCurrency = (value: number) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`

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
    shifts.value = data || []
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

const closeShift = async () => {
  if (!activeShift.value) return
  closing.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const { data, error } = await supabase.functions.invoke('close-shift', {
      body: {
        shift_id: activeShift.value.id,
        actual_cash: Number(closeCash.value || 0),
        notes: closeNotes.value.trim() || null
      }
    })

    if (error) throw error
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
    <section class="section-title">
      <div>
        <h1 class="title">Shift Kasir</h1>
        <p class="subtitle">Buka shift dengan kas awal, lalu tutup shift menggunakan hitungan aktual agar selisih kas bisa diketahui.</p>
      </div>
    </section>

    <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div>
    <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>

    <div class="grid grid-2">
      <section class="card stack">
        <div>
          <h2 style="margin:0">Shift aktif</h2>
          <p class="subtitle">Jika belum ada shift, buka dulu sebelum transaksi ramai berjalan.</p>
        </div>

        <div v-if="activeShift" class="stack">
          <div class="kpi-card"><h3>Kas awal</h3><div class="value">{{ formatCurrency(activeShift.opening_cash) }}</div><div class="hint">Dibuka pada {{ new Date(activeShift.opened_at).toLocaleString('id-ID') }}</div></div>
          <div class="stack" style="gap:8px;"><label class="field-label">Kas aktual saat tutup shift</label><input v-model.number="closeCash" class="input" type="number" min="0" /></div>
          <div class="stack" style="gap:8px;"><label class="field-label">Catatan penutupan</label><textarea v-model="closeNotes" class="textarea" placeholder="Catatan selisih, setor bank, dll."></textarea></div>
          <button class="btn btn-danger" :disabled="closing" @click="closeShift">{{ closing ? 'Menutup shift...' : 'Tutup shift' }}</button>
        </div>

        <div v-else class="stack">
          <div class="empty-state">Belum ada shift yang sedang berjalan.</div>
          <div class="stack" style="gap:8px;"><label class="field-label">Kas awal</label><input v-model.number="openCash" class="input" type="number" min="0" /></div>
          <button class="btn btn-primary" :disabled="opening" @click="openShift">{{ opening ? 'Membuka shift...' : 'Buka shift baru' }}</button>
        </div>
      </section>

      <section class="card stack">
        <div>
          <h2 style="margin:0">Riwayat shift</h2>
          <p class="subtitle">50 shift terakhir outlet aktif.</p>
        </div>

        <div v-if="loading" class="empty-state">Memuat shift...</div>
        <div v-else-if="!shifts.length" class="empty-state">Belum ada data shift.</div>
        <div v-else class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Dibuka</th>
                <th>Kas awal</th>
                <th>Kas ekspektasi</th>
                <th>Kas aktual</th>
                <th>Selisih</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="shift in shifts" :key="shift.id">
                <td><span class="badge" :class="shift.status === 'open' ? 'badge-soft' : 'badge-success'">{{ shift.status }}</span></td>
                <td>{{ new Date(shift.opened_at).toLocaleString('id-ID') }}</td>
                <td>{{ formatCurrency(shift.opening_cash) }}</td>
                <td>{{ formatCurrency(shift.expected_cash || 0) }}</td>
                <td>{{ formatCurrency(shift.actual_cash || 0) }}</td>
                <td>{{ formatCurrency(shift.cash_difference || 0) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>
</template>

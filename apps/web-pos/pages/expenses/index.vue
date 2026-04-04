<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const supabase = useSupabaseClient()
const workspace = useWorkspace()

const loading = ref(false)
const saving = ref(false)
const expenses = ref<any[]>([])
const errorMessage = ref('')
const form = reactive({
  category: 'Operasional',
  description: '',
  amount: 0,
  spent_at: new Date().toISOString().slice(0, 16)
})

const formatCurrency = (value: number) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`

const load = async () => {
  if (!workspace.activeOutletId.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    const { data, error } = await supabase
      .from('expenses')
      .select('id, category, description, amount, spent_at, approval_status, created_at')
      .eq('outlet_id', workspace.activeOutletId.value)
      .order('spent_at', { ascending: false })
      .limit(100)

    if (error) throw error
    expenses.value = data || []
  } catch (error: any) {
    errorMessage.value = error?.message || 'Gagal memuat pengeluaran.'
  } finally {
    loading.value = false
  }
}

const save = async () => {
  if (!workspace.activeOutletId.value || !workspace.profile.value?.id) return
  saving.value = true
  errorMessage.value = ''
  try {
    const { error } = await supabase.from('expenses').insert({
      outlet_id: workspace.activeOutletId.value,
      category: form.category.trim() || 'Operasional',
      description: form.description.trim(),
      amount: Number(form.amount || 0),
      spent_at: form.spent_at ? new Date(form.spent_at).toISOString() : new Date().toISOString(),
      created_by: workspace.profile.value.id,
      approval_status: 'approved'
    })

    if (error) throw error

    Object.assign(form, {
      category: 'Operasional',
      description: '',
      amount: 0,
      spent_at: new Date().toISOString().slice(0, 16)
    })
    await load()
  } catch (error: any) {
    errorMessage.value = error?.message || 'Gagal menyimpan pengeluaran.'
  } finally {
    saving.value = false
  }
}

const remove = async (id: string) => {
  if (!confirm('Hapus pengeluaran ini?')) return
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (!error) await load()
}

const totalExpense = computed(() => expenses.value.reduce((sum, item) => sum + Number(item.amount || 0), 0))

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
        <h1 class="title">Pengeluaran Operasional</h1>
        <p class="subtitle">Catat belanja harian, kebutuhan stok, transport, dan biaya taktis lain agar kas harian tetap presisi.</p>
      </div>
      <div class="chip-group">
        <span class="chip active">{{ expenses.length }} catatan</span>
        <span class="chip">{{ formatCurrency(totalExpense) }} total pengeluaran</span>
      </div>
    </section>

    <div class="grid grid-2">
      <section class="card stack">
        <div>
          <h2 style="margin:0">Tambah pengeluaran</h2>
          <p class="subtitle">Form ringkas supaya staf bisa input cepat tanpa membingungkan.</p>
        </div>

        <div class="form-grid-2">
          <div class="stack" style="gap:8px;"><label class="field-label">Kategori</label><input v-model="form.category" class="input" placeholder="Contoh: Belanja dapur" /></div>
          <div class="stack" style="gap:8px;"><label class="field-label">Nominal</label><input v-model.number="form.amount" class="input" type="number" min="0" /></div>
        </div>

        <div class="stack" style="gap:8px;"><label class="field-label">Deskripsi</label><textarea v-model="form.description" class="textarea" placeholder="Jelaskan kebutuhan atau tujuan pengeluaran"></textarea></div>
        <div class="stack" style="gap:8px;"><label class="field-label">Waktu pengeluaran</label><input v-model="form.spent_at" class="input" type="datetime-local" /></div>

        <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? 'Menyimpan...' : 'Simpan pengeluaran' }}</button>
        <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>
      </section>

      <section class="card stack">
        <div>
          <h2 style="margin:0">Daftar pengeluaran terbaru</h2>
          <p class="subtitle">Seluruh catatan keluar masuk kas outlet yang sama.</p>
        </div>

        <div v-if="loading" class="empty-state">Memuat pengeluaran...</div>
        <div v-else-if="!expenses.length" class="empty-state">Belum ada data pengeluaran.</div>
        <div v-else class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Kategori</th>
                <th>Deskripsi</th>
                <th>Waktu</th>
                <th>Nominal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in expenses" :key="item.id">
                <td><strong>{{ item.category }}</strong></td>
                <td>{{ item.description }}</td>
                <td>{{ new Date(item.spent_at).toLocaleString('id-ID') }}</td>
                <td><strong>{{ formatCurrency(item.amount) }}</strong></td>
                <td><button class="btn btn-danger" @click="remove(item.id)">Hapus</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>
</template>

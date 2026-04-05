<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const supabase = useSupabaseClient()
const workspace = useWorkspace()

type ApprovalFilter = 'all' | 'approved' | 'pending' | 'rejected'

interface ExpenseRow {
  id: string
  category: string
  description: string
  amount: number
  spent_at: string
  approval_status: ApprovalFilter
  created_at: string
}

const loading = ref(false)
const saving = ref(false)
const expenses = ref<ExpenseRow[]>([])
const errorMessage = ref('')
const successMessage = ref('')
const search = ref('')
const approvalFilter = ref<ApprovalFilter>('all')

const form = reactive({
  category: 'Operasional',
  description: '',
  amount: 0,
  spent_at: new Date().toISOString().slice(0, 16)
})

const formatCurrency = (value: number) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`
const formatDateTime = (value?: string | null) => value ? new Date(value).toLocaleString('id-ID') : '-'

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
    expenses.value = (data || []) as ExpenseRow[]
  } catch (error: any) {
    errorMessage.value = error?.message || 'Gagal memuat pengeluaran.'
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  Object.assign(form, {
    category: 'Operasional',
    description: '',
    amount: 0,
    spent_at: new Date().toISOString().slice(0, 16)
  })
}

const save = async () => {
  if (!workspace.activeOutletId.value || !workspace.profile.value?.id) return
  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''

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

    resetForm()
    successMessage.value = 'Pengeluaran berhasil disimpan.'
    await load()
  } catch (error: any) {
    errorMessage.value = error?.message || 'Gagal menyimpan pengeluaran.'
  } finally {
    saving.value = false
  }
}

const remove = async (id: string) => {
  if (!confirm('Hapus pengeluaran ini?')) return

  try {
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) throw error

    successMessage.value = 'Pengeluaran berhasil dihapus.'
    await load()
  } catch (error: any) {
    errorMessage.value = error?.message || 'Gagal menghapus pengeluaran.'
  }
}

const totalExpense = computed(() => expenses.value.reduce((sum, item) => sum + Number(item.amount || 0), 0))
const approvedCount = computed(() => expenses.value.filter((item) => item.approval_status === 'approved').length)
const categoryCount = computed(() => new Set(expenses.value.map((item) => item.category).filter(Boolean)).size)
const todayExpense = computed(() => {
  const today = new Date().toDateString()
  return expenses.value
    .filter((item) => new Date(item.spent_at).toDateString() === today)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0)
})

const filteredExpenses = computed(() => {
  const keyword = search.value.trim().toLowerCase()

  return expenses.value.filter((item) => {
    const matchesSearch = !keyword || [
      item.category,
      item.description,
      item.approval_status
    ].join(' ').toLowerCase().includes(keyword)

    const matchesApproval = approvalFilter.value === 'all' || item.approval_status === approvalFilter.value
    return matchesSearch && matchesApproval
  })
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
    <section class="section-title">
      <div>
        <h1 class="title">Pengeluaran Operasional</h1>
        <p class="subtitle">Catat belanja harian, kebutuhan stok, transport, dan biaya taktis lain agar kas harian tetap presisi dan nyaman dipakai dari HP.</p>
      </div>
      <div class="toolbar page-header-actions">
        <button class="btn btn-secondary" :disabled="loading" @click="load">{{ loading ? 'Memuat...' : 'Refresh' }}</button>
      </div>
    </section>

    <div class="grid grid-4">
      <article class="kpi-card">
        <h3>Total catatan</h3>
        <div class="value">{{ expenses.length }}</div>
        <div class="hint">100 pengeluaran terakhir outlet aktif</div>
      </article>
      <article class="kpi-card">
        <h3>Total nominal</h3>
        <div class="value">{{ formatCurrency(totalExpense) }}</div>
        <div class="hint">Akumulasi semua pengeluaran yang tampil</div>
      </article>
      <article class="kpi-card">
        <h3>Hari ini</h3>
        <div class="value">{{ formatCurrency(todayExpense) }}</div>
        <div class="hint">Belanja yang tercatat di tanggal hari ini</div>
      </article>
      <article class="kpi-card">
        <h3>Kategori aktif</h3>
        <div class="value">{{ categoryCount }}</div>
        <div class="hint">Approved: {{ approvedCount }} catatan</div>
      </article>
    </div>

    <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div>
    <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>

    <div class="grid grid-2">
      <section class="card stack">
        <div>
          <h2 style="margin:0">Tambah pengeluaran</h2>
          <p class="subtitle">Form tetap ringkas, tapi tombol dan susunan field dibuat lebih enak dipakai di layar kecil.</p>
        </div>

        <div class="form-grid-2">
          <div class="stack" style="gap:8px;">
            <label class="field-label">Kategori</label>
            <input v-model="form.category" class="input" placeholder="Contoh: Belanja dapur" />
          </div>
          <div class="stack" style="gap:8px;">
            <label class="field-label">Nominal</label>
            <input v-model.number="form.amount" class="input" type="number" min="0" placeholder="50000" />
          </div>
        </div>

        <div class="stack" style="gap:8px;">
          <label class="field-label">Deskripsi</label>
          <textarea v-model="form.description" class="textarea" placeholder="Jelaskan kebutuhan atau tujuan pengeluaran"></textarea>
        </div>

        <div class="stack" style="gap:8px;">
          <label class="field-label">Waktu pengeluaran</label>
          <input v-model="form.spent_at" class="input" type="datetime-local" />
        </div>

        <div class="toolbar form-actions-row">
          <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? 'Menyimpan...' : 'Simpan pengeluaran' }}</button>
          <button class="btn btn-secondary" :disabled="saving" @click="resetForm">Reset form</button>
        </div>
      </section>

      <section class="card stack">
        <div>
          <h2 style="margin:0">Daftar pengeluaran terbaru</h2>
          <p class="subtitle">Tampilan tabel tetap ada untuk desktop, ditambah kartu khusus mobile supaya tidak perlu scroll horizontal terus.</p>
        </div>

        <div class="catalogue-toolbar">
          <div class="search-field-wrap">
            <span class="search-icon">⌕</span>
            <input v-model="search" class="input search-field" placeholder="Cari kategori, deskripsi, atau status..." />
          </div>

          <div class="chip-group product-filter-group">
            <button class="chip" :class="{ active: approvalFilter === 'all' }" @click="approvalFilter = 'all'">Semua</button>
            <button class="chip" :class="{ active: approvalFilter === 'approved' }" @click="approvalFilter = 'approved'">Approved</button>
            <button class="chip" :class="{ active: approvalFilter === 'pending' }" @click="approvalFilter = 'pending'">Pending</button>
            <button class="chip" :class="{ active: approvalFilter === 'rejected' }" @click="approvalFilter = 'rejected'">Rejected</button>
          </div>
        </div>

        <div v-if="loading" class="empty-state">Memuat pengeluaran...</div>
        <div v-else-if="!filteredExpenses.length" class="empty-state">Belum ada data pengeluaran yang cocok dengan filter saat ini.</div>

        <template v-else>
          <div class="table-wrap desktop-table-only">
            <table class="table">
              <thead>
                <tr>
                  <th>Kategori</th>
                  <th>Deskripsi</th>
                  <th>Waktu</th>
                  <th>Status</th>
                  <th>Nominal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in filteredExpenses" :key="item.id">
                  <td><strong>{{ item.category }}</strong></td>
                  <td>{{ item.description }}</td>
                  <td>{{ formatDateTime(item.spent_at) }}</td>
                  <td>
                    <span class="badge" :class="item.approval_status === 'approved' ? 'badge-success' : item.approval_status === 'pending' ? 'badge-soft' : 'badge-danger'">
                      {{ item.approval_status }}
                    </span>
                  </td>
                  <td><strong>{{ formatCurrency(item.amount) }}</strong></td>
                  <td><button class="btn btn-danger" @click="remove(item.id)">Hapus</button></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="management-card-list mobile-card-only">
            <article v-for="item in filteredExpenses" :key="item.id" class="management-card compact-card">
              <div class="management-card-top">
                <div>
                  <h3>{{ item.category }}</h3>
                  <p class="management-card-description">{{ item.description }}</p>
                </div>
                <span class="badge" :class="item.approval_status === 'approved' ? 'badge-success' : item.approval_status === 'pending' ? 'badge-soft' : 'badge-danger'">
                  {{ item.approval_status }}
                </span>
              </div>

              <div class="management-card-stats detail-grid-2">
                <div>
                  <span class="muted small">Waktu</span>
                  <strong>{{ formatDateTime(item.spent_at) }}</strong>
                </div>
                <div>
                  <span class="muted small">Nominal</span>
                  <strong>{{ formatCurrency(item.amount) }}</strong>
                </div>
              </div>

              <div class="toolbar form-actions-row">
                <button class="btn btn-danger" @click="remove(item.id)">Hapus catatan</button>
              </div>
            </article>
          </div>
        </template>
      </section>
    </div>
  </div>
</template>

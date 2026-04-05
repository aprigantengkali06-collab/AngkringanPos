<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const supabase = useSupabaseClient()
const workspace = useWorkspace()

type StatusFilter = 'all' | 'active' | 'inactive'

interface CategoryRow {
  id: string
  name: string
  sort_order: number
  is_active: boolean
  created_at: string
}

const loading = ref(false)
const saving = ref(false)
const categories = ref<CategoryRow[]>([])
const showForm = ref(false)
const editTarget = ref<CategoryRow | null>(null)
const formName = ref('')
const formSort = ref(0)
const formActive = ref(true)
const errorMessage = ref('')
const successMessage = ref('')
const search = ref('')
const statusFilter = ref<StatusFilter>('all')

const load = async () => {
  if (!workspace.activeOutletId.value) return
  loading.value = true
  errorMessage.value = ''

  try {
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, sort_order, is_active, created_at')
      .eq('outlet_id', workspace.activeOutletId.value)
      .order('sort_order')

    if (error) throw error
    categories.value = (data || []) as CategoryRow[]
  } catch (error: any) {
    errorMessage.value = error?.message || 'Gagal memuat kategori.'
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  editTarget.value = null
  formName.value = ''
  formSort.value = categories.value.length + 1
  formActive.value = true
  showForm.value = false
}

const openAdd = () => {
  editTarget.value = null
  formName.value = ''
  formSort.value = categories.value.length + 1
  formActive.value = true
  showForm.value = true
}

const openEdit = (row: CategoryRow) => {
  editTarget.value = row
  formName.value = row.name
  formSort.value = row.sort_order
  formActive.value = row.is_active
  showForm.value = true
}

const save = async () => {
  if (!workspace.activeOutletId.value || !formName.value.trim()) return
  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const payload = {
      name: formName.value.trim(),
      sort_order: Number(formSort.value || 0),
      is_active: formActive.value
    }

    if (editTarget.value) {
      const { error } = await supabase.from('categories').update(payload).eq('id', editTarget.value.id)
      if (error) throw error
      successMessage.value = 'Kategori berhasil diperbarui.'
    } else {
      const { error } = await supabase.from('categories').insert({ ...payload, outlet_id: workspace.activeOutletId.value })
      if (error) throw error
      successMessage.value = 'Kategori berhasil ditambahkan.'
    }

    resetForm()
    await load()
  } catch (error: any) {
    errorMessage.value = error?.message || 'Gagal menyimpan kategori.'
  } finally {
    saving.value = false
  }
}

const remove = async (id: string) => {
  if (!confirm('Hapus kategori ini?')) return

  try {
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) throw error

    successMessage.value = 'Kategori berhasil dihapus.'
    await load()
  } catch (error: any) {
    errorMessage.value = error?.message || 'Gagal menghapus kategori.'
  }
}

const activeCount = computed(() => categories.value.filter((item) => item.is_active).length)
const inactiveCount = computed(() => categories.value.filter((item) => !item.is_active).length)

const filteredCategories = computed(() => {
  const keyword = search.value.trim().toLowerCase()

  return categories.value.filter((item) => {
    const matchesSearch = !keyword || item.name.toLowerCase().includes(keyword)
    const matchesStatus = statusFilter.value === 'all'
      || (statusFilter.value === 'active' && item.is_active)
      || (statusFilter.value === 'inactive' && !item.is_active)

    return matchesSearch && matchesStatus
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
    <section class="page-hero">
      <div class="page-hero-top">
        <div>
          <p class="eyebrow">Manajemen</p>
          <h1 class="page-hero-title">Kategori Menu</h1>
        </div>
        <div class="toolbar page-header-actions">
          <button class="btn btn-secondary" :disabled="loading" @click="load">{{ loading ? 'Memuat...' : 'Refresh' }}</button>
          <button class="btn btn-primary" @click="openAdd">Tambah kategori</button>
        </div>
      </div>
    </section>

    <div class="grid grid-3">
      <article class="kpi-card">
        <h3>Total kategori</h3>
        <div class="value">{{ categories.length }}</div>
        <div class="hint">Seluruh kategori outlet aktif</div>
      </article>
      <article class="kpi-card">
        <h3>Kategori aktif</h3>
        <div class="value">{{ activeCount }}</div>
        <div class="hint">Siap dipakai untuk menu</div>
      </article>
      <article class="kpi-card">
        <h3>Nonaktif</h3>
        <div class="value">{{ inactiveCount }}</div>
        <div class="hint">Perlu ditinjau ulang jika tidak dipakai</div>
      </article>
    </div>

    <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div>
    <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>

    <section class="card stack">
      <div class="catalogue-toolbar">
        <div class="search-field-wrap">
          <span class="search-icon">⌕</span>
          <input v-model="search" class="input search-field" placeholder="Cari nama kategori..." />
        </div>

        <div class="chip-group product-filter-group">
          <button class="chip" :class="{ active: statusFilter === 'all' }" @click="statusFilter = 'all'">Semua</button>
          <button class="chip" :class="{ active: statusFilter === 'active' }" @click="statusFilter = 'active'">Aktif</button>
          <button class="chip" :class="{ active: statusFilter === 'inactive' }" @click="statusFilter = 'inactive'">Nonaktif</button>
        </div>
      </div>

      <div v-if="showForm" class="inline-editor-card stack">
        <div class="section-title">
          <div>
            <h2 style="margin:0">{{ editTarget ? 'Edit kategori' : 'Tambah kategori' }}</h2>
            <p class="subtitle">Form editor dibuat inline supaya lebih nyaman dipakai dari HP tanpa modal yang sempit.</p>
          </div>
          <button class="btn btn-secondary" @click="resetForm">Tutup</button>
        </div>

        <div class="form-grid-2">
          <div class="stack" style="gap:8px;">
            <label class="field-label">Nama kategori</label>
            <input v-model="formName" class="input" placeholder="Contoh: Minuman hangat" />
          </div>
          <div class="stack" style="gap:8px;">
            <label class="field-label">Urutan tampil</label>
            <input v-model.number="formSort" class="input" type="number" min="0" placeholder="1" />
          </div>
        </div>

        <label class="toggle-field">
          <input v-model="formActive" type="checkbox" />
          <span>Kategori aktif</span>
        </label>

        <div class="toolbar form-actions-row">
          <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? 'Menyimpan...' : 'Simpan kategori' }}</button>
          <button class="btn btn-secondary" :disabled="saving" @click="resetForm">Batal</button>
        </div>
      </div>

      <div v-if="loading" class="empty-state">Memuat kategori...</div>
      <div v-else-if="!filteredCategories.length" class="empty-state">Belum ada kategori yang cocok dengan filter saat ini.</div>

      <template v-else>
        <div class="table-wrap desktop-table-only">
          <table class="table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Urutan</th>
                <th>Status</th>
                <th>Dibuat</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in filteredCategories" :key="row.id">
                <td><strong>{{ row.name }}</strong></td>
                <td>{{ row.sort_order }}</td>
                <td><span class="badge" :class="row.is_active ? 'badge-success' : 'badge-danger'">{{ row.is_active ? 'Aktif' : 'Nonaktif' }}</span></td>
                <td>{{ new Date(row.created_at).toLocaleDateString('id-ID') }}</td>
                <td>
                  <div class="toolbar form-actions-row">
                    <button class="btn btn-secondary" @click="openEdit(row)">Edit</button>
                    <button class="btn btn-danger" @click="remove(row.id)">Hapus</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="management-card-list mobile-card-only">
          <article v-for="row in filteredCategories" :key="row.id" class="management-card compact-card">
            <div class="management-card-top">
              <div>
                <h3>{{ row.name }}</h3>
                <p class="management-card-description">Urutan tampil {{ row.sort_order }} · dibuat {{ new Date(row.created_at).toLocaleDateString('id-ID') }}</p>
              </div>
              <span class="badge" :class="row.is_active ? 'badge-success' : 'badge-danger'">{{ row.is_active ? 'Aktif' : 'Nonaktif' }}</span>
            </div>

            <div class="toolbar form-actions-row">
              <button class="btn btn-secondary" @click="openEdit(row)">Edit</button>
              <button class="btn btn-danger" @click="remove(row.id)">Hapus</button>
            </div>
          </article>
        </div>
      </template>
    </section>
  </div>
</template>

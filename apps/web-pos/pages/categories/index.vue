<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const supabase = useSupabaseClient()
const workspace = useWorkspace()

const loading = ref(false)
const saving = ref(false)
const categories = ref<any[]>([])
const showForm = ref(false)
const editTarget = ref<any | null>(null)
const formName = ref('')
const formSort = ref(0)
const formActive = ref(true)
const errorMessage = ref('')

const load = async () => {
  if (!workspace.activeOutletId.value) return
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, sort_order, is_active, created_at')
      .eq('outlet_id', workspace.activeOutletId.value)
      .order('sort_order')

    if (error) throw error
    categories.value = data || []
  } catch (error: any) {
    errorMessage.value = error?.message || 'Gagal memuat kategori.'
  } finally {
    loading.value = false
  }
}

const openAdd = () => {
  editTarget.value = null
  formName.value = ''
  formSort.value = categories.value.length + 1
  formActive.value = true
  showForm.value = true
}

const openEdit = (row: any) => {
  editTarget.value = row
  formName.value = row.name
  formSort.value = row.sort_order
  formActive.value = row.is_active
  showForm.value = true
}

const save = async () => {
  if (!workspace.activeOutletId.value || !formName.value.trim()) return
  saving.value = true
  try {
    const payload = { name: formName.value.trim(), sort_order: formSort.value, is_active: formActive.value }

    if (editTarget.value) {
      const { error } = await supabase.from('categories').update(payload).eq('id', editTarget.value.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('categories').insert({ ...payload, outlet_id: workspace.activeOutletId.value })
      if (error) throw error
    }

    showForm.value = false
    await load()
  } catch (error: any) {
    errorMessage.value = error?.message || 'Gagal menyimpan kategori.'
  } finally {
    saving.value = false
  }
}

const remove = async (id: string) => {
  if (!confirm('Hapus kategori ini?')) return
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (!error) await load()
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
        <h1 class="title">Kategori Menu</h1>
        <p class="subtitle">Atur kelompok produk agar kasir cepat mencari menu dan laporan lebih rapi.</p>
      </div>
      <button class="btn btn-primary" @click="openAdd">Tambah kategori</button>
    </section>

    <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>
    <div v-if="loading" class="empty-state">Memuat kategori...</div>

    <section v-else class="card stack">
      <div v-if="!categories.length" class="empty-state">Belum ada kategori untuk outlet ini.</div>
      <div v-else class="table-wrap">
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
            <tr v-for="row in categories" :key="row.id">
              <td><strong>{{ row.name }}</strong></td>
              <td>{{ row.sort_order }}</td>
              <td><span class="badge" :class="row.is_active ? 'badge-success' : 'badge-danger'">{{ row.is_active ? 'Aktif' : 'Nonaktif' }}</span></td>
              <td>{{ new Date(row.created_at).toLocaleDateString('id-ID') }}</td>
              <td>
                <div class="toolbar">
                  <button class="btn btn-secondary" @click="openEdit(row)">Edit</button>
                  <button class="btn btn-danger" @click="remove(row.id)">Hapus</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div v-if="showForm" class="modal-backdrop" @click="showForm = false">
      <div class="modal-card stack" @click.stop>
        <div class="section-title">
          <div>
            <h2 style="margin:0">{{ editTarget ? 'Edit kategori' : 'Tambah kategori' }}</h2>
            <p class="subtitle">Kategori aktif otomatis tampil di halaman produk dan kasir.</p>
          </div>
          <button class="btn btn-secondary" @click="showForm = false">Tutup</button>
        </div>

        <div class="form-grid-2">
          <div class="stack" style="gap:8px;"><label class="field-label">Nama kategori</label><input v-model="formName" class="input" /></div>
          <div class="stack" style="gap:8px;"><label class="field-label">Urutan tampil</label><input v-model.number="formSort" class="input" type="number" min="0" /></div>
        </div>
        <label style="display:flex;align-items:center;gap:10px;font-weight:700;"><input v-model="formActive" type="checkbox" /> Kategori aktif</label>
        <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? 'Menyimpan...' : 'Simpan kategori' }}</button>
      </div>
    </div>
  </div>
</template>

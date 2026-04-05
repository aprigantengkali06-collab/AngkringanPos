<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const supabase = useSupabaseClient()
const workspace = useWorkspace()

const loading = ref(false)
const saving = ref(false)
const products = ref<any[]>([])
const categories = ref<any[]>([])
const errorMessage = ref('')
const successMessage = ref('')
const showForm = ref(false)
const editingProduct = ref<any | null>(null)

const form = ref({
  name: '',
  price: 0,
  category_id: '',
  description: '',
  is_available: true
})

const resetForm = () => {
  form.value = { name: '', price: 0, category_id: '', description: '', is_available: true }
  editingProduct.value = null
  showForm.value = false
}

const formatCurrency = (value: number) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`

const load = async () => {
  if (!workspace.activeOutletId.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    const [prodRes, catRes] = await Promise.all([
      supabase.from('products')
        .select('*')
        .eq('outlet_id', workspace.activeOutletId.value)
        .order('name'),
      supabase.from('categories')
        .select('*')
        .eq('outlet_id', workspace.activeOutletId.value)
        .order('name')
    ])
    if (prodRes.error) throw prodRes.error
    if (catRes.error) throw catRes.error
    products.value = prodRes.data || []
    categories.value = catRes.data || []
  } catch (e: any) {
    errorMessage.value = e?.message || 'Gagal memuat produk.'
  } finally {
    loading.value = false
  }
}

const openAdd = () => {
  resetForm()
  showForm.value = true
}

const openEdit = (product: any) => {
  editingProduct.value = product
  form.value = {
    name: product.name,
    price: product.price,
    category_id: product.category_id || '',
    description: product.description || '',
    is_available: product.is_available
  }
  showForm.value = true
}

const saveProduct = async () => {
  if (!form.value.name || !workspace.activeOutletId.value) return
  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const payload: any = {
      name: form.value.name,
      price: Number(form.value.price || 0),
      description: form.value.description || null,
      category_id: form.value.category_id || null,
      is_available: form.value.is_available,
      outlet_id: workspace.activeOutletId.value
    }

    if (editingProduct.value) {
      const { error } = await supabase.from('products').update(payload).eq('id', editingProduct.value.id)
      if (error) throw error
      successMessage.value = 'Produk berhasil diperbarui.'
    } else {
      const { error } = await supabase.from('products').insert(payload)
      if (error) throw error
      successMessage.value = 'Produk berhasil ditambahkan.'
    }
    resetForm()
    await load()
  } catch (e: any) {
    errorMessage.value = e?.message || 'Gagal menyimpan produk.'
  } finally {
    saving.value = false
  }
}

const deleteProduct = async (id: string) => {
  if (!confirm('Hapus produk ini?')) return
  try {
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) throw error
    successMessage.value = 'Produk dihapus.'
    await load()
  } catch (e: any) {
    errorMessage.value = e?.message || 'Gagal menghapus produk.'
  }
}

const toggleAvailable = async (product: any) => {
  try {
    const { error } = await supabase.from('products')
      .update({ is_available: !product.is_available })
      .eq('id', product.id)
    if (error) throw error
    product.is_available = !product.is_available
  } catch (e: any) {
    errorMessage.value = e?.message
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
        <h1 class="title">Kelola Produk</h1>
        <p class="subtitle">Tambah, edit, dan atur ketersediaan produk menu outlet Anda.</p>
      </div>
      <button class="btn btn-primary" @click="openAdd">+ Tambah Produk</button>
    </section>

    <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div>
    <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>

    <!-- Form tambah/edit -->
    <div v-if="showForm" class="card stack" style="margin-bottom:1rem;">
      <h2 style="margin:0">{{ editingProduct ? 'Edit Produk' : 'Tambah Produk Baru' }}</h2>
      <div class="stack" style="gap:8px;">
        <label class="field-label">Nama Produk *</label>
        <input v-model="form.name" class="input" placeholder="Contoh: Nasi Goreng" />
      </div>
      <div class="stack" style="gap:8px;">
        <label class="field-label">Harga (Rp) *</label>
        <input v-model.number="form.price" class="input" type="number" min="0" placeholder="15000" />
      </div>
      <div class="stack" style="gap:8px;">
        <label class="field-label">Kategori</label>
        <select v-model="form.category_id" class="input">
          <option value="">-- Tanpa Kategori --</option>
          <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
        </select>
      </div>
      <div class="stack" style="gap:8px;">
        <label class="field-label">Deskripsi</label>
        <input v-model="form.description" class="input" placeholder="Opsional" />
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <input v-model="form.is_available" type="checkbox" id="is_available" />
        <label for="is_available" class="field-label" style="margin:0">Tersedia</label>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-primary" :disabled="saving" @click="saveProduct">
          {{ saving ? 'Menyimpan...' : 'Simpan' }}
        </button>
        <button class="btn btn-secondary" @click="resetForm">Batal</button>
      </div>
    </div>

    <!-- Daftar produk -->
    <div class="card">
      <div v-if="loading" class="empty-state">Memuat produk...</div>
      <div v-else-if="!products.length" class="empty-state">
        Belum ada produk. Tap "+ Tambah Produk" untuk mulai.
      </div>
      <div v-else class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Harga</th>
              <th>Kategori</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="product in products" :key="product.id">
              <td>{{ product.name }}</td>
              <td>{{ formatCurrency(product.price) }}</td>
              <td>{{ categories.find(c => c.id === product.category_id)?.name || '-' }}</td>
              <td>
                <span
                  class="badge"
                  :class="product.is_available ? 'badge-success' : 'badge-soft'"
                  style="cursor:pointer"
                  @click="toggleAvailable(product)"
                >
                  {{ product.is_available ? 'Tersedia' : 'Habis' }}
                </span>
              </td>
              <td>
                <div style="display:flex;gap:4px;">
                  <button class="btn btn-secondary" style="padding:4px 8px;font-size:12px" @click="openEdit(product)">Edit</button>
                  <button class="btn btn-danger" style="padding:4px 8px;font-size:12px" @click="deleteProduct(product.id)">Hapus</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

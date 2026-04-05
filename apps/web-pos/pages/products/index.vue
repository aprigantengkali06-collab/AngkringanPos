<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const supabase = useSupabaseClient()
const workspace = useWorkspace()

type StatusFilter = 'all' | 'available' | 'unavailable'

interface CategoryRow {
  id: string
  name: string
}

interface MenuRow {
  id: string
  name: string
  price: number
  cost_price: number
  category_id: string | null
  description: string | null
  is_available: boolean
  categories?: { name: string } | { name: string }[] | null
}

const loading = ref(false)
const saving = ref(false)
const menus = ref<MenuRow[]>([])
const categories = ref<CategoryRow[]>([])
const errorMessage = ref('')
const successMessage = ref('')
const showForm = ref(false)
const editingMenu = ref<MenuRow | null>(null)
const search = ref('')
const statusFilter = ref<StatusFilter>('all')

const form = ref({
  name: '',
  price: 0,
  cost_price: 0,
  category_id: '',
  description: '',
  is_available: true
})

const formatCurrency = (value: number) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`

const getCategoryName = (menu: MenuRow) => {
  const categoryValue = Array.isArray(menu.categories) ? menu.categories[0] : menu.categories
  return categoryValue?.name || categories.value.find((item) => item.id === menu.category_id)?.name || 'Tanpa kategori'
}

const resetForm = () => {
  form.value = {
    name: '',
    price: 0,
    cost_price: 0,
    category_id: '',
    description: '',
    is_available: true
  }
  editingMenu.value = null
  showForm.value = false
}

const totalMenus = computed(() => menus.value.length)
const availableMenus = computed(() => menus.value.filter((item) => item.is_available).length)
const unavailableMenus = computed(() => menus.value.filter((item) => !item.is_available).length)

const filteredMenus = computed(() => {
  const keyword = search.value.trim().toLowerCase()

  return menus.value.filter((menu) => {
    const matchesSearch = !keyword || [
      menu.name,
      menu.description || '',
      getCategoryName(menu)
    ].join(' ').toLowerCase().includes(keyword)

    const matchesStatus = statusFilter.value === 'all'
      || (statusFilter.value === 'available' && menu.is_available)
      || (statusFilter.value === 'unavailable' && !menu.is_available)

    return matchesSearch && matchesStatus
  })
})

const load = async () => {
  if (!workspace.activeOutletId.value) return
  loading.value = true
  errorMessage.value = ''

  try {
    const [menuRes, catRes] = await Promise.all([
      supabase
        .from('menus')
        .select('id, name, price, cost_price, category_id, description, is_available, categories(name)')
        .eq('outlet_id', workspace.activeOutletId.value)
        .order('name'),
      supabase
        .from('categories')
        .select('id, name')
        .eq('outlet_id', workspace.activeOutletId.value)
        .order('name')
    ])

    if (menuRes.error) throw menuRes.error
    if (catRes.error) throw catRes.error

    menus.value = (menuRes.data || []) as MenuRow[]
    categories.value = (catRes.data || []) as CategoryRow[]
  } catch (error: any) {
    errorMessage.value = error?.message || 'Gagal memuat daftar menu.'
  } finally {
    loading.value = false
  }
}

const openAdd = () => {
  resetForm()
  showForm.value = true
}

const openEdit = (menu: MenuRow) => {
  editingMenu.value = menu
  form.value = {
    name: menu.name,
    price: Number(menu.price || 0),
    cost_price: Number(menu.cost_price || 0),
    category_id: menu.category_id || '',
    description: menu.description || '',
    is_available: menu.is_available
  }
  showForm.value = true
}

const saveMenu = async () => {
  if (!workspace.activeOutletId.value || !form.value.name.trim()) return
  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const payload = {
      outlet_id: workspace.activeOutletId.value,
      name: form.value.name.trim(),
      price: Number(form.value.price || 0),
      cost_price: Number(form.value.cost_price || 0),
      category_id: form.value.category_id || null,
      description: form.value.description.trim() || null,
      is_available: form.value.is_available
    }

    if (editingMenu.value) {
      const { error } = await supabase
        .from('menus')
        .update(payload)
        .eq('id', editingMenu.value.id)

      if (error) throw error
      successMessage.value = 'Menu berhasil diperbarui.'
    } else {
      const { error } = await supabase.from('menus').insert(payload)
      if (error) throw error
      successMessage.value = 'Menu berhasil ditambahkan.'
    }

    resetForm()
    await load()
  } catch (error: any) {
    errorMessage.value = error?.message || 'Gagal menyimpan menu.'
  } finally {
    saving.value = false
  }
}

const deleteMenu = async (id: string) => {
  if (!confirm('Hapus menu ini?')) return

  try {
    const { error } = await supabase.from('menus').delete().eq('id', id)
    if (error) throw error

    successMessage.value = 'Menu berhasil dihapus.'
    await load()
  } catch (error: any) {
    errorMessage.value = error?.message || 'Gagal menghapus menu.'
  }
}

const toggleAvailable = async (menu: MenuRow) => {
  try {
    const nextValue = !menu.is_available
    const { error } = await supabase
      .from('menus')
      .update({ is_available: nextValue })
      .eq('id', menu.id)

    if (error) throw error

    menu.is_available = nextValue
    successMessage.value = nextValue ? 'Menu diaktifkan kembali.' : 'Menu ditandai habis.'
  } catch (error: any) {
    errorMessage.value = error?.message || 'Gagal mengubah status menu.'
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
        <p class="subtitle">Manajemen menu sekarang langsung terhubung ke tabel <strong>menus</strong> Supabase agar data kasir, laporan, dan stok tampil sinkron.</p>
      </div>
      <div class="toolbar page-header-actions">
        <button class="btn btn-secondary" @click="load">Refresh</button>
        <button class="btn btn-primary" @click="openAdd">+ Tambah Menu</button>
      </div>
    </section>

    <div class="grid grid-3">
      <article class="kpi-card">
        <h3>Total menu</h3>
        <div class="value">{{ totalMenus }}</div>
        <div class="hint">Seluruh item yang terdaftar di outlet aktif</div>
      </article>
      <article class="kpi-card">
        <h3>Tersedia</h3>
        <div class="value">{{ availableMenus }}</div>
        <div class="hint">Menu siap dijual di kasir</div>
      </article>
      <article class="kpi-card">
        <h3>Habis / nonaktif</h3>
        <div class="value">{{ unavailableMenus }}</div>
        <div class="hint">Perlu dicek ulang sebelum jam sibuk</div>
      </article>
    </div>

    <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div>
    <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>

    <section class="card stack">
      <div class="catalogue-toolbar">
        <div class="search-field-wrap">
          <span class="search-icon">⌕</span>
          <input v-model="search" class="input search-field" placeholder="Cari nama menu, kategori, atau deskripsi..." />
        </div>

        <div class="chip-group product-filter-group">
          <button class="chip" :class="{ active: statusFilter === 'all' }" @click="statusFilter = 'all'">Semua</button>
          <button class="chip" :class="{ active: statusFilter === 'available' }" @click="statusFilter = 'available'">Tersedia</button>
          <button class="chip" :class="{ active: statusFilter === 'unavailable' }" @click="statusFilter = 'unavailable'">Habis</button>
        </div>
      </div>

      <div v-if="showForm" class="inline-editor-card stack">
        <div class="section-title">
          <div>
            <h2 style="margin:0">{{ editingMenu ? 'Edit menu' : 'Tambah menu baru' }}</h2>
            <p class="subtitle">Struktur field disesuaikan dengan schema database yang aktif, tanpa mengubah alur bisnis kasir.</p>
          </div>
          <button class="btn btn-secondary" @click="resetForm">Tutup</button>
        </div>

        <div class="form-grid-2">
          <div class="stack" style="gap:8px;">
            <label class="field-label">Nama menu *</label>
            <input v-model="form.name" class="input" placeholder="Contoh: Teh Tarik" />
          </div>
          <div class="stack" style="gap:8px;">
            <label class="field-label">Kategori</label>
            <select v-model="form.category_id" class="select">
              <option value="">Tanpa kategori</option>
              <option v-for="category in categories" :key="category.id" :value="category.id">{{ category.name }}</option>
            </select>
          </div>
        </div>

        <div class="form-grid-2">
          <div class="stack" style="gap:8px;">
            <label class="field-label">Harga jual *</label>
            <input v-model.number="form.price" class="input" type="number" min="0" placeholder="15000" />
          </div>
          <div class="stack" style="gap:8px;">
            <label class="field-label">Harga modal</label>
            <input v-model.number="form.cost_price" class="input" type="number" min="0" placeholder="7000" />
          </div>
        </div>

        <div class="stack" style="gap:8px;">
          <label class="field-label">Deskripsi</label>
          <textarea v-model="form.description" class="textarea" placeholder="Tambahkan catatan singkat untuk tim kasir atau dapur"></textarea>
        </div>

        <label class="toggle-field">
          <input v-model="form.is_available" type="checkbox" />
          <span>Menu tersedia untuk dijual</span>
        </label>

        <div class="toolbar form-actions-row">
          <button class="btn btn-primary" :disabled="saving" @click="saveMenu">
            {{ saving ? 'Menyimpan...' : editingMenu ? 'Simpan perubahan' : 'Simpan menu' }}
          </button>
          <button class="btn btn-secondary" @click="resetForm">Batal</button>
        </div>
      </div>

      <div v-if="loading" class="empty-state">Memuat daftar menu...</div>
      <div v-else-if="!filteredMenus.length" class="empty-state">Belum ada menu yang cocok dengan filter saat ini.</div>

      <div v-else class="management-card-list">
        <article v-for="menu in filteredMenus" :key="menu.id" class="management-card">
          <div class="management-card-top">
            <div>
              <h3>{{ menu.name }}</h3>
              <p class="muted small">{{ getCategoryName(menu) }} · Modal {{ formatCurrency(menu.cost_price) }}</p>
            </div>
            <span class="badge" :class="menu.is_available ? 'badge-success' : 'badge-danger'">
              {{ menu.is_available ? 'Tersedia' : 'Habis' }}
            </span>
          </div>

          <p class="management-card-description">{{ menu.description || 'Belum ada deskripsi menu.' }}</p>

          <div class="management-card-stats">
            <div>
              <span class="muted small">Harga jual</span>
              <strong>{{ formatCurrency(menu.price) }}</strong>
            </div>
            <div>
              <span class="muted small">Harga modal</span>
              <strong>{{ formatCurrency(menu.cost_price) }}</strong>
            </div>
          </div>

          <div class="toolbar form-actions-row">
            <button class="btn btn-secondary" @click="openEdit(menu)">Edit</button>
            <button class="btn btn-dark" @click="toggleAvailable(menu)">
              {{ menu.is_available ? 'Tandai habis' : 'Aktifkan' }}
            </button>
            <button class="btn btn-danger" @click="deleteMenu(menu.id)">Hapus</button>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

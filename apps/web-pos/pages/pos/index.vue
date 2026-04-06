<script setup lang="ts">
import { orderService } from '~/services/order.service'

definePageMeta({ middleware: ['auth'] })

const supabase = useSupabaseClient()
const workspace = useWorkspace()

interface MenuRow {
  id: string
  name: string
  description: string | null
  price: number
  cost_price: number
  category_id: string | null
  categories?: { name: string } | { name: string }[] | null
}

interface CartRow {
  id: string
  name: string
  price: number
  cost_price: number
  qty: number
  notes: string
}

const orderTypeOptions = [
  { value: 'dine_in', label: 'Dine in' },
  { value: 'takeaway', label: 'Bawa pulang' },
  { value: 'online', label: 'Pesan antar' }
] as const

const paymentOptions = [
  { value: 'cash', label: 'Tunai' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'qris', label: 'QRIS' }
] as const

const menus = ref<MenuRow[]>([])
const loading = ref(false)
const submitting = ref(false)
const submittingOpen = ref(false)
const search = ref('')
const selectedCategory = ref('Semua')
const customerName = ref('')
const paymentMethod = ref<'cash' | 'transfer' | 'qris'>('cash')
const orderType = ref<'dine_in' | 'takeaway' | 'online'>('dine_in')
const paidAmount = ref<number | null>(null)
const notes = ref('')
const cart = ref<CartRow[]>([])
const recentOrders = ref<any[]>([])
const errorMessage = ref('')
const showCartSheet = ref(false)
const showSuccessSheet = ref(false)
const lastOrder = ref<any | null>(null)
const viewMode = ref<'list' | 'grid'>('list')

const formatCurrency = (value: number) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`
const shortId = (id: string) => `#${(id || '').slice(-8).toUpperCase()}`

const normalizeCategoryName = (menu: MenuRow) => {
  const categoryValue = Array.isArray(menu.categories) ? menu.categories[0] : menu.categories
  return categoryValue?.name || 'Tanpa kategori'
}

const getInitials = (value: string) => value
  .split(' ')
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0])
  .join('')
  .toUpperCase()

const categoryOptions = computed(() => {
  const set = new Set<string>()
  menus.value.forEach((menu) => set.add(normalizeCategoryName(menu)))
  return ['Semua', ...Array.from(set)]
})

const filteredMenus = computed(() => {
  return menus.value.filter((menu) => {
    const bySearch = [menu.name, menu.description || '', normalizeCategoryName(menu)]
      .join(' ')
      .toLowerCase()
      .includes(search.value.toLowerCase())

    const byCategory = selectedCategory.value === 'Semua' || normalizeCategoryName(menu) === selectedCategory.value
    return bySearch && byCategory
  })
})

const subtotal = computed(() => cart.value.reduce((sum, item) => sum + (item.qty * item.price), 0))
const totalQty = computed(() => cart.value.reduce((sum, item) => sum + item.qty, 0))
const effectivePaid = computed(() => paidAmount.value == null || Number.isNaN(paidAmount.value) ? subtotal.value : Number(paidAmount.value))
const changeAmount = computed(() => Math.max(0, effectivePaid.value - subtotal.value))
const insufficientPayment = computed(() => paymentMethod.value === 'cash' && effectivePaid.value < subtotal.value)
const canSubmit = computed(() => Boolean(workspace.activeOutletId.value) && cart.value.length > 0 && !insufficientPayment.value)

const todaySales = computed(() => {
  const today = new Date().toISOString().slice(0, 10)
  return recentOrders.value.filter((order) => String(order.paid_at || order.created_at || '').slice(0, 10) === today)
})
const todayRevenue = computed(() => todaySales.value.reduce((sum, order) => sum + Number(order.total || 0), 0))

const loadMenus = async () => {
  if (!workspace.activeOutletId.value) return
  loading.value = true
  errorMessage.value = ''

  try {
    const { data, error } = await supabase
      .from('menus')
      .select('id, name, description, price, cost_price, category_id, categories(name)')
      .eq('outlet_id', workspace.activeOutletId.value)
      .eq('is_available', true)
      .order('name')

    if (error) throw error
    menus.value = (data || []) as MenuRow[]
  } catch (error: any) {
    errorMessage.value = error?.message || 'Gagal memuat menu outlet.'
  } finally {
    loading.value = false
  }
}

const loadRecentOrders = async () => {
  if (!workspace.activeOutletId.value) return
  try {
    recentOrders.value = await orderService.listLatest(workspace.activeOutletId.value, 8)
  } catch {
    // Recent orders gagal tidak perlu blok UI
  }
}

const addMenu = (menu: MenuRow) => {
  errorMessage.value = ''
  const existing = cart.value.find((item) => item.id === menu.id && !item.notes)
  if (existing) {
    existing.qty += 1
  } else {
    cart.value.push({
      id: menu.id,
      name: menu.name,
      price: Number(menu.price || 0),
      cost_price: Number(menu.cost_price || 0),
      qty: 1,
      notes: ''
    })
  }
}

const changeQty = (index: number, diff: number) => {
  const item = cart.value[index]
  if (!item) return
  item.qty += diff
  if (item.qty <= 0) cart.value.splice(index, 1)
}

const removeItem = (index: number) => {
  cart.value.splice(index, 1)
}

const applyQuickCash = (mode: 'exact' | number) => {
  if (mode === 'exact') {
    paidAmount.value = subtotal.value
    return
  }

  const base = Math.max(subtotal.value, Number(paidAmount.value || 0))
  paidAmount.value = base + mode
}

const resetForm = () => {
  cart.value = []
  customerName.value = ''
  paymentMethod.value = 'cash'
  orderType.value = 'dine_in'
  paidAmount.value = null
  notes.value = ''
  showCartSheet.value = false
}

const startNewOrder = () => {
  resetForm()
  showSuccessSheet.value = false
  lastOrder.value = null
}

const submitOrder = async () => {
  if (!canSubmit.value || !workspace.activeOutletId.value) return

  try {
    submitting.value = true
    errorMessage.value = ''

    const payload = {
      outlet_id: workspace.activeOutletId.value,
      customer_name: customerName.value.trim() || null,
      payment_method: paymentMethod.value,
      order_type: orderType.value,
      paid_amount: effectivePaid.value,
      notes: notes.value.trim() || null,
      items: cart.value.map((item) => ({
        menu_id: item.id,
        item_name: item.name,
        qty: item.qty,
        unit_price: item.price,
        cost_price: item.cost_price,
        subtotal: item.qty * item.price,
        notes: item.notes?.trim() || null
      }))
    }

    const result = await orderService.createOrder(payload)
    lastOrder.value = {
      ...result,
      payment_method: paymentMethod.value,
      customer_name: customerName.value || 'Umum'
    }
    showSuccessSheet.value = true
    resetForm()
    await loadRecentOrders()
  } catch (error: any) {
    errorMessage.value = error?.message || 'Gagal membuat transaksi.'
    showCartSheet.value = true
  } finally {
    submitting.value = false
  }
}


const saveOpenOrder = async () => {
  if (!workspace.activeOutletId.value || cart.value.length === 0) return
  if (!customerName.value.trim()) {
    errorMessage.value = 'Isi nama pelanggan dulu untuk bayar nanti.'
    showCartSheet.value = true
    return
  }
  try {
    submittingOpen.value = true
    errorMessage.value = ''
    const { data, error } = await supabase.rpc('save_open_order_pos', {
      payload: {
        outlet_id: workspace.activeOutletId.value,
        customer_name: customerName.value.trim(),
        order_type: orderType.value,
        notes: notes.value.trim() || null,
        items: cart.value.map((item) => ({
          menu_id: item.id,
          item_name: item.name,
          qty: item.qty,
          unit_price: item.price,
          cost_price: item.cost_price,
          notes: item.notes?.trim() || null
        }))
      }
    })
    if (error) throw error
    if (data?.ok === false) throw new Error(data.error)
    resetForm()
    await navigateTo('/tagihan')
  } catch (e: any) {
    errorMessage.value = e?.message || 'Gagal menyimpan tagihan.'
    showCartSheet.value = true
  } finally {
    submittingOpen.value = false
  }
}

onMounted(async () => {
  await workspace.bootstrap()
  await Promise.all([loadMenus(), loadRecentOrders()])
})

watch(() => workspace.activeOutletId.value, async (value, oldValue) => {
  if (!value || value === oldValue) return
  resetForm()
  await Promise.all([loadMenus(), loadRecentOrders()])
})
</script>

<template>
  <div class="page page-pos">
    <section class="pos-hero card glass">
      <div>
        <p class="eyebrow">Kasir mobile-first</p>
        <h1 class="title">Kasir</h1>
        <p class="subtitle">Tampilan dipadatkan untuk HP: pilih produk cepat, lihat keranjang jelas, lalu bayar tanpa bolak-balik layar.</p>
      </div>

      <div class="pos-summary-grid">
        <article class="summary-chip-card active">
          <span class="summary-label">Keranjang</span>
          <strong>{{ totalQty }} item</strong>
        </article>
        <article class="summary-chip-card">
          <span class="summary-label">Omzet hari ini</span>
          <strong>{{ formatCurrency(todayRevenue) }}</strong>
        </article>
        <article class="summary-chip-card">
          <span class="summary-label">Transaksi hari ini</span>
          <strong>{{ todaySales.length }}</strong>
        </article>
      </div>
    </section>

    <div v-if="errorMessage && !showCartSheet" class="alert alert-danger">{{ errorMessage }}</div>

    <div class="pos-layout">
      <section class="card stack pos-catalogue-card">
        <div class="catalogue-toolbar">
          <div class="search-field-wrap">
            <span class="search-icon">⌕</span>
            <input v-model="search" class="input search-field" placeholder="Cari menu, kategori, atau deskripsi..." />
          </div>

          <!-- Toggle List / Grid -->
          <div class="view-toggle">
            <button
              class="view-toggle-btn"
              :class="{ active: viewMode === 'list' }"
              @click="viewMode = 'list'"
              title="Tampilan list"
            >
              ☰
            </button>
            <button
              class="view-toggle-btn"
              :class="{ active: viewMode === 'grid' }"
              @click="viewMode = 'grid'"
              title="Tampilan grid"
            >
              ⊞
            </button>
          </div>

          <button class="btn btn-secondary" @click="loadMenus">Refresh menu</button>
        </div>

        <div class="category-scroll">
          <button
            v-for="category in categoryOptions"
            :key="category"
            class="chip"
            :class="{ active: selectedCategory === category }"
            @click="selectedCategory = category"
          >
            {{ category }}
          </button>
        </div>

        <div v-if="loading" class="empty-state">Memuat menu outlet...</div>
        <div v-else-if="!filteredMenus.length" class="empty-state">Menu tidak ditemukan. Coba kata kunci atau kategori lain.</div>

        <!-- LIST VIEW -->
        <div v-else-if="viewMode === 'list'" class="product-list product-list-spaced">
          <article v-for="menu in filteredMenus" :key="menu.id" class="product-row product-row-card">
            <div class="product-avatar">{{ getInitials(menu.name) }}</div>

            <div class="product-main">
              <div class="product-topline">
                <h3>{{ menu.name }}</h3>
                <strong class="product-price">{{ formatCurrency(menu.price) }}</strong>
              </div>

              <div class="product-tags-row">
                <span class="catalogue-badge">{{ normalizeCategoryName(menu) }}</span>
                <span class="modal-badge">Modal {{ formatCurrency(menu.cost_price) }}</span>
                <span v-if="!menu.description" class="siap-badge">✓ Siap dijual</span>
              </div>

              <p v-if="menu.description" class="product-description">{{ menu.description }}</p>
            </div>

            <button class="btn btn-primary product-action" @click="addMenu(menu)">Tambah</button>
          </article>
        </div>

        <!-- GRID VIEW -->
        <div v-else class="product-grid">
          <article v-for="menu in filteredMenus" :key="menu.id" class="product-grid-card" @click="addMenu(menu)">
            <div class="product-grid-avatar">{{ getInitials(menu.name) }}</div>
            <div class="product-grid-body">
              <h3 class="product-grid-name">{{ menu.name }}</h3>
              <span class="catalogue-badge catalogue-badge-sm">{{ normalizeCategoryName(menu) }}</span>
              <div class="product-grid-footer">
                <strong class="product-price-grid">{{ formatCurrency(menu.price) }}</strong>
                <span class="modal-badge-sm">Modal {{ formatCurrency(menu.cost_price) }}</span>
              </div>
            </div>
            <button class="btn btn-primary btn-grid-add" @click.stop="addMenu(menu)">+ Tambah</button>
          </article>
        </div>
      </section>

      <section class="card stack pos-order-panel" :class="{ open: showCartSheet }">
        <div class="mobile-order-handle mobile-only" />

        <div class="section-title">
          <div>
            <h2 style="margin: 0">Detail Pesanan</h2>
            <p class="subtitle">Pelanggan, tipe order, pembayaran, lalu simpan transaksi.</p>
          </div>
          <button class="btn btn-secondary mobile-only" @click="showCartSheet = false">Tutup</button>
        </div>

        <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>

        <div class="stack" style="gap: 10px;">
          <label class="field-label">Pelanggan</label>
          <input v-model="customerName" class="input" placeholder="Nama pelanggan (opsional)" />
        </div>

        <div class="stack" style="gap: 10px;">
          <label class="field-label">Tipe pesanan</label>
          <div class="segmented-row">
            <button
              v-for="type in orderTypeOptions"
              :key="type.value"
              class="segment-button"
              :class="{ active: orderType === type.value }"
              @click="orderType = type.value"
            >
              {{ type.label }}
            </button>
          </div>
        </div>

        <div class="stack" style="gap: 10px;">
          <label class="field-label">Metode pembayaran</label>
          <div class="segmented-row">
            <button
              v-for="method in paymentOptions"
              :key="method.value"
              class="segment-button"
              :class="{ active: paymentMethod === method.value }"
              @click="paymentMethod = method.value"
            >
              {{ method.label }}
            </button>
          </div>
        </div>

        <div v-if="!cart.length" class="empty-state">Belum ada item. Tambahkan produk dari daftar di atas.</div>

        <div v-else class="order-item-list">
          <article v-for="(item, index) in cart" :key="`${item.id}-${index}`" class="order-item-card">
            <div class="order-item-line">
              <div class="qty-pill">{{ item.qty }}</div>
              <div class="order-item-info">
                <strong>{{ item.name }}</strong>
                <p class="muted small">{{ formatCurrency(item.price) }} / item</p>
              </div>
              <strong>{{ formatCurrency(item.qty * item.price) }}</strong>
            </div>

            <div class="order-item-actions">
              <div class="qty-stepper">
                <button @click="changeQty(index, -1)">-</button>
                <span>{{ item.qty }}</span>
                <button @click="changeQty(index, 1)">+</button>
              </div>
              <button class="btn btn-secondary" @click="removeItem(index)">Hapus</button>
            </div>

            <input v-model="item.notes" class="input" placeholder="Catatan item, mis. tanpa gula / pedas" />
          </article>
        </div>

        <div class="stack" style="gap: 10px;">
          <label class="field-label">Catatan transaksi</label>
          <textarea v-model="notes" class="textarea" placeholder="Contoh: meja 10, pelanggan langganan, paket keluarga"></textarea>
        </div>

        <div class="stack" style="gap: 10px;">
          <label class="field-label">Uang diterima</label>
          <input
            v-model.number="paidAmount"
            class="input amount-input"
            type="number"
            min="0"
            :placeholder="paymentMethod === 'cash' ? 'Masukkan uang diterima' : String(subtotal)"
          />

          <div v-if="paymentMethod === 'cash'" class="quick-cash-row">
            <button class="btn btn-secondary" @click="applyQuickCash('exact')">Uang pas</button>
            <button class="btn btn-secondary" @click="applyQuickCash(5000)">+5.000</button>
            <button class="btn btn-secondary" @click="applyQuickCash(10000)">+10.000</button>
            <button class="btn btn-secondary" @click="applyQuickCash(20000)">+20.000</button>
          </div>
        </div>

        <div class="summary-list order-summary-list">
          <div class="summary-row"><span class="muted">Subtotal</span><strong>{{ formatCurrency(subtotal) }}</strong></div>
          <div class="summary-row"><span class="muted">Dibayar</span><strong>{{ formatCurrency(effectivePaid) }}</strong></div>
          <div class="summary-row"><span class="muted">Kembalian</span><strong>{{ formatCurrency(changeAmount) }}</strong></div>
          <div class="summary-row total"><span>Total</span><span>{{ formatCurrency(subtotal) }}</span></div>
        </div>

        <div v-if="insufficientPayment" class="alert alert-warning">
          Nominal tunai masih kurang. Minimal harus sama dengan total tagihan.
        </div>

        <div class="order-footer-actions">
          <button class="btn btn-secondary" @click="resetForm">Reset</button>
          <button
            class="btn btn-outline-secondary"
            :disabled="submittingOpen || cart.length === 0"
            @click="saveOpenOrder"
            title="Simpan tagihan, bayar nanti"
          >
            {{ submittingOpen ? 'Menyimpan...' : 'Bayar nanti' }}
          </button>
          <button class="btn btn-dark btn-lg" :disabled="submitting || !canSubmit" @click="submitOrder">
            {{ submitting ? 'Menyimpan...' : `Bayar ${formatCurrency(subtotal)}` }}
          </button>
        </div>
      </section>
    </div>

    <section class="card stack recent-order-card">
      <div class="section-title">
        <div>
          <h2 style="margin: 0">Transaksi terbaru</h2>
          <p class="subtitle">Riwayat singkat untuk cek order yang baru masuk.</p>
        </div>
        <button class="btn btn-secondary" @click="loadRecentOrders">Refresh</button>
      </div>

      <div v-if="!recentOrders.length" class="empty-state">Belum ada transaksi terbaru pada outlet ini.</div>
      <div v-else class="recent-order-list">
        <article v-for="order in recentOrders" :key="order.id" class="recent-order-item">
          <div>
            <strong>{{ shortId(order.id) }}</strong>
            <p class="muted small">{{ order.customer_name || 'Umum' }} · {{ order.payment_method }} · {{ new Date(order.created_at).toLocaleString('id-ID') }}</p>
          </div>
          <strong>{{ formatCurrency(order.total) }}</strong>
        </article>
      </div>
    </section>

    <div v-if="cart.length" class="mobile-cart-bar mobile-only">
      <button class="mobile-cart-button" @click="showCartSheet = true">
        <span>{{ totalQty }} item</span>
        <strong>Bayar {{ formatCurrency(subtotal) }}</strong>
      </button>
    </div>

    <div v-if="showCartSheet" class="mobile-sheet-backdrop mobile-only" @click="showCartSheet = false" />

    <div v-if="showSuccessSheet && lastOrder" class="modal-backdrop" @click="showSuccessSheet = false">
      <div class="modal-card success-state-card" @click.stop>
        <div class="success-mark">✓</div>
        <h2>Transaksi Sukses!</h2>
        <p class="subtitle">Transaksi berhasil disimpan.</p>

        <div class="success-pills">
          <span class="chip active">Metode: {{ lastOrder.payment_method }}</span>
          <span class="chip">Pelanggan: {{ lastOrder.customer_name }}</span>
        </div>

        <div class="success-summary">
          <div class="summary-row"><span>Total</span><strong>{{ formatCurrency(lastOrder.total || 0) }}</strong></div>
          <div class="summary-row"><span>Kembalian</span><strong>{{ formatCurrency(lastOrder.change_amount || 0) }}</strong></div>
        </div>

        <div class="success-actions">
          <button class="btn btn-secondary" @click="showSuccessSheet = false">Tutup</button>
          <button class="btn btn-dark" @click="startNewOrder">Buat pesanan baru</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* === JARAK ANTAR CARD LIST === */
.product-list-spaced {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.product-row-card {
  background: #fff;
  border: 1px solid #eee;
  border-radius: 14px;
  padding: 14px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

/* === TAGS ROW: Kategori · Modal · Siap dijual === */
.product-tags-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}

.modal-badge {
  font-size: 11px;
  color: #666;
  background: #f5f5f5;
  border-radius: 20px;
  padding: 2px 8px;
}

.siap-badge {
  font-size: 11px;
  color: #16a34a;
  background: #f0fdf4;
  border-radius: 20px;
  padding: 2px 8px;
  font-weight: 500;
}

/* === VIEW TOGGLE === */
.view-toggle {
  display: flex;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
}

.view-toggle-btn {
  background: #fff;
  border: none;
  padding: 6px 12px;
  font-size: 16px;
  cursor: pointer;
  color: #888;
  transition: all 0.15s;
}

.view-toggle-btn.active {
  background: #1a1a1a;
  color: #fff;
}

/* === GRID VIEW === */
.product-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.product-grid-card {
  background: #fff;
  border: 1px solid #eee;
  border-radius: 14px;
  padding: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  display: flex;
  flex-direction: column;
  gap: 8px;
  cursor: pointer;
  transition: box-shadow 0.15s;
}

.product-grid-card:active {
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
}

.product-grid-avatar {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: #fef3c7;
  color: #92400e;
  font-weight: 700;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.product-grid-name {
  font-size: 13px;
  font-weight: 700;
  margin: 0;
  line-height: 1.3;
}

.product-grid-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.catalogue-badge-sm {
  font-size: 10px;
  padding: 1px 6px;
}

.product-grid-footer {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 4px;
}

.product-price-grid {
  font-size: 14px;
  color: #d97706;
  font-weight: 700;
}

.modal-badge-sm {
  font-size: 10px;
  color: #888;
}

.btn-grid-add {
  width: 100%;
  padding: 8px;
  font-size: 12px;
  border-radius: 8px;
  margin-top: auto;
}
</style>

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

// Order detail modal
const selectedOrder = ref<any | null>(null)
const loadingDetail = ref(false)
const printingReceipt = ref(false)

const orderTypeLabel: Record<string, { label: string; icon: string; color: string }> = {
  dine_in:  { label: 'Dine In',      icon: '🍽️', color: '#2563eb' },
  takeaway: { label: 'Bawa Pulang',  icon: '🛍️', color: '#d97706' },
  online:   { label: 'Pesan Antar',  icon: '🛵', color: '#16a34a' }
}
const paymentLabel: Record<string, { label: string; icon: string }> = {
  cash:     { label: 'Tunai',    icon: '💵' },
  transfer: { label: 'Transfer', icon: '🏦' },
  qris:     { label: 'QRIS',     icon: '📲' }
}

const openOrderDetail = async (order: any) => {
  selectedOrder.value = { ...order, order_items: null }
  loadingDetail.value = true
  try {
    const detail = await orderService.getOrderDetails(order.id)
    // preserve payment_method from list if detail returns null
    selectedOrder.value = {
      ...detail,
      payment_method: detail.payment_method || order.payment_method
    }
  } catch {
    // keep basic data
  } finally {
    loadingDetail.value = false
  }
}

const closeOrderDetail = () => { selectedOrder.value = null }

const isOpenOrder = (order: any) => order?.status === 'open' || (!order?.payment_method && order?.status !== 'paid')

const payOrder = (order: any) => {
  closeOrderDetail()
  navigateTo(`/tagihan?pay=${order.id}`)
}


const printReceipt = async () => {
  if (!selectedOrder.value) return
  printingReceipt.value = true
  try {
    const { printerService } = await import('~/services/printer.service')
    await printerService.printReceipt({
      order_id: selectedOrder.value.id,
      outlet_id: workspace.activeOutletId.value
    })
  } catch (e: any) {
    alert(e?.message || 'Gagal mencetak struk. Pastikan printer terhubung.')
  } finally {
    printingReceipt.value = false
  }
}

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
    recentOrders.value = await orderService.listLatest(workspace.activeOutletId.value, 100)
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
          <h2 style="margin: 0">Transaksi hari ini</h2>
          <p class="subtitle">Riwayat singkat untuk cek order yang baru masuk.</p>
        </div>
        <button class="btn btn-secondary" @click="loadRecentOrders">Refresh</button>
      </div>

      <div v-if="!todaySales.length" class="empty-state">Belum ada transaksi hari ini.</div>
      <div v-else class="today-order-list">
        <button
          v-for="order in todaySales"
          :key="order.id"
          class="today-order-item"
          :class="{ 'today-order-unpaid': isOpenOrder(order) }"
          @click="openOrderDetail(order)"
        >
          <div class="today-order-left">
            <div class="today-order-id-row">
              <span class="today-order-id">{{ shortId(order.id) }}</span>
              <span v-if="isOpenOrder(order)" class="today-order-unpaid-badge">Belum Lunas</span>
            </div>
            <span class="today-order-meta">{{ order.customer_name || 'Umum' }} · {{ order.payment_method || 'open tab' }}</span>
          </div>
          <strong class="today-order-total">{{ formatCurrency(order.total) }}</strong>
        </button>
      </div>
    </section>

    <div v-if="cart.length" class="mobile-cart-bar mobile-only">
      <button class="mobile-cart-button" @click="showCartSheet = true">
        <span>{{ totalQty }} item</span>
        <strong>Bayar {{ formatCurrency(subtotal) }}</strong>
      </button>
    </div>

    <div v-if="showCartSheet" class="mobile-sheet-backdrop mobile-only" @click="showCartSheet = false" />

    <!-- Order Detail Modal -->
    <div v-if="selectedOrder" class="modal-backdrop" @click="closeOrderDetail">
      <div class="modal-card order-detail-modal" @click.stop>

        <!-- Header -->
        <div class="odm-header">
          <div class="odm-header-left">
            <span class="odm-eyebrow">Detail Transaksi</span>
            <h2 class="odm-id">{{ shortId(selectedOrder.id) }}</h2>
          </div>
          <button class="odm-close" @click="closeOrderDetail">✕</button>
        </div>

        <!-- Loading -->
        <div v-if="loadingDetail" class="odm-loading">
          <span class="odm-spinner"></span>
          <span class="muted small">Memuat detail...</span>
        </div>

        <template v-else>
          <!-- Meta grid -->
          <div class="odm-meta-grid">
            <!-- Pelanggan -->
            <div class="odm-meta-card">
              <span class="odm-meta-icon">👤</span>
              <div>
                <span class="odm-meta-label">Pelanggan</span>
                <strong class="odm-meta-value">{{ selectedOrder.customer_name || 'Umum' }}</strong>
              </div>
            </div>
            <!-- Metode -->
            <div class="odm-meta-card">
              <span class="odm-meta-icon">{{ paymentLabel[selectedOrder.payment_method]?.icon || '💳' }}</span>
              <div>
                <span class="odm-meta-label">Metode</span>
                <strong class="odm-meta-value">{{ paymentLabel[selectedOrder.payment_method]?.label || selectedOrder.payment_method || '-' }}</strong>
              </div>
            </div>
            <!-- Tipe -->
            <div class="odm-meta-card odm-type-card" :style="{ borderColor: orderTypeLabel[selectedOrder.order_type]?.color + '44' || '#e8e8e2', background: orderTypeLabel[selectedOrder.order_type]?.color + '0d' || 'var(--bg-soft)' }">
              <span class="odm-meta-icon">{{ orderTypeLabel[selectedOrder.order_type]?.icon || '📋' }}</span>
              <div>
                <span class="odm-meta-label">Tipe</span>
                <strong class="odm-meta-value" :style="{ color: orderTypeLabel[selectedOrder.order_type]?.color || 'var(--text)' }">
                  {{ orderTypeLabel[selectedOrder.order_type]?.label || selectedOrder.order_type || '-' }}
                </strong>
              </div>
            </div>
            <!-- Waktu -->
            <div class="odm-meta-card">
              <span class="odm-meta-icon">🕐</span>
              <div>
                <span class="odm-meta-label">Waktu</span>
                <strong class="odm-meta-value odm-time">{{ new Date(selectedOrder.paid_at || selectedOrder.created_at).toLocaleString('id-ID') }}</strong>
              </div>
            </div>
          </div>

          <!-- Items -->
          <div v-if="selectedOrder.order_items?.length" class="odm-items">
            <div class="odm-items-header">
              <span class="odm-eyebrow">Pesanan</span>
              <span class="odm-items-count">{{ selectedOrder.order_items.length }} item</span>
            </div>
            <div class="odm-item-list">
              <div v-for="item in selectedOrder.order_items" :key="item.id" class="odm-item-row">
                <div class="odm-item-qty-badge">{{ item.qty }}×</div>
                <span class="odm-item-name">{{ item.item_name }}</span>
                <span class="odm-item-price">{{ formatCurrency(item.subtotal || item.qty * item.unit_price) }}</span>
              </div>
            </div>
          </div>
          <div v-else class="odm-no-items muted small">Detail item tidak tersedia.</div>

          <!-- Summary -->
          <div class="odm-summary">
            <div class="odm-summary-row">
              <span>Subtotal</span>
              <span>{{ formatCurrency(selectedOrder.subtotal || selectedOrder.total) }}</span>
            </div>
            <div class="odm-summary-row">
              <span>Dibayar</span>
              <span>{{ formatCurrency(selectedOrder.paid_amount) }}</span>
            </div>
            <div class="odm-summary-divider"></div>
            <div class="odm-summary-row odm-summary-total">
              <span>Kembalian</span>
              <strong>{{ formatCurrency(selectedOrder.change_amount || 0) }}</strong>
            </div>
          </div>

          <!-- Notes -->
          <div v-if="selectedOrder.notes" class="odm-notes">
            <span class="odm-notes-icon">📝</span>
            <span>{{ selectedOrder.notes }}</span>
          </div>

          <!-- Actions -->
          <div class="odm-actions" :class="{ 'odm-actions-3': isOpenOrder(selectedOrder) }">
            <button class="btn btn-secondary" @click="closeOrderDetail">← Kembali</button>
            <button
              v-if="isOpenOrder(selectedOrder)"
              class="btn btn-primary"
              @click="payOrder(selectedOrder)"
            >
              💳 Bayar Pesanan
            </button>
            <button class="btn btn-dark" :disabled="printingReceipt" @click="printReceipt">
              <span v-if="printingReceipt">Mencetak...</span>
              <span v-else>🖨️ Cetak Struk</span>
            </button>
          </div>
        </template>
      </div>
    </div>

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

/* === TODAY ORDER LIST === */
/* === UNPAID BADGE & 3-COL ACTIONS === */
.today-order-id-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.today-order-unpaid-badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
  padding: 1px 7px;
  border-radius: 999px;
}

.today-order-unpaid {
  border-color: #fecaca !important;
  background: #fff5f5 !important;
}
.today-order-unpaid:hover {
  border-color: #dc2626 !important;
  background: #fee2e2 !important;
}

.odm-actions-3 {
  grid-template-columns: 1fr 1.2fr 1fr !important;
}

/* === UNPAID BADGE & 3-COL ACTIONS === */
.today-order-id-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.today-order-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.today-order-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1.5px solid var(--line);
  background: var(--card);
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: border-color 0.15s, background 0.15s;
  font: inherit;
}

.today-order-item:hover {
  border-color: var(--primary);
  background: var(--primary-light);
}

.today-order-item:active {
  background: #fde8cc;
}

.today-order-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.today-order-id {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
}

.today-order-meta {
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.today-order-total {
  font-size: 14px;
  font-weight: 800;
  color: var(--text);
  white-space: nowrap;
  flex-shrink: 0;
}

/* === ORDER DETAIL MODAL (ODM) === */
.order-detail-modal {
  max-width: 440px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 92dvh;
  overflow-y: auto;
  border-radius: 24px;
  padding: 24px;
}

.odm-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.odm-header-left { display: flex; flex-direction: column; gap: 2px; }

.odm-eyebrow {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--muted);
}

.odm-id {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0;
  color: var(--text);
}

.odm-close {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1.5px solid var(--line);
  background: var(--bg-soft);
  font-size: 14px;
  color: var(--muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;
}
.odm-close:hover { background: var(--danger-bg); color: var(--danger); border-color: var(--danger); }

.odm-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: center;
  padding: 24px 0;
  color: var(--muted);
}

.odm-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--line-strong);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: odm-spin 0.7s linear infinite;
  flex-shrink: 0;
}
@keyframes odm-spin { to { transform: rotate(360deg); } }

/* Meta grid */
.odm-meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.odm-meta-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 12px;
  border-radius: 14px;
  background: var(--bg-soft);
  border: 1.5px solid var(--line);
}

.odm-type-card {
  transition: background 0.2s, border-color 0.2s;
}

.odm-meta-icon {
  font-size: 20px;
  line-height: 1;
  flex-shrink: 0;
}

.odm-meta-label {
  display: block;
  font-size: 11px;
  color: var(--muted);
  font-weight: 600;
  margin-bottom: 2px;
}

.odm-meta-value {
  display: block;
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  line-height: 1.3;
}

.odm-time {
  font-size: 12px !important;
}

/* Items */
.odm-items {
  border-radius: 14px;
  border: 1.5px solid var(--line);
  overflow: hidden;
}

.odm-items-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: var(--bg-soft);
  border-bottom: 1px solid var(--line);
}

.odm-items-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  background: var(--line);
  padding: 2px 8px;
  border-radius: 999px;
}

.odm-item-list { display: flex; flex-direction: column; }

.odm-item-row {
  display: grid;
  grid-template-columns: 36px 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 11px 14px;
  border-bottom: 1px solid var(--line);
  font-size: 14px;
}
.odm-item-row:last-child { border-bottom: none; }

.odm-item-qty-badge {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: var(--primary-light);
  color: var(--primary-dark);
  font-size: 12px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.odm-item-name {
  font-weight: 600;
  color: var(--text);
}

.odm-item-price {
  font-weight: 700;
  color: var(--text);
  white-space: nowrap;
}

.odm-no-items {
  text-align: center;
  padding: 12px;
}

/* Summary */
.odm-summary {
  border-radius: 14px;
  border: 1.5px solid var(--line);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--bg-soft);
}

.odm-summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  color: var(--text-2);
}

.odm-summary-divider {
  height: 1px;
  background: var(--line);
  margin: 2px 0;
}

.odm-summary-total {
  font-size: 15px;
  color: var(--text);
}

.odm-summary-total strong {
  font-size: 18px;
  font-weight: 800;
  color: var(--primary-dark);
}

/* Notes */
.odm-notes {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  font-size: 13px;
  color: var(--text-2);
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--warning-bg);
  border: 1px solid #fde68a;
  line-height: 1.5;
}

.odm-notes-icon { flex-shrink: 0; }

/* Actions */
.odm-actions {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 10px;
}
</style>

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

const menus = ref<MenuRow[]>([])
const loading = ref(false)
const submitting = ref(false)
const search = ref('')
const selectedCategory = ref('Semua')
const customerName = ref('')
const paymentMethod = ref<'cash' | 'transfer' | 'qris'>('cash')
const orderType = ref<'dine_in' | 'takeaway' | 'online'>('dine_in')
const paidAmount = ref<number | null>(null)
const notes = ref('')
const cart = ref<CartRow[]>([])
const recentOrders = ref<any[]>([])
const successMessage = ref('')
const errorMessage = ref('')
const debugInfo = ref('')

const formatCurrency = (value: number) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`
const normalizeCategoryName = (menu: MenuRow) => {
  const categoryValue = Array.isArray(menu.categories) ? menu.categories[0] : menu.categories
  return categoryValue?.name || 'Tanpa kategori'
}

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
const canSubmit = computed(() => workspace.activeOutletId.value && cart.value.length > 0 && !insufficientPayment.value)

const todaySales = computed(() => {
  const today = new Date().toISOString().slice(0, 10)
  return recentOrders.value.filter((order) => String(order.paid_at || order.created_at || '').slice(0, 10) === today)
})
const todayRevenue = computed(() => todaySales.value.reduce((sum, order) => sum + Number(order.total || 0), 0))

const loadMenus = async () => {
  if (!workspace.activeOutletId.value) return
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('menus')
      .select('id, name, description, price, cost_price, category_id, categories(name)')
      .eq('outlet_id', workspace.activeOutletId.value)
      .eq('is_available', true)
      .order('name')

    if (error) throw error
    menus.value = (data || []) as MenuRow[]
  } finally {
    loading.value = false
  }
}

const loadRecentOrders = async () => {
  if (!workspace.activeOutletId.value) return
  recentOrders.value = await orderService.listLatest(workspace.activeOutletId.value, 12)
}

const addMenu = (menu: MenuRow) => {
  successMessage.value = ''
  errorMessage.value = ''
  const existing = cart.value.find((item) => item.id === menu.id && !item.notes)
  if (existing) {
    existing.qty += 1
    return
  }

  cart.value.unshift({
    id: menu.id,
    name: menu.name,
    price: Number(menu.price || 0),
    cost_price: Number(menu.cost_price || 0),
    qty: 1,
    notes: ''
  })
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

const resetForm = () => {
  cart.value = []
  customerName.value = ''
  paymentMethod.value = 'cash'
  orderType.value = 'dine_in'
  paidAmount.value = null
  notes.value = ''
}

const submitOrder = async () => {
  if (!canSubmit.value || !workspace.activeOutletId.value) return

  try {
    submitting.value = true
    successMessage.value = ''
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
    successMessage.value = `Transaksi ${result.order_no} berhasil disimpan. Kembalian: ${formatCurrency(result.change_amount || 0)}.`
    resetForm()
    await loadRecentOrders()
  } catch (error: any) {
    errorMessage.value = error?.message || 'Gagal membuat transaksi.'
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  try {
    await workspace.bootstrap()
    debugInfo.value = `profile: ${JSON.stringify(workspace.profile.value)}, outlets: ${JSON.stringify(workspace.outlets.value)}, activeOutletId: ${workspace.activeOutletId.value}, error: ${workspace.error.value}`
  } catch (e: any) {
    debugInfo.value = `bootstrap error: ${e?.message}`
  }
  await Promise.all([loadMenus(), loadRecentOrders()])
})

watch(() => workspace.activeOutletId.value, async (value, oldValue) => {
  if (!value || value === oldValue) return
  resetForm()
  await Promise.all([loadMenus(), loadRecentOrders()])
})
</script>

<template>
  <div class="page">
    <section class="section-title">
      <div>
        <h1 class="title">Kasir POS</h1>
        <p class="subtitle">Alur transaksi dibuat lebih cepat, aman, dan mudah dipahami untuk operasional harian.</p>
      </div>
      <div class="chip-group">
        <span class="chip active">{{ totalQty }} item di keranjang</span>
        <span class="chip">{{ formatCurrency(todayRevenue) }} omzet hari ini</span>
        <span class="chip">{{ todaySales.length }} transaksi hari ini</span>
      </div>
    </section>

    <div v-if="debugInfo" class="alert" style="background:#1e293b;color:#94a3b8;font-size:11px;word-break:break-all;margin-bottom:8px;">{{ debugInfo }}</div>

    <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div>
    <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>

    <div class="grid grid-2">
      <section class="card stack">
        <div class="toolbar">
          <input v-model="search" class="input" placeholder="Cari menu, kategori, atau deskripsi..." />
          <button class="btn btn-secondary" @click="loadMenus">Refresh menu</button>
        </div>

        <div class="chip-group">
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
        <div v-else-if="!filteredMenus.length" class="empty-state">Menu tidak ditemukan. Coba ubah kata kunci atau pilih kategori lain.</div>

        <div v-else class="menu-grid">
          <article v-for="menu in filteredMenus" :key="menu.id" class="menu-card">
            <div class="stack" style="gap: 8px;">
              <span class="badge badge-neutral" style="width: fit-content;">{{ normalizeCategoryName(menu) }}</span>
              <h3>{{ menu.name }}</h3>
              <p>{{ menu.description || 'Menu siap dijual di kasir.' }}</p>
            </div>

            <div class="footer">
              <div>
                <strong style="font-size: 20px;">{{ formatCurrency(menu.price) }}</strong>
                <p>Modal {{ formatCurrency(menu.cost_price) }}</p>
              </div>
              <button class="btn btn-primary" @click="addMenu(menu)">Tambah</button>
            </div>
          </article>
        </div>
      </section>

      <section class="card stack">
        <div class="section-title">
          <div>
            <h2 style="margin: 0;">Keranjang & Pembayaran</h2>
            <p class="subtitle">Satu area untuk cek item, catatan, metode bayar, dan total transaksi.</p>
          </div>
          <span class="badge badge-soft">{{ totalQty }} item</span>
        </div>

        <div class="form-grid-2">
          <div class="stack" style="gap: 8px;">
            <label class="field-label">Nama pelanggan</label>
            <input v-model="customerName" class="input" placeholder="Opsional" />
          </div>
          <div class="stack" style="gap: 8px;">
            <label class="field-label">Tipe order</label>
            <select v-model="orderType" class="select">
              <option value="dine_in">Makan di tempat</option>
              <option value="takeaway">Bawa pulang</option>
              <option value="online">Online</option>
            </select>
          </div>
        </div>

        <div class="form-grid-2">
          <div class="stack" style="gap: 8px;">
            <label class="field-label">Metode pembayaran</label>
            <select v-model="paymentMethod" class="select">
              <option value="cash">Tunai</option>
              <option value="transfer">Transfer</option>
              <option value="qris">QRIS</option>
            </select>
          </div>
          <div class="stack" style="gap: 8px;">
            <label class="field-label">Nominal dibayar</label>
            <input
              v-model.number="paidAmount"
              class="input"
              type="number"
              min="0"
              :placeholder="paymentMethod === 'cash' ? 'Masukkan uang diterima' : String(subtotal)"
            />
          </div>
        </div>

        <div class="stack" style="gap: 8px;">
          <label class="field-label">Catatan transaksi</label>
          <textarea v-model="notes" class="textarea" placeholder="Opsional. Contoh: meja pojok, pelanggan langganan, dll."></textarea>
        </div>

        <div v-if="!cart.length" class="empty-state">Belum ada item. Tambahkan produk dari katalog di sebelah kiri.</div>

        <div v-else class="cart-list">
          <div v-for="(item, index) in cart" :key="`${item.id}-${index}`" class="cart-item">
            <div class="cart-item-top">
              <div>
                <strong>{{ item.name }}</strong>
                <p class="muted small">{{ formatCurrency(item.price) }} / item</p>
              </div>
              <button class="btn btn-secondary" @click="removeItem(index)">Hapus</button>
            </div>

            <div class="qty-control">
              <button @click="changeQty(index, -1)">-</button>
              <strong>{{ item.qty }}</strong>
              <button @click="changeQty(index, 1)">+</button>
              <span class="spacer" />
              <strong>{{ formatCurrency(item.qty * item.price) }}</strong>
            </div>

            <input v-model="item.notes" class="input" placeholder="Catatan item, mis. tanpa gula / tambah es" />
          </div>
        </div>

        <div class="summary-list">
          <div class="summary-row"><span class="muted">Subtotal</span><strong>{{ formatCurrency(subtotal) }}</strong></div>
          <div class="summary-row"><span class="muted">Dibayar</span><strong>{{ formatCurrency(effectivePaid) }}</strong></div>
          <div class="summary-row"><span class="muted">Kembalian</span><strong>{{ formatCurrency(changeAmount) }}</strong></div>
          <div class="summary-row total"><span>Total</span><span>{{ formatCurrency(subtotal) }}</span></div>
        </div>

        <div v-if="insufficientPayment" class="alert alert-warning">
          Nominal tunai masih kurang. Pastikan nominal dibayar minimal sama dengan total transaksi.
        </div>

        <div class="toolbar">
          <button class="btn btn-secondary" @click="resetForm">Reset keranjang</button>
          <span class="spacer" />
          <button class="btn btn-primary btn-lg" :disabled="submitting || !canSubmit" @click="submitOrder">
            {{ submitting ? 'Menyimpan transaksi...' : 'Bayar & Simpan Transaksi' }}
          </button>
        </div>
      </section>
    </div>

    <section class="card stack">
      <div class="section-title">
        <div>
          <h2 style="margin: 0;">Transaksi terbaru</h2>
          <p class="subtitle">Pantau transaksi yang baru masuk tanpa pindah halaman.</p>
        </div>
        <button class="btn btn-secondary" @click="loadRecentOrders">Refresh transaksi</button>
      </div>

      <div v-if="!recentOrders.length" class="empty-state">Belum ada transaksi terbaru pada outlet ini.</div>
      <div v-else class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>No. Order</th>
              <th>Pelanggan</th>
              <th>Metode</th>
              <th>Status</th>
              <th>Waktu</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in recentOrders" :key="order.id">
              <td><strong>{{ order.order_no }}</strong></td>
              <td>{{ order.customer_name || 'Umum' }}</td>
              <td>{{ order.payment_method }}</td>
              <td><span class="badge badge-success">{{ order.status }}</span></td>
              <td>{{ new Date(order.created_at).toLocaleString('id-ID') }}</td>
              <td><strong>{{ formatCurrency(order.total) }}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

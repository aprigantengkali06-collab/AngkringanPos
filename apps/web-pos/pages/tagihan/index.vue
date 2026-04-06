<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const supabase = useSupabaseClient()
const workspace = useWorkspace()

// ─── Types ────────────────────────────────────────────
interface OrderItem {
  id: string
  product_name: string
  quantity: number
  product_price: number
  subtotal: number
  paid_qty: number
}
interface OrderPayment {
  id: string
  payment_method: string
  amount: number
  created_at: string
}
interface Tagihan {
  id: string
  order_no: string
  customer_name: string
  total: number
  paid_amount: number
  notes: string | null
  created_at: string
  order_items: OrderItem[]
  order_payments: OrderPayment[]
}
interface Menu {
  id: string
  name: string
  price: number
  cost_price: number
  categories?: { name: string } | null
}

// ─── State utama ──────────────────────────────────────
const loading   = ref(false)
const tagihans  = ref<Tagihan[]>([])
const errMsg    = ref('')
const successMsg = ref('')

// ─── Modal detail ─────────────────────────────────────
const showDetail   = ref(false)
const activeOrder  = ref<Tagihan | null>(null)
const detailMode   = ref<'edit'|'bayar'>('edit')
const editLoading  = ref(false)

// Tambah pesanan
const showAddItem  = ref(false)
const menuSearch   = ref('')
const menus        = ref<Menu[]>([])
const menuLoading  = ref(false)
const addQty       = ref(1)
const selectedMenu = ref<Menu | null>(null)

// Bayar per item: {itemId → qty yang akan dibayar}
const payQty       = ref<Record<string, number>>({})
const payMethod    = ref<'cash'|'transfer'|'qris'>('cash')
const paying       = ref(false)

// ─── Helpers ──────────────────────────────────────────
const fmt   = (v: number) => `Rp ${Number(v || 0).toLocaleString('id-ID')}`
const fmtDt = (v: string) => new Date(v).toLocaleString('id-ID')
const sisa  = (t: Tagihan) => Math.max(0, t.total - t.paid_amount)

// ─── Load tagihan ─────────────────────────────────────
const load = async () => {
  if (!workspace.activeOutletId.value) return
  loading.value = true
  errMsg.value = ''
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('id, order_no, customer_name, total, paid_amount, notes, created_at, order_items(id, product_name, quantity, product_price, subtotal, paid_qty), order_payments(id, payment_method, amount, created_at)')
      .eq('outlet_id', workspace.activeOutletId.value)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
    if (error) throw error
    tagihans.value = (data || []) as Tagihan[]
    // Sync active order jika modal sedang buka
    if (activeOrder.value) {
      const updated = tagihans.value.find(t => t.id === activeOrder.value!.id)
      if (updated) activeOrder.value = updated
    }
  } catch (e: any) {
    errMsg.value = e?.message || 'Gagal memuat tagihan.'
  } finally {
    loading.value = false
  }
}

// ─── Buka detail ──────────────────────────────────────
const openDetail = (t: Tagihan) => {
  activeOrder.value = t
  detailMode.value = 'edit'
  showAddItem.value = false
  menuSearch.value = ''
  selectedMenu.value = null
  addQty.value = 1
  // Reset pay qty
  payQty.value = {}
  showDetail.value = true
}

const closeDetail = () => {
  showDetail.value = false
  activeOrder.value = null
}

// ─── Edit item (qty / hapus) ──────────────────────────
const changeItemQty = async (item: OrderItem, diff: number) => {
  if (!activeOrder.value) return
  const newQty = item.quantity + diff
  editLoading.value = true
  try {
    const { data, error } = await supabase.rpc('edit_order_item_pos', {
      p_order_id: activeOrder.value.id,
      p_item_id: item.id,
      p_new_qty: newQty
    })
    if (error) throw error
    if (data?.ok === false) throw new Error(data.error)
    await load()
  } catch (e: any) {
    errMsg.value = e?.message
  } finally {
    editLoading.value = false
  }
}

// ─── Load & tambah menu ───────────────────────────────
const loadMenus = async () => {
  if (!workspace.activeOutletId.value) return
  menuLoading.value = true
  try {
    const { data } = await supabase
      .from('menus')
      .select('id, name, price, cost_price')
      .eq('outlet_id', workspace.activeOutletId.value)
      .eq('is_available', true)
      .order('name')
    menus.value = (data || []) as Menu[]
  } finally {
    menuLoading.value = false
  }
}

const filteredMenus = computed(() =>
  menus.value.filter(m => m.name.toLowerCase().includes(menuSearch.value.toLowerCase()))
)

const openAddItem = async () => {
  showAddItem.value = true
  await loadMenus()
}

const selectMenu = (m: Menu) => {
  selectedMenu.value = m
  addQty.value = 1
}

const submitAddItem = async () => {
  if (!activeOrder.value || !selectedMenu.value) return
  editLoading.value = true
  try {
    const { data, error } = await supabase.rpc('add_item_to_open_order_pos', {
      p_order_id:   activeOrder.value.id,
      p_menu_id:    selectedMenu.value.id,
      p_item_name:  selectedMenu.value.name,
      p_qty:        addQty.value,
      p_unit_price: selectedMenu.value.price,
      p_cost_price: selectedMenu.value.cost_price
    })
    if (error) throw error
    if (data?.ok === false) throw new Error(data.error)
    selectedMenu.value = null
    menuSearch.value = ''
    showAddItem.value = false
    await load()
  } catch (e: any) {
    errMsg.value = e?.message
  } finally {
    editLoading.value = false
  }
}

// ─── Bayar per item ───────────────────────────────────
const initPayMode = () => {
  if (!activeOrder.value) return
  payQty.value = {}
  activeOrder.value.order_items.forEach(item => {
    const unpaid = item.quantity - (item.paid_qty || 0)
    payQty.value[item.id] = unpaid > 0 ? unpaid : 0
  })
  detailMode.value = 'bayar'
}

const unpaidQty = (item: OrderItem) => Math.max(0, item.quantity - (item.paid_qty || 0))

const payTotal = computed(() => {
  if (!activeOrder.value) return 0
  return activeOrder.value.order_items.reduce((sum, item) => {
    const q = payQty.value[item.id] || 0
    return sum + q * item.product_price
  }, 0)
})

const submitPayItems = async () => {
  if (!activeOrder.value || payTotal.value <= 0) return
  paying.value = true
  errMsg.value = ''
  try {
    const items = activeOrder.value.order_items
      .filter(item => (payQty.value[item.id] || 0) > 0)
      .map(item => ({
        item_id:    item.id,
        qty_paid:   payQty.value[item.id],
        unit_price: item.product_price
      }))

    const { data, error } = await supabase.rpc('pay_items_pos', {
      p_order_id: activeOrder.value.id,
      p_items:    items,
      p_method:   payMethod.value
    })
    if (error) throw error
    if (data?.ok === false) throw new Error(data.error)

    const lunas = data?.status === 'paid'
    successMsg.value = lunas
      ? `✓ Tagihan ${activeOrder.value.customer_name} lunas!`
      : `✓ Bayar ${fmt(data?.amount || 0)}. Sisa ${fmt(data?.remaining || 0)}.`

    closeDetail()
    await load()
    setTimeout(() => { successMsg.value = '' }, 4000)
  } catch (e: any) {
    errMsg.value = e?.message || 'Gagal menyimpan pembayaran.'
  } finally {
    paying.value = false
  }
}

// ─── Lifecycle ────────────────────────────────────────
onMounted(async () => {
  await workspace.bootstrap()
  await load()
})
watch(() => workspace.activeOutletId.value, async (v, old) => {
  if (!v || v === old) return
  await load()
})
</script>

<template>
  <div class="page">

    <!-- Header -->
    <section class="page-hero">
      <div class="page-hero-top">
        <div>
          <p class="eyebrow">Kasir</p>
          <h1 class="page-hero-title">Tagihan Aktif</h1>
        </div>
        <button class="btn btn-secondary" :disabled="loading" @click="load">
          {{ loading ? 'Memuat...' : 'Refresh' }}
        </button>
      </div>
    </section>

    <div v-if="successMsg" class="alert alert-success">{{ successMsg }}</div>
    <div v-if="errMsg && !showDetail" class="alert alert-danger">{{ errMsg }}</div>

    <!-- Empty -->
    <div v-if="loading" class="empty-state">Memuat tagihan...</div>
    <div v-else-if="!tagihans.length" class="tagihan-empty">
      <div class="tagihan-empty-icon">🧾</div>
      <p>Belum ada tagihan aktif.</p>
      <p class="muted small">Buat tagihan dari halaman Kasir dengan "Bayar nanti".</p>
    </div>

    <!-- List tagihan -->
    <div v-else class="tagihan-list">
      <article v-for="t in tagihans" :key="t.id" class="tagihan-card">

        <div class="tagihan-card-head">
          <div>
            <strong class="tagihan-nama">{{ t.customer_name }}</strong>
            <p class="muted small" style="margin:2px 0 0;">{{ t.order_no }} · {{ fmtDt(t.created_at) }}</p>
          </div>
          <span v-if="t.paid_amount > 0" class="badge badge-warning">Sebagian</span>
          <span v-else class="badge">Belum bayar</span>
        </div>

        <!-- Item ringkas -->
        <div class="tagihan-items-preview">
          <div v-for="item in t.order_items" :key="item.id" class="tagihan-item-row">
            <span>{{ item.product_name }}</span>
            <span class="muted small">{{ item.quantity }}× {{ fmt(item.product_price) }}</span>
            <strong>{{ fmt(item.subtotal) }}</strong>
          </div>
        </div>

        <!-- Riwayat bayar -->
        <div v-if="t.order_payments?.length" class="tagihan-payments-mini">
          <div v-for="p in t.order_payments" :key="p.id" class="tagihan-payment-row">
            <span class="muted small">{{ p.payment_method }} · {{ fmtDt(p.created_at) }}</span>
            <strong style="color:#16a34a;">{{ fmt(p.amount) }}</strong>
          </div>
        </div>

        <!-- Footer -->
        <div class="tagihan-footer">
          <div class="tagihan-total-row">
            <span class="muted small">Total</span>
            <strong>{{ fmt(t.total) }}</strong>
          </div>
          <div v-if="t.paid_amount > 0" class="tagihan-total-row">
            <span class="muted small">Sudah dibayar</span>
            <strong style="color:#16a34a;">{{ fmt(t.paid_amount) }}</strong>
          </div>
          <div class="tagihan-total-row sisa">
            <span>Sisa</span>
            <strong>{{ fmt(sisa(t)) }}</strong>
          </div>
        </div>

        <!-- Dua tombol -->
        <div class="tagihan-actions">
          <button class="btn btn-secondary" style="flex:1;" @click="openDetail(t)">
            Lihat Pesanan
          </button>
          <button class="btn btn-primary" style="flex:1;" @click="openDetail(t); detailMode = 'bayar'; initPayMode()">
            Bayar
          </button>
        </div>

      </article>
    </div>

    <!-- ─── MODAL DETAIL ─────────────────────────── -->
    <div v-if="showDetail && activeOrder" class="modal-backdrop" @click.self="closeDetail">
      <div class="detail-modal">

        <!-- Modal header -->
        <div class="detail-modal-head">
          <div>
            <strong style="font-size:17px;">{{ activeOrder.customer_name }}</strong>
            <p class="muted small" style="margin:2px 0 0;">{{ activeOrder.order_no }}</p>
          </div>
          <button class="btn-icon-close" @click="closeDetail">✕</button>
        </div>

        <!-- Tab -->
        <div class="detail-tabs">
          <button
            class="detail-tab"
            :class="{ active: detailMode === 'edit' }"
            @click="detailMode = 'edit'; showAddItem = false"
          >✏️ Edit Pesanan</button>
          <button
            class="detail-tab"
            :class="{ active: detailMode === 'bayar' }"
            @click="initPayMode()"
          >💳 Bayar</button>
        </div>

        <div v-if="errMsg" class="alert alert-danger" style="margin:0;">{{ errMsg }}</div>

        <!-- ── MODE EDIT ── -->
        <div v-if="detailMode === 'edit'" class="detail-body">

          <!-- Daftar item -->
          <div class="edit-item-list">
            <div v-for="item in activeOrder.order_items" :key="item.id" class="edit-item-row">
              <div class="edit-item-info">
                <strong class="edit-item-name">{{ item.product_name }}</strong>
                <span class="muted small">{{ fmt(item.product_price) }}/item</span>
                <span v-if="item.paid_qty > 0" class="paid-label">
                  {{ item.paid_qty }} sudah dibayar
                </span>
              </div>
              <div class="edit-item-controls">
                <strong class="edit-item-total">{{ fmt(item.subtotal) }}</strong>
                <div class="qty-stepper-edit">
                  <!-- Hapus kalau qty=1 dan belum ada yang dibayar -->
                  <button
                    v-if="item.quantity === 1 && item.paid_qty === 0"
                    class="stepper-btn delete-btn"
                    :disabled="editLoading"
                    @click="changeItemQty(item, -1)"
                  >🗑</button>
                  <!-- Kurang kalau qty > 1 -->
                  <button
                    v-else-if="item.quantity > (item.paid_qty || 0)"
                    class="stepper-btn"
                    :disabled="editLoading"
                    @click="changeItemQty(item, -1)"
                  >−</button>
                  <span class="stepper-qty">{{ item.quantity }}</span>
                  <button
                    class="stepper-btn"
                    :disabled="editLoading"
                    @click="changeItemQty(item, 1)"
                  >+</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Tambah menu -->
          <div v-if="!showAddItem">
            <button class="btn btn-secondary" style="width:100%;" @click="openAddItem">
              + Tambah Menu
            </button>
          </div>

          <div v-else class="add-item-panel">
            <div class="add-item-panel-head">
              <strong>Tambah Menu</strong>
              <button class="btn-icon-close" @click="showAddItem = false; selectedMenu = null">✕</button>
            </div>

            <input
              v-model="menuSearch"
              class="input"
              placeholder="Cari menu..."
              style="margin-bottom:8px;"
            />

            <div v-if="menuLoading" class="muted small">Memuat menu...</div>

            <div v-else-if="!selectedMenu" class="add-menu-list">
              <button
                v-for="m in filteredMenus"
                :key="m.id"
                class="add-menu-item"
                @click="selectMenu(m)"
              >
                <span>{{ m.name }}</span>
                <span class="muted small">{{ fmt(m.price) }}</span>
              </button>
            </div>

            <div v-else class="add-item-confirm">
              <div class="add-item-confirm-info">
                <strong>{{ selectedMenu.name }}</strong>
                <span class="muted small">{{ fmt(selectedMenu.price) }}/item</span>
              </div>
              <div class="qty-stepper-edit" style="margin:12px 0;">
                <button class="stepper-btn" @click="addQty = Math.max(1, addQty - 1)">−</button>
                <span class="stepper-qty">{{ addQty }}</span>
                <button class="stepper-btn" @click="addQty++">+</button>
              </div>
              <p class="muted small" style="margin-bottom:12px;">
                Total: {{ fmt(selectedMenu.price * addQty) }}
              </p>
              <div class="toolbar">
                <button class="btn btn-secondary" @click="selectedMenu = null">Batal</button>
                <button class="btn btn-primary" :disabled="editLoading" @click="submitAddItem">
                  {{ editLoading ? 'Menambah...' : 'Tambah' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Total -->
          <div class="detail-total-bar">
            <span>Total tagihan</span>
            <strong>{{ fmt(activeOrder.total) }}</strong>
          </div>
        </div>

        <!-- ── MODE BAYAR ── -->
        <div v-if="detailMode === 'bayar'" class="detail-body">
          <p class="summary-label" style="margin-bottom:8px;">Pilih item yang dibayar</p>

          <div class="pay-item-list">
            <div
              v-for="item in activeOrder.order_items"
              :key="item.id"
              class="pay-item-row"
              :class="{ 'all-paid': unpaidQty(item) === 0 }"
            >
              <div class="pay-item-info">
                <strong>{{ item.product_name }}</strong>
                <span class="muted small">{{ fmt(item.product_price) }}/item</span>
                <span v-if="item.paid_qty > 0" class="paid-label">
                  {{ item.paid_qty }}/{{ item.quantity }} sudah dibayar
                </span>
              </div>

              <div v-if="unpaidQty(item) > 0" class="qty-stepper-edit">
                <button
                  class="stepper-btn"
                  @click="payQty[item.id] = Math.max(0, (payQty[item.id] || 0) - 1)"
                >−</button>
                <span class="stepper-qty">{{ payQty[item.id] || 0 }}</span>
                <button
                  class="stepper-btn"
                  @click="payQty[item.id] = Math.min(unpaidQty(item), (payQty[item.id] || 0) + 1)"
                >+</button>
              </div>
              <span v-else class="badge badge-success" style="font-size:11px;">Lunas</span>
            </div>
          </div>

          <!-- Total bayar sekarang -->
          <div class="detail-total-bar" v-if="payTotal > 0">
            <span>Dibayar sekarang</span>
            <strong style="color:var(--primary);">{{ fmt(payTotal) }}</strong>
          </div>

          <div class="stack" style="gap:10px;">
            <label class="field-label">Metode bayar</label>
            <div class="segmented-row">
              <button
                v-for="m in ['cash','transfer','qris']"
                :key="m"
                class="segment-button"
                :class="{ active: payMethod === m }"
                @click="payMethod = (m as any)"
              >{{ m }}</button>
            </div>
          </div>

          <button
            class="btn btn-primary"
            style="width:100%;"
            :disabled="paying || payTotal === 0"
            @click="submitPayItems"
          >
            {{ paying ? 'Menyimpan...' : payTotal > 0 ? `Bayar ${fmt(payTotal)}` : 'Pilih item dulu' }}
          </button>
        </div>

      </div>
    </div>

  </div>
</template>

<style scoped>
/* ── Empty state ── */
.tagihan-empty { text-align:center; padding:48px 24px; color:var(--text-2); }
.tagihan-empty-icon { font-size:40px; margin-bottom:12px; }

/* ── Card list ── */
.tagihan-list { display:grid; gap:16px; }
.tagihan-card {
  background:var(--card); border:1.5px solid var(--line);
  border-radius:var(--r-xl); padding:18px; display:grid; gap:14px;
}
.tagihan-card-head { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
.tagihan-nama { font-size:16px; font-weight:700; }

.tagihan-items-preview {
  background:var(--bg-soft); border-radius:var(--r-lg);
  padding:10px 12px; display:grid; gap:6px;
}
.tagihan-item-row {
  display:grid; grid-template-columns:1fr auto auto;
  gap:8px; align-items:center; font-size:13px;
}

.tagihan-payments-mini { border-top:1px solid var(--line); padding-top:8px; display:grid; gap:4px; }
.tagihan-payment-row { display:flex; justify-content:space-between; font-size:13px; }

.tagihan-footer { border-top:1.5px solid var(--line); padding-top:10px; display:grid; gap:6px; }
.tagihan-total-row { display:flex; justify-content:space-between; font-size:13px; }
.tagihan-total-row.sisa { font-size:15px; font-weight:700; }

.tagihan-actions { display:flex; gap:10px; }

.badge-warning { background:#fef3c7; color:#92400e; font-size:11px; font-weight:700; padding:3px 10px; border-radius:999px; }
.badge-success { background:#dcfce7; color:#15803d; font-size:11px; font-weight:700; padding:3px 10px; border-radius:999px; }

/* ── Modal ── */
.detail-modal {
  background:var(--card);
  border-radius:var(--r-xl);
  width:calc(100vw - 24px);
  max-width:480px;
  max-height:88vh;
  overflow-y:auto;
  display:grid;
  gap:0;
}
.detail-modal-head {
  display:flex; justify-content:space-between; align-items:flex-start;
  padding:18px 18px 12px; border-bottom:1px solid var(--line);
}
.btn-icon-close {
  background:none; border:none; font-size:16px;
  color:var(--muted); cursor:pointer; padding:2px 6px; flex-shrink:0;
}

/* Tabs */
.detail-tabs { display:flex; border-bottom:1px solid var(--line); }
.detail-tab {
  flex:1; padding:12px; background:none; border:none;
  font-size:13px; font-weight:600; color:var(--muted); cursor:pointer;
  border-bottom:2px solid transparent; transition:all 0.15s;
}
.detail-tab.active { color:var(--primary); border-bottom-color:var(--primary); }

.detail-body { padding:16px; display:grid; gap:16px; }

/* Edit items */
.edit-item-list { display:grid; gap:10px; }
.edit-item-row {
  display:flex; justify-content:space-between; align-items:center;
  gap:12px; padding:12px; background:var(--bg-soft);
  border-radius:var(--r-lg); border:1px solid var(--line);
}
.edit-item-info { display:grid; gap:2px; flex:1; min-width:0; }
.edit-item-name { font-size:14px; font-weight:600; }
.edit-item-controls { display:flex; flex-direction:column; align-items:flex-end; gap:8px; }
.edit-item-total { font-size:14px; font-weight:700; }

.qty-stepper-edit { display:flex; align-items:center; gap:6px; }
.stepper-btn {
  width:30px; height:30px; border-radius:50%; border:1.5px solid var(--line);
  background:var(--card); font-size:16px; font-weight:700; cursor:pointer;
  display:flex; align-items:center; justify-content:center; flex-shrink:0;
  transition:all 0.15s;
}
.stepper-btn:disabled { opacity:0.4; cursor:not-allowed; }
.stepper-btn:not(:disabled):hover { border-color:var(--primary); color:var(--primary); }
.delete-btn { color:#dc2626; border-color:#fecaca; }
.delete-btn:hover { background:#fef2f2 !important; }
.stepper-qty { font-size:15px; font-weight:700; min-width:24px; text-align:center; }
.paid-label { font-size:11px; color:#16a34a; font-weight:600; }

/* Add item panel */
.add-item-panel {
  background:var(--bg-soft); border-radius:var(--r-lg);
  border:1.5px solid var(--line); padding:14px; display:grid; gap:10px;
}
.add-item-panel-head { display:flex; justify-content:space-between; align-items:center; }
.add-menu-list { display:grid; gap:6px; max-height:200px; overflow-y:auto; }
.add-menu-item {
  display:flex; justify-content:space-between; align-items:center;
  padding:10px 12px; background:var(--card); border:1px solid var(--line);
  border-radius:var(--r-md); cursor:pointer; font-size:13px;
  text-align:left; transition:border-color 0.15s;
}
.add-menu-item:hover { border-color:var(--primary); }
.add-item-confirm { display:grid; gap:4px; }
.add-item-confirm-info { display:flex; justify-content:space-between; }

/* Pay items */
.pay-item-list { display:grid; gap:8px; }
.pay-item-row {
  display:flex; justify-content:space-between; align-items:center;
  gap:12px; padding:12px; background:var(--bg-soft);
  border-radius:var(--r-lg); border:1px solid var(--line);
}
.pay-item-row.all-paid { opacity:0.5; }
.pay-item-info { display:grid; gap:2px; flex:1; min-width:0; }

/* Detail total bar */
.detail-total-bar {
  display:flex; justify-content:space-between; align-items:center;
  padding:12px 14px; background:var(--bg-soft);
  border-radius:var(--r-lg); border:1px solid var(--line);
  font-size:14px; font-weight:600;
}
</style>

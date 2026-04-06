<script setup lang="ts">
import { orderService } from '~/services/order.service'

definePageMeta({ middleware: ['auth'] })

const workspace = useWorkspace()
const orders      = ref<any[]>([])
const loading     = ref(false)
const errorMessage = ref('')

// ── Detail modal ──────────────────────────────────────
const selectedOrder  = ref<any | null>(null)
const detailLoading  = ref(false)
const printingReceipt = ref(false)

// ── Filter: bulan & hari ──────────────────────────────
const now = new Date()
const selectedMonth = ref(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
const selectedDate  = ref<string | null>(new Date().toISOString().slice(0, 10))

// ── Helpers ───────────────────────────────────────────
const fmt     = (v: number) => `Rp ${Number(v || 0).toLocaleString('id-ID')}`
const shortId = (id: string) => `#${(id || '').slice(-8).toUpperCase()}`
const getDate = (order: any) => (order.paid_at || order.created_at || '').slice(0, 10)

const orderTypeLabel: Record<string, string> = {
  dine_in: 'Dine In', takeaway: 'Bawa Pulang', online: 'Pesan Antar'
}
const paymentLabel: Record<string, string> = {
  cash: 'Tunai', transfer: 'Transfer', qris: 'QRIS'
}

// ── Load orders ───────────────────────────────────────
const load = async () => {
  if (!workspace.activeOutletId.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    orders.value = await orderService.listLatest(workspace.activeOutletId.value, 500)
  } catch (e: any) {
    errorMessage.value = e?.message || 'Gagal memuat transaksi.'
  } finally {
    loading.value = false
  }
}

// ── Month navigation ──────────────────────────────────
const monthLabel = computed(() => {
  const [y, m] = selectedMonth.value.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
})

const prevMonth = () => {
  const [y, m] = selectedMonth.value.split('-').map(Number)
  const d = new Date(y, m - 2)
  selectedMonth.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  selectedDate.value = null
}

const nextMonth = () => {
  const [y, m] = selectedMonth.value.split('-').map(Number)
  const d = new Date(y, m)
  const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  if (next <= thisMonth) {
    selectedMonth.value = next
    selectedDate.value = null
  }
}

const isCurrentMonth = computed(() => {
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return selectedMonth.value === thisMonth
})

// ── Filter by bulan ───────────────────────────────────
const ordersInMonth = computed(() =>
  orders.value.filter(o => getDate(o).startsWith(selectedMonth.value))
)

// ── Unique days yang ada transaksi dalam bulan ini ────
const daysInMonth = computed(() => {
  const set = new Set<string>()
  ordersInMonth.value.forEach(o => set.add(getDate(o)))
  return Array.from(set).sort().reverse()
})

// ── Orders setelah filter hari ────────────────────────
const filteredOrders = computed(() =>
  selectedDate.value
    ? ordersInMonth.value.filter(o => getDate(o) === selectedDate.value)
    : ordersInMonth.value
)

// ── KPI cards ─────────────────────────────────────────
const kpiTotal    = computed(() => filteredOrders.value.length)
const kpiOmzet    = computed(() => filteredOrders.value.reduce((s, o) => s + Number(o.total || 0), 0))
const kpiCash     = computed(() => filteredOrders.value.filter(o => o.payment_method === 'cash').length)
const kpiQris     = computed(() => filteredOrders.value.filter(o => o.payment_method === 'qris').length)
const kpiTransfer = computed(() => filteredOrders.value.filter(o => o.payment_method === 'transfer').length)
const kpiPaid     = computed(() => filteredOrders.value.filter(o => o.status === 'paid').length)

// ── Grouped by day ────────────────────────────────────
const groupedOrders = computed(() => {
  const map = new Map<string, any[]>()
  filteredOrders.value.forEach(o => {
    const d = getDate(o)
    if (!map.has(d)) map.set(d, [])
    map.get(d)!.push(o)
  })
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, list]) => ({
      date,
      label: new Date(date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }),
      orders: list,
      total: list.reduce((s, o) => s + Number(o.total || 0), 0)
    }))
})

// ── Detail modal ──────────────────────────────────────
const openDetail = async (order: any) => {
  selectedOrder.value = { ...order }
  detailLoading.value = true
  try {
    const raw = await orderService.getOrderDetails(order.id)
    if (raw?.order_items) {
      raw.order_items = raw.order_items.map((item: any) => ({
        ...item,
        item_name: item.item_name || item.product_name || '-',
        qty: item.qty || item.quantity || 0,
        unit_price: item.unit_price || item.product_price || 0
      }))
    }
    selectedOrder.value = {
      ...raw,
      payment_method: raw.payment_method || order.payment_method
    }
  } catch {
    // keep basic data
  } finally {
    detailLoading.value = false
  }
}

const closeDetail = () => { selectedOrder.value = null }

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
    alert(e?.message || 'Gagal cetak. Pastikan printer terhubung.')
  } finally {
    printingReceipt.value = false
  }
}

// ── Format day chip label ─────────────────────────────
const dayChipLabel = (dateStr: string) => {
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (dateStr === today) return 'Hari ini'
  if (dateStr === yesterday) return 'Kemarin'
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

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
          <p class="eyebrow">Laporan</p>
          <h1 class="page-hero-title">Riwayat Transaksi</h1>
        </div>
        <button class="btn btn-secondary" :disabled="loading" @click="load">
          {{ loading ? 'Memuat...' : 'Refresh' }}
        </button>
      </div>
    </section>

    <!-- Month navigator -->
    <div class="month-nav">
      <button class="month-nav-btn" @click="prevMonth">‹</button>
      <span class="month-nav-label">{{ monthLabel }}</span>
      <button class="month-nav-btn" :disabled="isCurrentMonth" @click="nextMonth">›</button>
    </div>

    <!-- Day chips -->
    <div v-if="daysInMonth.length" class="day-chips-wrap">
      <div class="day-chips">
        <button
          class="day-chip"
          :class="{ active: selectedDate === null }"
          @click="selectedDate = null"
        >Semua</button>
        <button
          v-for="d in daysInMonth"
          :key="d"
          class="day-chip"
          :class="{ active: selectedDate === d }"
          @click="selectedDate = d"
        >{{ dayChipLabel(d) }}</button>
      </div>
    </div>

    <!-- KPI cards -->
    <div class="grid grid-4">
      <article class="kpi-card">
        <h3>Total Transaksi</h3>
        <div class="value">{{ kpiTotal }}</div>
        <div class="hint">{{ selectedDate ? dayChipLabel(selectedDate) : monthLabel }}</div>
      </article>
      <article class="kpi-card">
        <h3>Omzet</h3>
        <div class="value">{{ fmt(kpiOmzet) }}</div>
        <div class="hint">Akumulasi semua transaksi</div>
      </article>
      <article class="kpi-card">
        <h3>Cash / QRIS</h3>
        <div class="value">{{ kpiCash }} / {{ kpiQris }}</div>
        <div class="hint">Transfer: {{ kpiTransfer }}</div>
      </article>
      <article class="kpi-card">
        <h3>Status Paid</h3>
        <div class="value">{{ kpiPaid }}</div>
        <div class="hint">Transaksi berstatus paid</div>
      </article>
    </div>

    <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>
    <div v-if="loading" class="empty-state">Memuat transaksi...</div>

    <!-- Grouped list -->
    <template v-else-if="groupedOrders.length">
      <div v-for="group in groupedOrders" :key="group.date" class="trx-group">
        <div class="trx-group-header">
          <span class="trx-group-label">{{ group.label }}</span>
          <span class="trx-group-total">{{ fmt(group.total) }}</span>
        </div>

        <div class="trx-list">
          <button
            v-for="order in group.orders"
            :key="order.id"
            class="trx-card"
            @click="openDetail(order)"
          >
            <div class="trx-card-left">
              <div class="trx-card-top">
                <span class="trx-card-id">{{ shortId(order.id) }}</span>
                <span
                  class="trx-card-badge"
                  :class="order.status === 'paid' ? 'trx-badge-paid' : 'trx-badge-open'"
                >{{ order.status === 'paid' ? 'Lunas' : 'Belum Lunas' }}</span>
              </div>
              <span class="trx-card-meta">
                {{ order.customer_name || 'Umum' }}
                {{ order.payment_method ? ' · ' + (paymentLabel[order.payment_method] || order.payment_method) : '' }}
                {{ order.order_type ? ' · ' + (orderTypeLabel[order.order_type] || order.order_type) : '' }}
              </span>
            </div>
            <strong class="trx-card-total">{{ fmt(order.total) }}</strong>
          </button>
        </div>
      </div>
    </template>

    <div v-else class="empty-state">Tidak ada transaksi pada periode ini.</div>

    <!-- Detail Modal -->
    <div v-if="selectedOrder" class="modal-backdrop" @click="closeDetail">
      <div class="modal-card order-detail-modal" @click.stop>

        <div class="odm-header">
          <div class="odm-header-left">
            <span class="odm-eyebrow">Detail Transaksi</span>
            <h2 class="odm-id">{{ shortId(selectedOrder.id) }}</h2>
          </div>
          <button class="odm-close" @click="closeDetail">✕</button>
        </div>

        <div v-if="detailLoading" class="odm-loading">
          <span class="odm-spinner"></span>
          <span class="muted small">Memuat detail...</span>
        </div>

        <template v-else>
          <!-- Meta grid -->
          <div class="odm-meta-grid">
            <div class="odm-meta-card">
              <span class="odm-meta-icon">👤</span>
              <div>
                <span class="odm-meta-label">Pelanggan</span>
                <strong class="odm-meta-value">{{ selectedOrder.customer_name || 'Umum' }}</strong>
              </div>
            </div>
            <div class="odm-meta-card">
              <span class="odm-meta-icon">{{ selectedOrder.payment_method === 'cash' ? '💵' : selectedOrder.payment_method === 'transfer' ? '🏦' : selectedOrder.payment_method === 'qris' ? '📲' : '💳' }}</span>
              <div>
                <span class="odm-meta-label">Metode</span>
                <strong class="odm-meta-value">{{ paymentLabel[selectedOrder.payment_method] || selectedOrder.payment_method || '-' }}</strong>
              </div>
            </div>
            <div
              class="odm-meta-card"
              :style="selectedOrder.order_type === 'dine_in' ? 'border-color:#93c5fd44;background:#eff6ff' : selectedOrder.order_type === 'takeaway' ? 'border-color:#fde68a44;background:#fffbeb' : 'border-color:#bbf7d044;background:#f0fdf4'"
            >
              <span class="odm-meta-icon">{{ selectedOrder.order_type === 'dine_in' ? '🍽️' : selectedOrder.order_type === 'takeaway' ? '🛍️' : '🛵' }}</span>
              <div>
                <span class="odm-meta-label">Tipe</span>
                <strong class="odm-meta-value" :style="selectedOrder.order_type === 'dine_in' ? 'color:#2563eb' : selectedOrder.order_type === 'takeaway' ? 'color:#d97706' : 'color:#16a34a'">
                  {{ orderTypeLabel[selectedOrder.order_type] || selectedOrder.order_type || '-' }}
                </strong>
              </div>
            </div>
            <div class="odm-meta-card">
              <span class="odm-meta-icon">🕐</span>
              <div>
                <span class="odm-meta-label">Waktu</span>
                <strong class="odm-meta-value odm-time">
                  {{ new Date(selectedOrder.paid_at || selectedOrder.created_at).toLocaleString('id-ID') }}
                </strong>
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
                <span class="odm-item-price">{{ fmt(item.subtotal || item.qty * item.unit_price) }}</span>
              </div>
            </div>
          </div>
          <div v-else class="odm-no-items muted small">Detail item tidak tersedia.</div>

          <!-- Summary -->
          <div class="odm-summary">
            <div class="odm-summary-row">
              <span>Subtotal</span>
              <span>{{ fmt(selectedOrder.subtotal || selectedOrder.total) }}</span>
            </div>
            <div class="odm-summary-row">
              <span>Dibayar</span>
              <span>{{ fmt(selectedOrder.paid_amount) }}</span>
            </div>
            <div class="odm-summary-divider"></div>
            <div class="odm-summary-row odm-summary-total">
              <span>Kembalian</span>
              <strong>{{ fmt(selectedOrder.change_amount || 0) }}</strong>
            </div>
          </div>

          <div v-if="selectedOrder.notes" class="odm-notes">
            <span>📝</span>
            <span>{{ selectedOrder.notes }}</span>
          </div>

          <!-- Actions -->
          <div class="odm-actions">
            <button class="btn btn-secondary" @click="closeDetail">← Kembali</button>
            <button class="btn btn-dark" :disabled="printingReceipt" @click="printReceipt">
              <span v-if="printingReceipt">Mencetak...</span>
              <span v-else>🖨️ Cetak Struk</span>
            </button>
          </div>
        </template>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* ── Month navigator ─────────────────────────────────── */
.month-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--card);
  border: 1.5px solid var(--line);
  border-radius: var(--r-xl);
  padding: 12px 16px;
}

.month-nav-label {
  font-size: 16px;
  font-weight: 800;
  color: var(--text);
  letter-spacing: -0.01em;
}

.month-nav-btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1.5px solid var(--line);
  background: var(--bg-soft);
  font-size: 18px;
  font-weight: 700;
  color: var(--text-2);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
}
.month-nav-btn:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); }
.month-nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }

/* ── Day chips ───────────────────────────────────────── */
.day-chips-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  margin: 0 -4px;
  padding: 0 4px;
}
.day-chips-wrap::-webkit-scrollbar { display: none; }

.day-chips {
  display: flex;
  gap: 8px;
  white-space: nowrap;
  padding-bottom: 2px;
}

.day-chip {
  display: inline-flex;
  align-items: center;
  padding: 7px 16px;
  border-radius: 999px;
  border: 1.5px solid var(--line);
  background: var(--card);
  color: var(--text-2);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
  flex-shrink: 0;
  font: inherit;
}
.day-chip:hover { border-color: var(--primary); color: var(--primary); }
.day-chip.active {
  background: var(--text);
  border-color: var(--text);
  color: #fff;
}

/* ── Transaction group ───────────────────────────────── */
.trx-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.trx-group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 2px;
}

.trx-group-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--muted);
  text-transform: capitalize;
}

.trx-group-total {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-2);
}

/* ── Transaction card (compact) ──────────────────────── */
.trx-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.trx-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 14px;
  border-radius: 14px;
  border: 1.5px solid var(--line);
  background: var(--card);
  cursor: pointer;
  text-align: left;
  width: 100%;
  font: inherit;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.trx-card:hover {
  border-color: var(--line-strong);
  box-shadow: var(--shadow-sm);
}
.trx-card:active { background: var(--bg-soft); }

.trx-card-left {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.trx-card-top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.trx-card-id {
  font-size: 14px;
  font-weight: 800;
  color: var(--text);
}

.trx-card-badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 1px 7px;
  border-radius: 999px;
}
.trx-badge-paid {
  background: var(--success-bg);
  color: var(--success);
  border: 1px solid #bbf7d0;
}
.trx-badge-open {
  background: #fef2f2;
  color: var(--danger);
  border: 1px solid #fecaca;
}

.trx-card-meta {
  font-size: 12px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trx-card-total {
  font-size: 14px;
  font-weight: 800;
  color: var(--text);
  white-space: nowrap;
  flex-shrink: 0;
}

/* ── Order Detail Modal ──────────────────────────────── */
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

.odm-header { display: flex; justify-content: space-between; align-items: flex-start; }
.odm-header-left { display: flex; flex-direction: column; gap: 2px; }
.odm-eyebrow { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); }
.odm-id { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; margin: 0; color: var(--text); }

.odm-close {
  width: 36px; height: 36px; border-radius: 10px;
  border: 1.5px solid var(--line); background: var(--bg-soft);
  font-size: 14px; color: var(--muted);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; flex-shrink: 0; transition: all 0.15s;
}
.odm-close:hover { background: #fef2f2; color: var(--danger); border-color: var(--danger); }

.odm-loading { display: flex; align-items: center; gap: 10px; justify-content: center; padding: 24px 0; color: var(--muted); }
.odm-spinner {
  width: 18px; height: 18px;
  border: 2px solid var(--line-strong); border-top-color: var(--primary);
  border-radius: 50%; animation: odm-spin 0.7s linear infinite;
}
@keyframes odm-spin { to { transform: rotate(360deg); } }

.odm-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.odm-meta-card {
  display: flex; align-items: center; gap: 10px;
  padding: 12px; border-radius: 14px;
  background: var(--bg-soft); border: 1.5px solid var(--line);
}
.odm-meta-icon { font-size: 20px; line-height: 1; flex-shrink: 0; }
.odm-meta-label { display: block; font-size: 11px; color: var(--muted); font-weight: 600; margin-bottom: 2px; }
.odm-meta-value { display: block; font-size: 14px; font-weight: 700; color: var(--text); line-height: 1.3; }
.odm-time { font-size: 12px !important; }

.odm-items { border-radius: 14px; border: 1.5px solid var(--line); overflow: hidden; }
.odm-items-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 14px; background: var(--bg-soft); border-bottom: 1px solid var(--line);
}
.odm-items-count { font-size: 12px; font-weight: 600; color: var(--muted); background: var(--line); padding: 2px 8px; border-radius: 999px; }

.odm-item-list { display: flex; flex-direction: column; }
.odm-item-row {
  display: grid; grid-template-columns: 36px 1fr auto; align-items: center;
  gap: 8px; padding: 11px 14px; border-bottom: 1px solid var(--line); font-size: 14px;
}
.odm-item-row:last-child { border-bottom: none; }
.odm-item-qty-badge {
  width: 30px; height: 30px; border-radius: 8px;
  background: var(--primary-light); color: var(--primary-dark);
  font-size: 12px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
}
.odm-item-name { font-weight: 600; }
.odm-item-price { font-weight: 700; white-space: nowrap; }
.odm-no-items { text-align: center; padding: 12px; }

.odm-summary {
  border-radius: 14px; border: 1.5px solid var(--line);
  padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; background: var(--bg-soft);
}
.odm-summary-row { display: flex; justify-content: space-between; align-items: center; font-size: 14px; color: var(--text-2); }
.odm-summary-divider { height: 1px; background: var(--line); margin: 2px 0; }
.odm-summary-total { font-size: 15px; color: var(--text); }
.odm-summary-total strong { font-size: 18px; font-weight: 800; color: var(--primary-dark); }

.odm-notes {
  display: flex; gap: 8px; align-items: flex-start;
  font-size: 13px; color: var(--text-2); padding: 10px 12px;
  border-radius: 10px; background: var(--warning-bg); border: 1px solid #fde68a; line-height: 1.5;
}

.odm-actions { display: grid; grid-template-columns: 1fr 1.4fr; gap: 10px; }
</style>

<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const supabase = useSupabaseClient()
const workspace = useWorkspace()

const date = ref(new Date().toISOString().slice(0, 10))
const summary = ref<any | null>(null)
const orders = ref<any[]>([])
const expenses = ref<any[]>([])
const loading = ref(false)
const errorMessage = ref('')

// Detail panel
const selectedOrder = ref<any | null>(null)
const detailLoading = ref(false)
const printingReceipt = ref(false)
const showAll = ref(false)

const PREVIEW_LIMIT = 5

const formatCurrency = (value: number) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`
const formatDateTime = (value: string) => new Date(value).toLocaleString('id-ID')

// Computed KPIs
const omzet = computed(() => Number(summary.value?.gross_sales || 0))
const hpp = computed(() => Number(summary.value?.cogs || 0))
const pengeluaran = computed(() => Number(summary.value?.expenses_amount || 0))
const profit = computed(() => omzet.value - hpp.value - pengeluaran.value)

const visibleOrders = computed(() =>
  showAll.value ? orders.value : orders.value.slice(0, PREVIEW_LIMIT)
)
const hiddenCount = computed(() => Math.max(0, orders.value.length - PREVIEW_LIMIT))

const load = async () => {
  if (!workspace.activeOutletId.value) return
  loading.value = true
  errorMessage.value = ''
  showAll.value = false

  try {
    const [summaryRes, orderRes, expenseRes] = await Promise.all([
      supabase
        .from('vw_daily_sales_summary')
        .select('*')
        .eq('outlet_id', workspace.activeOutletId.value)
        .eq('business_date', date.value)
        .maybeSingle(),
      supabase
        .from('orders')
        .select('id, order_no, customer_name, payment_method, total, paid_at, status')
        .eq('outlet_id', workspace.activeOutletId.value)
        .gte('paid_at', `${date.value}T00:00:00`)
        .lte('paid_at', `${date.value}T23:59:59`)
        .eq('status', 'paid')
        .order('paid_at', { ascending: false }),
      supabase
        .from('expenses')
        .select('id, category, description, amount, spent_at')
        .eq('outlet_id', workspace.activeOutletId.value)
        .gte('spent_at', `${date.value}T00:00:00`)
        .lte('spent_at', `${date.value}T23:59:59`)
        .order('spent_at', { ascending: false })
    ])

    if (summaryRes.error) throw summaryRes.error
    if (orderRes.error) throw orderRes.error
    if (expenseRes.error) throw expenseRes.error

    summary.value = summaryRes.data
    orders.value = orderRes.data || []
    expenses.value = expenseRes.data || []
  } catch (error: any) {
    errorMessage.value = error?.message || 'Gagal memuat laporan harian.'
  } finally {
    loading.value = false
  }
}

const openDetail = async (order: any) => {
  selectedOrder.value = { ...order }
  detailLoading.value = true
  try {
    const { orderService } = await import('~/services/order.service')
    const raw = await orderService.getOrderDetails(order.id)
    if (raw?.order_items) {
      raw.order_items = raw.order_items.map((item: any) => ({
        ...item,
        item_name: item.item_name || item.product_name || '-',
        qty: item.qty || item.quantity || 0,
        unit_price: item.unit_price || item.product_price || 0
      }))
    }
    selectedOrder.value = { ...raw, payment_method: raw.payment_method || order.payment_method }
  } catch {
    // keep basic order data
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

onMounted(async () => {
  await workspace.bootstrap()
  await load()
})

watch([() => workspace.activeOutletId.value, date], async () => {
  await load()
})
</script>

<template>
  <div class="page">

    <!-- Header -->
    <section class="section-title">
      <div>
        <h1 class="title">Laporan Harian</h1>
        <p class="subtitle">Ringkasan penjualan, modal, dan profit per tanggal.</p>
      </div>
      <div class="toolbar">
        <input v-model="date" class="input" type="date" />
        <button class="btn btn-secondary" :disabled="loading" @click="load">
          {{ loading ? 'Memuat...' : 'Refresh' }}
        </button>
      </div>
    </section>

    <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>
    <div v-if="loading" class="empty-state">Memuat laporan...</div>

    <template v-else>

      <!-- 4 KPI Cards -->
      <div class="kpi-grid">
        <article class="kpi-card kpi-omzet">
          <h3>Total Omzet</h3>
          <div class="value">{{ formatCurrency(omzet) }}</div>
          <div class="hint">Semua transaksi paid</div>
        </article>
        <article class="kpi-card kpi-hpp">
          <h3>HPP / Modal</h3>
          <div class="value">{{ formatCurrency(hpp) }}</div>
          <div class="hint">Modal produk terjual</div>
        </article>
        <article class="kpi-card kpi-expense">
          <h3>Pengeluaran</h3>
          <div class="value">{{ formatCurrency(pengeluaran) }}</div>
          <div class="hint">Biaya operasional</div>
        </article>
        <article class="kpi-card kpi-profit" :class="profit >= 0 ? 'profit-pos' : 'profit-neg'">
          <h3>Keuntungan Bersih</h3>
          <div class="value">{{ formatCurrency(profit) }}</div>
          <div class="hint">Omzet − HPP − Pengeluaran</div>
        </article>
      </div>

      <!-- Transaksi Section -->
      <section class="card daily-tx-section">
        <div class="daily-tx-header">
          <div>
            <h2 class="daily-tx-title">Transaksi Hari Ini</h2>
            <p class="subtitle" style="margin:2px 0 0;">{{ orders.length }} transaksi paid</p>
          </div>
        </div>

        <div v-if="!orders.length" class="empty-state">Belum ada transaksi paid pada tanggal ini.</div>

        <template v-else>
          <!-- Desktop table -->
          <div class="table-wrap desktop-table-only">
            <table class="table">
              <thead>
                <tr><th>Order</th><th>Pelanggan</th><th>Metode</th><th>Waktu</th><th>Total</th></tr>
              </thead>
              <tbody>
                <tr
                  v-for="order in visibleOrders"
                  :key="order.id"
                  class="table-row-clickable"
                  @click="openDetail(order)"
                >
                  <td><strong>{{ order.order_no }}</strong></td>
                  <td>{{ order.customer_name || 'Umum' }}</td>
                  <td><span class="method-badge">{{ order.payment_method }}</span></td>
                  <td>{{ formatDateTime(order.paid_at) }}</td>
                  <td><strong>{{ formatCurrency(order.total) }}</strong></td>
                </tr>
              </tbody>
            </table>
            <button v-if="!showAll && hiddenCount > 0" class="btn-show-more" @click="showAll = true">
              Lihat {{ hiddenCount }} transaksi lainnya ↓
            </button>
            <button v-if="showAll && orders.length > PREVIEW_LIMIT" class="btn-show-more" @click="showAll = false">
              Sembunyikan ↑
            </button>
          </div>

          <!-- Mobile compact cards -->
          <div class="tx-card-list mobile-card-only">
            <article
              v-for="order in visibleOrders"
              :key="order.id"
              class="tx-card"
              @click="openDetail(order)"
            >
              <div class="tx-card-left">
                <span class="tx-order-no">{{ order.order_no }}</span>
                <span class="tx-meta">{{ order.customer_name || 'Umum' }} · {{ order.payment_method }}</span>
              </div>
              <div class="tx-card-right">
                <strong class="tx-total">{{ formatCurrency(order.total) }}</strong>
                <span class="tx-time">{{ formatDateTime(order.paid_at) }}</span>
              </div>
              <span class="tx-chevron">›</span>
            </article>

            <button v-if="!showAll && hiddenCount > 0" class="btn-show-more" @click="showAll = true">
              Dan {{ hiddenCount }} transaksi lainnya ↓
            </button>
            <button v-if="showAll && orders.length > PREVIEW_LIMIT" class="btn-show-more" @click="showAll = false">
              Sembunyikan ↑
            </button>
          </div>
        </template>
      </section>

    </template>

    <!-- Detail Panel Overlay -->
    <Teleport to="body">
      <div v-if="selectedOrder" class="detail-overlay" @click.self="closeDetail">
        <div class="detail-panel">

          <div class="detail-header">
            <button class="btn-back" @click="closeDetail">‹ Kembali</button>
            <span class="detail-header-title">Detail Pesanan</span>
            <button class="btn btn-dark detail-print-btn" :disabled="printingReceipt" @click="printReceipt">
              {{ printingReceipt ? 'Mencetak...' : '🖨️ Cetak Struk' }}
            </button>
          </div>

          <div v-if="detailLoading" class="detail-loading">Memuat detail...</div>

          <div v-else class="detail-body">
            <div class="detail-info-block">
              <div class="detail-info-row">
                <span class="detail-label">No. Order</span>
                <strong class="detail-value">{{ selectedOrder.order_no }}</strong>
              </div>
              <div class="detail-info-row">
                <span class="detail-label">Pelanggan</span>
                <span class="detail-value">{{ selectedOrder.customer_name || 'Umum' }}</span>
              </div>
              <div class="detail-info-row">
                <span class="detail-label">Metode Bayar</span>
                <span class="method-badge">{{ selectedOrder.payment_method }}</span>
              </div>
              <div class="detail-info-row">
                <span class="detail-label">Waktu</span>
                <span class="detail-value">{{ formatDateTime(selectedOrder.paid_at) }}</span>
              </div>
            </div>

            <div v-if="selectedOrder.order_items?.length" class="detail-items">
              <p class="detail-section-label">Pesanan ({{ selectedOrder.order_items.length }} item)</p>
              <div class="detail-item-list">
                <div v-for="item in selectedOrder.order_items" :key="item.id" class="detail-item-row">
                  <div class="detail-item-qty">{{ item.qty }}×</div>
                  <span class="detail-item-name">{{ item.item_name }}</span>
                  <span class="detail-item-price">{{ formatCurrency(item.subtotal || item.qty * item.unit_price) }}</span>
                </div>
              </div>
            </div>

            <div class="detail-total-row">
              <span>Total</span>
              <strong class="detail-total-value">{{ formatCurrency(selectedOrder.total) }}</strong>
            </div>

            <div v-if="selectedOrder.notes" class="detail-notes">
              <span class="detail-label">Catatan</span>
              <p>{{ selectedOrder.notes }}</p>
            </div>
          </div>

        </div>
      </div>
    </Teleport>

  </div>
</template>

<style scoped>
/* KPI Grid */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
@media (min-width: 768px) {
  .kpi-grid { grid-template-columns: repeat(4, 1fr); }
}
.kpi-card { position: relative; overflow: hidden; }
.kpi-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  border-radius: 2px 2px 0 0;
}
.kpi-omzet::before  { background: #3b82f6; }
.kpi-hpp::before    { background: #f59e0b; }
.kpi-expense::before{ background: #ef4444; }
.kpi-profit::before { background: #22c55e; }
.profit-neg::before { background: #ef4444; }
.kpi-profit .value  { color: #16a34a; }
.profit-neg .value  { color: #dc2626; }

/* Transaksi Section */
.daily-tx-section { display: grid; gap: 12px; }
.daily-tx-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.daily-tx-title  { font-size: 16px; font-weight: 700; margin: 0; }

.table-row-clickable { cursor: pointer; }
.table-row-clickable:hover { background: var(--bg-soft); }

.method-badge {
  display: inline-block;
  padding: 2px 8px;
  background: var(--bg-soft);
  border: 1px solid var(--line);
  border-radius: 20px;
  font-size: 11px;
  text-transform: capitalize;
}

/* Mobile Compact Cards */
.tx-card-list { display: grid; gap: 0; }
.tx-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
  cursor: pointer;
  transition: background 0.12s;
  position: relative;
}
.tx-card:last-of-type { border-bottom: none; }
.tx-card:hover { background: var(--bg-soft); }
.tx-card-left  { flex: 1; min-width: 0; display: grid; gap: 1px; }
.tx-order-no   { font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tx-meta       { font-size: 11px; color: var(--text-2); text-transform: capitalize; }
.tx-card-right { display: grid; gap: 1px; text-align: right; flex-shrink: 0; }
.tx-total      { font-size: 13px; font-weight: 700; }
.tx-time       { font-size: 10px; color: var(--text-2); }
.tx-chevron    { font-size: 18px; color: var(--text-2); line-height: 1; }

.btn-show-more {
  display: block;
  width: 100%;
  padding: 10px;
  margin-top: 4px;
  background: none;
  border: none;
  color: var(--primary, #e07b2e);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  text-align: center;
}
.btn-show-more:hover { text-decoration: underline; }

/* Detail Overlay */
.detail-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}
@media (min-width: 768px) {
  .detail-overlay { align-items: center; justify-content: center; }
}
.detail-panel {
  background: var(--bg);
  border-radius: 20px 20px 0 0;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}
@media (min-width: 768px) {
  .detail-panel { border-radius: 16px; width: 480px; max-height: 80vh; }
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px;
  border-bottom: 1px solid var(--line);
  position: sticky;
  top: 0;
  background: var(--bg);
  z-index: 1;
}
.btn-back {
  background: none;
  border: none;
  font-size: 15px;
  font-weight: 600;
  color: var(--primary, #e07b2e);
  cursor: pointer;
  padding: 0;
  white-space: nowrap;
}
.detail-header-title { flex: 1; font-size: 15px; font-weight: 700; text-align: center; }
.detail-print-btn    { font-size: 12px; padding: 6px 10px; white-space: nowrap; }
.detail-loading      { padding: 32px; text-align: center; color: var(--text-2); }

.detail-body { padding: 16px; display: grid; gap: 16px; }

.detail-info-block {
  display: grid;
  gap: 10px;
  padding: 14px;
  background: var(--bg-soft);
  border-radius: var(--r-lg);
  border: 1px solid var(--line);
}
.detail-info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
}
.detail-label { color: var(--text-2); }
.detail-value { font-size: 13px; text-align: right; }

.detail-section-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 8px;
}
.detail-items    { display: grid; gap: 4px; }
.detail-item-list{ display: grid; gap: 8px; }
.detail-item-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.detail-item-qty {
  background: var(--bg-soft);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 700;
  min-width: 28px;
  text-align: center;
}
.detail-item-name  { flex: 1; }
.detail-item-price { font-weight: 600; white-space: nowrap; }

.detail-total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-top: 1.5px solid var(--line);
  font-size: 15px;
  font-weight: 700;
}
.detail-total-value { font-size: 18px; }

.detail-notes { font-size: 13px; color: var(--text-2); display: grid; gap: 4px; }
.detail-notes p { margin: 0; color: var(--text); }
</style>

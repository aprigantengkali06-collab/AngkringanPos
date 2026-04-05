<script setup lang="ts">
import { orderService } from '~/services/order.service'

definePageMeta({ middleware: ['auth'] })

const workspace = useWorkspace()
const orders = ref<any[]>([])
const loading = ref(false)
const detailLoading = ref(false)
const errorMessage = ref('')
const selectedOrder = ref<any | null>(null)

const formatCurrency = (value: number) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`
const formatDateTime = (value?: string | null) => value ? new Date(value).toLocaleString('id-ID') : '-'

const load = async () => {
  if (!workspace.activeOutletId.value) return
  loading.value = true
  errorMessage.value = ''

  try {
    orders.value = await orderService.listLatest(workspace.activeOutletId.value, 100)
  } catch (error: any) {
    errorMessage.value = error?.message || 'Gagal memuat daftar transaksi.'
  } finally {
    loading.value = false
  }
}

const openDetails = async (orderId: string) => {
  detailLoading.value = true
  errorMessage.value = ''

  try {
    selectedOrder.value = await orderService.getOrderDetails(orderId)
  } catch (error: any) {
    errorMessage.value = error?.message || 'Gagal memuat detail transaksi.'
  } finally {
    detailLoading.value = false
  }
}

const totalRevenue = computed(() => orders.value.reduce((sum, order) => sum + Number(order.total || 0), 0))
const cashCount = computed(() => orders.value.filter((order) => order.payment_method === 'cash').length)
const qrisCount = computed(() => orders.value.filter((order) => order.payment_method === 'qris').length)
const transferCount = computed(() => orders.value.filter((order) => order.payment_method === 'transfer').length)
const paidCount = computed(() => orders.value.filter((item) => item.status === 'paid').length)

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
        <h1 class="title">Riwayat Transaksi</h1>
        <p class="subtitle">Data transaksi sekarang membaca field schema terbaru, jadi nomor order, nominal bayar, dan kembalian tampil konsisten dengan data Supabase.</p>
      </div>
      <div class="toolbar page-header-actions">
        <button class="btn btn-secondary" :disabled="loading" @click="load">
          {{ loading ? 'Memuat...' : 'Refresh' }}
        </button>
      </div>
    </section>

    <div class="grid grid-4">
      <article class="kpi-card"><h3>Total transaksi</h3><div class="value">{{ orders.length }}</div><div class="hint">100 transaksi terakhir outlet aktif</div></article>
      <article class="kpi-card"><h3>Omzet</h3><div class="value">{{ formatCurrency(totalRevenue) }}</div><div class="hint">Akumulasi dari daftar transaksi</div></article>
      <article class="kpi-card"><h3>Cash / QRIS</h3><div class="value">{{ cashCount }} / {{ qrisCount }}</div><div class="hint">Transfer: {{ transferCount }}</div></article>
      <article class="kpi-card"><h3>Status paid</h3><div class="value">{{ paidCount }}</div><div class="hint">Transaksi berstatus paid</div></article>
    </div>

    <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>
    <div v-if="loading" class="empty-state">Memuat transaksi...</div>

    <section v-else class="card stack">
      <div v-if="!orders.length" class="empty-state">Belum ada transaksi pada outlet ini.</div>

      <template v-else>
        <div class="table-wrap desktop-table-only">
          <table class="table">
            <thead>
              <tr>
                <th>No. Order</th>
                <th>Pelanggan</th>
                <th>Tipe</th>
                <th>Metode</th>
                <th>Dibayar</th>
                <th>Kembalian</th>
                <th>Waktu</th>
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="order in orders" :key="order.id">
                <td>
                  <strong>{{ order.order_no }}</strong>
                  <div class="small muted">{{ order.status }}</div>
                </td>
                <td>{{ order.customer_name || 'Umum' }}</td>
                <td>{{ order.order_type }}</td>
                <td>{{ order.payment_method }}</td>
                <td>{{ formatCurrency(order.paid_amount) }}</td>
                <td>{{ formatCurrency(order.change_amount) }}</td>
                <td>{{ formatDateTime(order.paid_at || order.created_at) }}</td>
                <td><strong>{{ formatCurrency(order.total) }}</strong></td>
                <td><button class="btn btn-secondary" @click="openDetails(order.id)">Detail</button></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="management-card-list mobile-card-only">
          <article v-for="order in orders" :key="order.id" class="management-card compact-card">
            <div class="management-card-top">
              <div>
                <h3>{{ order.order_no }}</h3>
                <p class="muted small">{{ order.customer_name || 'Umum' }} · {{ order.payment_method }} · {{ order.order_type }}</p>
              </div>
              <span class="badge" :class="order.status === 'paid' ? 'badge-success' : 'badge-neutral'">{{ order.status }}</span>
            </div>

            <div class="management-card-stats detail-grid-2">
              <div>
                <span class="muted small">Dibayar</span>
                <strong>{{ formatCurrency(order.paid_amount) }}</strong>
              </div>
              <div>
                <span class="muted small">Kembalian</span>
                <strong>{{ formatCurrency(order.change_amount) }}</strong>
              </div>
              <div>
                <span class="muted small">Waktu</span>
                <strong>{{ formatDateTime(order.paid_at || order.created_at) }}</strong>
              </div>
              <div>
                <span class="muted small">Total</span>
                <strong>{{ formatCurrency(order.total) }}</strong>
              </div>
            </div>

            <div class="toolbar form-actions-row">
              <button class="btn btn-secondary" :disabled="detailLoading" @click="openDetails(order.id)">
                {{ detailLoading && selectedOrder?.id !== order.id ? 'Memuat...' : 'Lihat detail' }}
              </button>
            </div>
          </article>
        </div>
      </template>
    </section>

    <div v-if="selectedOrder" class="modal-backdrop" @click="selectedOrder = null">
      <div class="modal-card stack" @click.stop>
        <div class="section-title">
          <div>
            <h2 style="margin:0">{{ selectedOrder.order_no }}</h2>
            <p class="subtitle">{{ selectedOrder.customer_name || 'Umum' }} · {{ selectedOrder.payment_method }} · {{ formatDateTime(selectedOrder.paid_at || selectedOrder.created_at) }}</p>
          </div>
          <button class="btn btn-secondary" @click="selectedOrder = null">Tutup</button>
        </div>

        <div class="summary-list order-summary-list">
          <div class="summary-row"><span class="muted">Subtotal</span><strong>{{ formatCurrency(selectedOrder.subtotal || 0) }}</strong></div>
          <div class="summary-row"><span class="muted">Dibayar</span><strong>{{ formatCurrency(selectedOrder.paid_amount || 0) }}</strong></div>
          <div class="summary-row"><span class="muted">Kembalian</span><strong>{{ formatCurrency(selectedOrder.change_amount || 0) }}</strong></div>
          <div class="summary-row total"><span>Total</span><span>{{ formatCurrency(selectedOrder.total || 0) }}</span></div>
        </div>

        <div class="table-wrap" v-if="selectedOrder.order_items?.length">
          <table class="table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Harga</th>
                <th>Subtotal</th>
                <th>Catatan</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in selectedOrder.order_items || []" :key="item.id">
                <td>{{ item.item_name }}</td>
                <td>{{ item.qty }}</td>
                <td>{{ formatCurrency(item.unit_price) }}</td>
                <td>{{ formatCurrency(item.subtotal) }}</td>
                <td>{{ item.notes || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="empty-state">Item transaksi tidak ditemukan.</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { orderService } from '~/services/order.service'
definePageMeta({ middleware: ['auth'] })

const workspace = useWorkspace()
const orders = ref<any[]>([])
const loading = ref(false)
const errorMessage = ref('')
const selectedOrder = ref<any | null>(null)

const formatCurrency = (value: number) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`

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
  selectedOrder.value = await orderService.getOrderDetails(orderId)
}

const totalRevenue = computed(() => orders.value.reduce((sum, order) => sum + Number(order.total || 0), 0))
const cashCount = computed(() => orders.value.filter((order) => order.payment_method === 'cash').length)
const qrisCount = computed(() => orders.value.filter((order) => order.payment_method === 'qris').length)
const transferCount = computed(() => orders.value.filter((order) => order.payment_method === 'transfer').length)

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
        <p class="subtitle">Seluruh transaksi terbaru tersusun rapi untuk audit harian, pengecekan order, dan rekap pembayaran.</p>
      </div>
      <button class="btn btn-secondary" @click="load">Refresh</button>
    </section>

    <div class="grid grid-4">
      <article class="kpi-card"><h3>Total transaksi</h3><div class="value">{{ orders.length }}</div><div class="hint">100 transaksi terakhir outlet aktif</div></article>
      <article class="kpi-card"><h3>Omzet</h3><div class="value">{{ formatCurrency(totalRevenue) }}</div><div class="hint">Akumulasi dari daftar di bawah</div></article>
      <article class="kpi-card"><h3>Cash / QRIS</h3><div class="value">{{ cashCount }} / {{ qrisCount }}</div><div class="hint">Transfer: {{ transferCount }}</div></article>
      <article class="kpi-card"><h3>Status paid</h3><div class="value">{{ orders.filter((item) => item.status === 'paid').length }}</div><div class="hint">Semua transaksi berhasil dibayar</div></article>
    </div>

    <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>
    <div v-if="loading" class="empty-state">Memuat transaksi...</div>

    <section v-else class="card stack">
      <div v-if="!orders.length" class="empty-state">Belum ada transaksi pada outlet ini.</div>
      <div v-else class="table-wrap">
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
              <td>{{ new Date(order.created_at).toLocaleString('id-ID') }}</td>
              <td><strong>{{ formatCurrency(order.total) }}</strong></td>
              <td><button class="btn btn-secondary" @click="openDetails(order.id)">Detail</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div v-if="selectedOrder" class="modal-backdrop" @click="selectedOrder = null">
      <div class="modal-card stack" @click.stop>
        <div class="section-title">
          <div>
            <h2 style="margin:0">{{ selectedOrder.order_no }}</h2>
            <p class="subtitle">{{ selectedOrder.customer_name || 'Umum' }} · {{ selectedOrder.payment_method }} · {{ new Date(selectedOrder.created_at).toLocaleString('id-ID') }}</p>
          </div>
          <button class="btn btn-secondary" @click="selectedOrder = null">Tutup</button>
        </div>

        <div class="table-wrap">
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
      </div>
    </div>
  </div>
</template>

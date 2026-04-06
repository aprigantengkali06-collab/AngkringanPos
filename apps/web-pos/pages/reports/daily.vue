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

const formatCurrency = (value: number) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`

const load = async () => {
  if (!workspace.activeOutletId.value) return
  loading.value = true
  errorMessage.value = ''

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
    <section class="section-title">
      <div>
        <h1 class="title">Laporan Harian</h1>
        <p class="subtitle">Ringkasan penjualan, biaya, dan kas bersih per tanggal outlet aktif.</p>
      </div>
      <div class="toolbar">
        <input v-model="date" class="input" type="date" />
        <button class="btn btn-secondary" @click="load">Refresh</button>
      </div>
    </section>

    <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>
    <div v-if="loading" class="empty-state">Memuat laporan...</div>

    <template v-else>
      <div class="grid grid-4">
        <article class="kpi-card"><h3>Gross sales</h3><div class="value">{{ formatCurrency(summary?.gross_sales || 0) }}</div><div class="hint">Dari semua order paid</div></article>
        <article class="kpi-card"><h3>COGS</h3><div class="value">{{ formatCurrency(summary?.cogs || 0) }}</div><div class="hint">Akumulasi modal menu terjual</div></article>
        <article class="kpi-card"><h3>Pengeluaran</h3><div class="value">{{ formatCurrency(summary?.expenses_amount || 0) }}</div><div class="hint">Biaya operasional tanggal ini</div></article>
        <article class="kpi-card"><h3>Kas bersih</h3><div class="value">{{ formatCurrency(summary?.net_cash || 0) }}</div><div class="hint">Omzet - modal - pengeluaran</div></article>
      </div>

      <div class="grid grid-2">
        <section class="card stack">
          <div>
            <h2 style="margin:0">Transaksi tanggal terpilih</h2>
            <p class="subtitle">Semua transaksi paid yang masuk pada tanggal tersebut.</p>
          </div>
          <div v-if="!orders.length" class="empty-state">Belum ada transaksi paid pada tanggal ini.</div>
          <template v-else>
            <div class="table-wrap desktop-table-only">
              <table class="table">
                <thead><tr><th>Order</th><th>Pelanggan</th><th>Metode</th><th>Waktu</th><th>Total</th></tr></thead>
                <tbody>
                  <tr v-for="order in orders" :key="order.id">
                    <td><strong>{{ order.order_no }}</strong></td>
                    <td>{{ order.customer_name || 'Umum' }}</td>
                    <td>{{ order.payment_method }}</td>
                    <td>{{ new Date(order.paid_at).toLocaleString('id-ID') }}</td>
                    <td><strong>{{ formatCurrency(order.total) }}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="management-card-list mobile-card-only">
              <article v-for="order in orders" :key="order.id" class="management-card compact-card">
                <div class="management-card-top">
                  <div style="min-width:0;">
                    <h3 style="font-size:13px; word-break:break-all;">{{ order.order_no }}</h3>
                    <p class="management-card-description">{{ order.customer_name || 'Umum' }} · {{ order.payment_method }}</p>
                  </div>
                  <strong style="white-space:nowrap; flex-shrink:0;">{{ formatCurrency(order.total) }}</strong>
                </div>
                <div class="muted small">{{ new Date(order.paid_at).toLocaleString('id-ID') }}</div>
              </article>
            </div>
          </template>
        </section>

        <section class="card stack">
          <div>
            <h2 style="margin:0">Pengeluaran tanggal terpilih</h2>
            <p class="subtitle">Pastikan semua biaya tercatat agar angka kas sesuai kenyataan.</p>
          </div>
          <div v-if="!expenses.length" class="empty-state">Tidak ada pengeluaran pada tanggal ini.</div>
          <template v-else>
            <div class="table-wrap desktop-table-only">
              <table class="table">
                <thead><tr><th>Kategori</th><th>Deskripsi</th><th>Waktu</th><th>Nominal</th></tr></thead>
                <tbody>
                  <tr v-for="expense in expenses" :key="expense.id">
                    <td><strong>{{ expense.category }}</strong></td>
                    <td>{{ expense.description }}</td>
                    <td>{{ new Date(expense.spent_at).toLocaleString('id-ID') }}</td>
                    <td><strong>{{ formatCurrency(expense.amount) }}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="management-card-list mobile-card-only">
              <article v-for="expense in expenses" :key="expense.id" class="management-card compact-card">
                <div class="management-card-top">
                  <div>
                    <h3 style="font-size:14px;">{{ expense.category }}</h3>
                    <p class="management-card-description">{{ expense.description || '-' }}</p>
                  </div>
                  <strong style="white-space:nowrap; flex-shrink:0;">{{ formatCurrency(expense.amount) }}</strong>
                </div>
                <div class="muted small">{{ new Date(expense.spent_at).toLocaleString('id-ID') }}</div>
              </article>
            </div>
          </template>
        </section>
      </div>
    </template>
  </div>
</template>

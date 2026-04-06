<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const supabase = useSupabaseClient()
const workspace = useWorkspace()

interface OrderPayment {
  id: string
  payment_method: string
  amount: number
  created_at: string
}

interface TagihanItem {
  id: string
  order_no: string
  customer_name: string
  order_type: string
  total: number
  paid_amount: number
  notes: string | null
  created_at: string
  order_items: { product_name: string; quantity: number; product_price: number; subtotal: number }[]
  order_payments: OrderPayment[]
}

const loading   = ref(false)
const tagihans  = ref<TagihanItem[]>([])
const error     = ref('')
const success   = ref('')

// Modal bayar
const showPayModal   = ref(false)
const selectedOrder  = ref<TagihanItem | null>(null)
const payAmount      = ref<number | null>(null)
const payMethod      = ref<'cash'|'transfer'|'qris'>('cash')
const payNotes       = ref('')
const paying         = ref(false)

const formatCurrency = (v: number) => `Rp ${Number(v || 0).toLocaleString('id-ID')}`
const formatTime     = (v: string) => new Date(v).toLocaleString('id-ID')

const load = async () => {
  if (!workspace.activeOutletId.value) return
  loading.value = true
  error.value = ''
  try {
    const { data, error: qErr } = await supabase
      .from('orders')
      .select('id, order_no, customer_name, order_type, total, paid_amount, notes, created_at, order_items(product_name, quantity, product_price, subtotal), order_payments(id, payment_method, amount, created_at)')
      .eq('outlet_id', workspace.activeOutletId.value)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
    if (qErr) throw qErr
    tagihans.value = (data || []) as TagihanItem[]
  } catch (e: any) {
    error.value = e?.message || 'Gagal memuat tagihan.'
  } finally {
    loading.value = false
  }
}

const sisaTagihan = (t: TagihanItem) => Math.max(0, t.total - t.paid_amount)

const openPay = (t: TagihanItem) => {
  selectedOrder.value = t
  payAmount.value = sisaTagihan(t)  // default: bayar sisa penuh
  payMethod.value = 'cash'
  payNotes.value = ''
  showPayModal.value = true
}

const closePay = () => { showPayModal.value = false; selectedOrder.value = null }

const submitPay = async () => {
  if (!selectedOrder.value || !payAmount.value || payAmount.value <= 0) return
  paying.value = true
  error.value = ''
  try {
    const { data, error: rpcErr } = await supabase.rpc('pay_tagihan_pos', {
      p_order_id: selectedOrder.value.id,
      p_amount:   payAmount.value,
      p_method:   payMethod.value,
      p_notes:    payNotes.value.trim() || null
    })
    if (rpcErr) throw rpcErr
    if (data?.ok === false) throw new Error(data.error)

    const isPaid = data?.status === 'paid'
    const kembalian = Number(data?.change || 0)

    success.value = isPaid
      ? `✓ Tagihan ${selectedOrder.value.customer_name} lunas!${kembalian > 0 ? ` Kembalian ${formatCurrency(kembalian)}.` : ''}`
      : `✓ Bayar ${formatCurrency(payAmount.value)}. Sisa ${formatCurrency(data?.remaining || 0)}.`

    closePay()
    await load()
    setTimeout(() => { success.value = '' }, 4000)
  } catch (e: any) {
    error.value = e?.message || 'Gagal menyimpan pembayaran.'
  } finally {
    paying.value = false
  }
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

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error"   class="alert alert-danger">{{ error }}</div>

    <div v-if="loading" class="empty-state">Memuat tagihan...</div>

    <div v-else-if="!tagihans.length" class="tagihan-empty">
      <div class="tagihan-empty-icon">🧾</div>
      <p>Belum ada tagihan aktif.</p>
      <p class="muted small">Buat tagihan dari halaman Kasir dengan tombol "Bayar nanti".</p>
    </div>

    <div v-else class="tagihan-list">
      <article v-for="t in tagihans" :key="t.id" class="tagihan-card">

        <!-- Header -->
        <div class="tagihan-card-head">
          <div>
            <strong class="tagihan-nama">{{ t.customer_name }}</strong>
            <p class="muted small" style="margin:2px 0 0;">
              {{ t.order_no }} · {{ formatTime(t.created_at) }}
            </p>
          </div>
          <div class="tagihan-badge-wrap">
            <span v-if="t.paid_amount > 0" class="badge badge-warning">Sebagian</span>
            <span v-else class="badge">Belum bayar</span>
          </div>
        </div>

        <!-- Item list -->
        <div class="tagihan-items">
          <div v-for="item in t.order_items" :key="item.product_name + item.quantity" class="tagihan-item-row">
            <span>{{ item.product_name }}</span>
            <span class="muted small">{{ item.quantity }}x {{ formatCurrency(item.product_price) }}</span>
            <strong>{{ formatCurrency(item.subtotal) }}</strong>
          </div>
        </div>

        <!-- Riwayat bayar sebagian -->
        <div v-if="t.order_payments?.length" class="tagihan-payments">
          <p class="summary-label" style="margin-bottom:6px;">Sudah dibayar</p>
          <div v-for="p in t.order_payments" :key="p.id" class="tagihan-payment-row">
            <span class="muted small">{{ p.payment_method }} · {{ formatTime(p.created_at) }}</span>
            <strong class="paid-amount">{{ formatCurrency(p.amount) }}</strong>
          </div>
        </div>

        <!-- Footer total -->
        <div class="tagihan-footer">
          <div class="tagihan-total-row">
            <span class="muted small">Total tagihan</span>
            <strong>{{ formatCurrency(t.total) }}</strong>
          </div>
          <div v-if="t.paid_amount > 0" class="tagihan-total-row">
            <span class="muted small">Sudah dibayar</span>
            <strong class="paid-amount">{{ formatCurrency(t.paid_amount) }}</strong>
          </div>
          <div class="tagihan-total-row sisa">
            <span>Sisa tagihan</span>
            <strong>{{ formatCurrency(sisaTagihan(t)) }}</strong>
          </div>
        </div>

        <button class="btn btn-primary" style="width:100%;" @click="openPay(t)">
          Bayar sekarang
        </button>
      </article>
    </div>

    <!-- Modal bayar -->
    <div v-if="showPayModal && selectedOrder" class="modal-backdrop" @click.self="closePay">
      <div class="modal-card pay-modal">
        <div class="pay-modal-head">
          <div>
            <strong>{{ selectedOrder.customer_name }}</strong>
            <p class="muted small">Sisa: {{ formatCurrency(sisaTagihan(selectedOrder)) }}</p>
          </div>
          <button class="btn-icon-close" @click="closePay">✕</button>
        </div>

        <div class="stack" style="gap:10px;">
          <label class="field-label">Jumlah dibayar</label>
          <input
            v-model.number="payAmount"
            class="input pay-input"
            type="number"
            min="1"
            :max="sisaTagihan(selectedOrder)"
            placeholder="Masukkan jumlah"
          />
          <div class="quick-pay-row">
            <button class="btn btn-secondary" @click="payAmount = sisaTagihan(selectedOrder)">
              Bayar penuh
            </button>
          </div>
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

        <div v-if="error" class="alert alert-danger">{{ error }}</div>

        <div class="toolbar form-actions-row">
          <button class="btn btn-secondary" @click="closePay">Batal</button>
          <button
            class="btn btn-primary"
            :disabled="paying || !payAmount || payAmount <= 0"
            @click="submitPay"
          >
            {{ paying ? 'Menyimpan...' : `Bayar ${payAmount ? formatCurrency(payAmount) : ''}` }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.tagihan-empty {
  text-align: center;
  padding: 48px 24px;
  color: var(--text-2);
}
.tagihan-empty-icon { font-size: 40px; margin-bottom: 12px; }

.tagihan-list { display: grid; gap: 16px; }

.tagihan-card {
  background: var(--card);
  border: 1.5px solid var(--line);
  border-radius: var(--r-xl);
  padding: 18px;
  display: grid;
  gap: 14px;
}

.tagihan-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.tagihan-nama { font-size: 16px; font-weight: 700; }
.tagihan-badge-wrap { flex-shrink: 0; }

.tagihan-items {
  background: var(--bg-soft);
  border-radius: var(--r-lg);
  padding: 10px 12px;
  display: grid;
  gap: 6px;
}
.tagihan-item-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 10px;
  align-items: center;
  font-size: 13px;
}

.tagihan-payments {
  border-top: 1px solid var(--line);
  padding-top: 10px;
}
.tagihan-payment-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  margin-bottom: 4px;
}
.paid-amount { color: #16a34a; }

.tagihan-footer {
  border-top: 1.5px solid var(--line);
  padding-top: 10px;
  display: grid;
  gap: 6px;
}
.tagihan-total-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}
.tagihan-total-row.sisa {
  font-size: 15px;
  font-weight: 700;
}

/* Modal */
.pay-modal {
  max-width: 420px;
  width: calc(100vw - 32px);
  display: grid;
  gap: 16px;
}
.pay-modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.btn-icon-close {
  background: none;
  border: none;
  font-size: 16px;
  color: var(--muted);
  cursor: pointer;
  padding: 2px 6px;
}
.pay-input { font-size: 20px; font-weight: 700; padding: 14px; }
.quick-pay-row { display: flex; gap: 8px; }

.badge-warning {
  background: #fef3c7;
  color: #92400e;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
}
</style>

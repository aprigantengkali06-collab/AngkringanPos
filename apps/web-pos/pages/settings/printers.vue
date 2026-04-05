<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const supabase = useSupabaseClient()
const config = useRuntimeConfig()
const workspace = useWorkspace()

interface PrinterRow {
  id: string
  printer_name: string
  printer_type: 'network' | 'bluetooth' | 'usb'
  connection_value: string
  paper_width: string
  auto_print_receipt: boolean
  is_active: boolean
  created_at?: string
}

const loading = ref(false)
const saving = ref(false)
const printers = ref<PrinterRow[]>([])
const gatewayStatus = ref('Belum dites')
const errorMessage = ref('')
const successMessage = ref('')
const showForm = ref(false)
const editTarget = ref<PrinterRow | null>(null)
const search = ref('')
const form = reactive({
  printer_name: '',
  printer_type: 'network',
  connection_value: '',
  paper_width: '58mm',
  auto_print_receipt: true,
  is_active: true
})

const load = async () => {
  if (!workspace.activeOutletId.value) return
  loading.value = true
  errorMessage.value = ''

  try {
    const { data, error } = await supabase
      .from('printer_settings')
      .select('*')
      .eq('outlet_id', workspace.activeOutletId.value)
      .order('created_at', { ascending: false })

    if (error) throw error
    printers.value = (data || []) as PrinterRow[]
  } catch (error: any) {
    errorMessage.value = error?.message || 'Gagal memuat printer settings.'
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  Object.assign(form, {
    printer_name: '',
    printer_type: 'network',
    connection_value: '',
    paper_width: '58mm',
    auto_print_receipt: true,
    is_active: true
  })
  editTarget.value = null
  showForm.value = false
}

const openAdd = () => {
  editTarget.value = null
  resetForm()
  showForm.value = true
}

const openEdit = (row: PrinterRow) => {
  editTarget.value = row
  Object.assign(form, {
    printer_name: row.printer_name,
    printer_type: row.printer_type,
    connection_value: row.connection_value,
    paper_width: row.paper_width,
    auto_print_receipt: row.auto_print_receipt,
    is_active: row.is_active
  })
  showForm.value = true
}

const save = async () => {
  if (!workspace.activeOutletId.value) return
  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const payload = {
      outlet_id: workspace.activeOutletId.value,
      printer_name: form.printer_name.trim(),
      printer_type: form.printer_type,
      connection_value: form.connection_value.trim(),
      paper_width: form.paper_width,
      auto_print_receipt: form.auto_print_receipt,
      is_active: form.is_active
    }

    if (editTarget.value) {
      const { error } = await supabase.from('printer_settings').update(payload).eq('id', editTarget.value.id)
      if (error) throw error
      successMessage.value = 'Printer berhasil diperbarui.'
    } else {
      const { error } = await supabase.from('printer_settings').insert(payload)
      if (error) throw error
      successMessage.value = 'Printer berhasil ditambahkan.'
    }

    resetForm()
    await load()
  } catch (error: any) {
    errorMessage.value = error?.message || 'Gagal menyimpan printer.'
  } finally {
    saving.value = false
  }
}

const remove = async (id: string) => {
  if (!confirm('Hapus printer ini?')) return

  try {
    const { error } = await supabase.from('printer_settings').delete().eq('id', id)
    if (error) throw error

    successMessage.value = 'Printer berhasil dihapus.'
    await load()
  } catch (error: any) {
    errorMessage.value = error?.message || 'Gagal menghapus printer.'
  }
}

const testGateway = async () => {
  try {
    const result = await $fetch(`${config.public.printerGatewayUrl}/health`)
    gatewayStatus.value = typeof result === 'object' ? 'Gateway tersambung' : 'Gateway merespons'
  } catch {
    gatewayStatus.value = 'Gateway belum dapat diakses. Pastikan service lokal aktif dan CORS diizinkan.'
  }
}

const activeCount = computed(() => printers.value.filter((item) => item.is_active).length)
const autoPrintCount = computed(() => printers.value.filter((item) => item.auto_print_receipt).length)
const filteredPrinters = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  if (!keyword) return printers.value
  return printers.value.filter((item) => [item.printer_name, item.printer_type, item.connection_value, item.paper_width].join(' ').toLowerCase().includes(keyword))
})

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
        <h1 class="title">Printer & Gateway</h1>
        <p class="subtitle">Atur printer struk outlet, jenis koneksi, dan cek status gateway lokal. Editor dibuat lebih lega untuk mobile agar setup dari Android lebih mudah dibaca.</p>
      </div>
      <div class="toolbar page-header-actions">
        <button class="btn btn-secondary" @click="testGateway">Tes gateway</button>
        <button class="btn btn-primary" @click="openAdd">Tambah printer</button>
      </div>
    </section>

    <div class="grid grid-3">
      <article class="kpi-card"><h3>Total printer</h3><div class="value">{{ printers.length }}</div><div class="hint">Konfigurasi outlet aktif</div></article>
      <article class="kpi-card"><h3>Aktif</h3><div class="value">{{ activeCount }}</div><div class="hint">Siap digunakan kasir</div></article>
      <article class="kpi-card"><h3>Auto print</h3><div class="value">{{ autoPrintCount }}</div><div class="hint">Cetak otomatis setelah transaksi</div></article>
    </div>

    <div class="alert alert-info">Status gateway: {{ gatewayStatus }}</div>
    <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div>
    <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>

    <section class="card stack">
      <div class="catalogue-toolbar">
        <div class="search-field-wrap">
          <span class="search-icon">⌕</span>
          <input v-model="search" class="input search-field" placeholder="Cari nama printer, tipe, atau koneksi..." />
        </div>
      </div>

      <div v-if="showForm" class="inline-editor-card stack">
        <div class="section-title">
          <div>
            <h2 style="margin:0">{{ editTarget ? 'Edit printer' : 'Tambah printer' }}</h2>
            <p class="subtitle">Konfigurasi tetap tersimpan ke tabel <strong>printer_settings</strong> yang sama.</p>
          </div>
          <button class="btn btn-secondary" @click="resetForm">Tutup</button>
        </div>

        <div class="form-grid-2">
          <div class="stack" style="gap:8px;"><label class="field-label">Nama printer</label><input v-model="form.printer_name" class="input" placeholder="Contoh: Kasir Depan" /></div>
          <div class="stack" style="gap:8px;">
            <label class="field-label">Tipe</label>
            <select v-model="form.printer_type" class="select">
              <option value="network">Network</option>
              <option value="bluetooth">Bluetooth</option>
              <option value="usb">USB</option>
            </select>
          </div>
        </div>

        <div class="form-grid-2">
          <div class="stack" style="gap:8px;"><label class="field-label">Connection value</label><input v-model="form.connection_value" class="input" placeholder="IP address / MAC / device path" /></div>
          <div class="stack" style="gap:8px;">
            <label class="field-label">Lebar kertas</label>
            <select v-model="form.paper_width" class="select">
              <option value="58mm">58mm</option>
              <option value="80mm">80mm</option>
            </select>
          </div>
        </div>

        <label class="toggle-field"><input v-model="form.auto_print_receipt" type="checkbox" /> <span>Cetak otomatis setelah transaksi</span></label>
        <label class="toggle-field"><input v-model="form.is_active" type="checkbox" /> <span>Printer aktif</span></label>

        <div class="toolbar form-actions-row">
          <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? 'Menyimpan...' : 'Simpan printer' }}</button>
          <button class="btn btn-secondary" :disabled="saving" @click="resetForm">Batal</button>
        </div>
      </div>

      <div v-if="loading" class="empty-state">Memuat printer settings...</div>
      <div v-else-if="!filteredPrinters.length" class="empty-state">Belum ada printer yang cocok dengan filter saat ini.</div>

      <template v-else>
        <div class="table-wrap desktop-table-only">
          <table class="table">
            <thead>
              <tr>
                <th>Nama printer</th>
                <th>Tipe</th>
                <th>Koneksi</th>
                <th>Lebar kertas</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="printer in filteredPrinters" :key="printer.id">
                <td><strong>{{ printer.printer_name }}</strong></td>
                <td>{{ printer.printer_type }}</td>
                <td>{{ printer.connection_value }}</td>
                <td>{{ printer.paper_width }}</td>
                <td><span class="badge" :class="printer.is_active ? 'badge-success' : 'badge-danger'">{{ printer.is_active ? 'Aktif' : 'Nonaktif' }}</span></td>
                <td>
                  <div class="toolbar form-actions-row">
                    <button class="btn btn-secondary" @click="openEdit(printer)">Edit</button>
                    <button class="btn btn-danger" @click="remove(printer.id)">Hapus</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="management-card-list mobile-card-only">
          <article v-for="printer in filteredPrinters" :key="printer.id" class="management-card compact-card">
            <div class="management-card-top">
              <div>
                <h3>{{ printer.printer_name }}</h3>
                <p class="management-card-description">{{ printer.printer_type }} · {{ printer.connection_value }}</p>
              </div>
              <span class="badge" :class="printer.is_active ? 'badge-success' : 'badge-danger'">{{ printer.is_active ? 'Aktif' : 'Nonaktif' }}</span>
            </div>

            <div class="management-card-stats detail-grid-2">
              <div>
                <span class="muted small">Lebar kertas</span>
                <strong>{{ printer.paper_width }}</strong>
              </div>
              <div>
                <span class="muted small">Auto print</span>
                <strong>{{ printer.auto_print_receipt ? 'Ya' : 'Tidak' }}</strong>
              </div>
            </div>

            <div class="toolbar form-actions-row">
              <button class="btn btn-secondary" @click="openEdit(printer)">Edit</button>
              <button class="btn btn-danger" @click="remove(printer.id)">Hapus</button>
            </div>
          </article>
        </div>
      </template>
    </section>
  </div>
</template>

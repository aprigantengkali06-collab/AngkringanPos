<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const supabase = useSupabaseClient()
const config = useRuntimeConfig()
const workspace = useWorkspace()

const loading = ref(false)
const saving = ref(false)
const printers = ref<any[]>([])
const gatewayStatus = ref('Belum dites')
const errorMessage = ref('')
const showForm = ref(false)
const editTarget = ref<any | null>(null)
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
  try {
    const { data, error } = await supabase
      .from('printer_settings')
      .select('*')
      .eq('outlet_id', workspace.activeOutletId.value)
      .order('created_at', { ascending: false })

    if (error) throw error
    printers.value = data || []
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
}

const openAdd = () => {
  resetForm()
  showForm.value = true
}

const openEdit = (row: any) => {
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
    } else {
      const { error } = await supabase.from('printer_settings').insert(payload)
      if (error) throw error
    }

    showForm.value = false
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
  const { error } = await supabase.from('printer_settings').delete().eq('id', id)
  if (!error) await load()
}

const testGateway = async () => {
  try {
    const result = await $fetch(`${config.public.printerGatewayUrl}/health`)
    gatewayStatus.value = typeof result === 'object' ? 'Gateway tersambung' : 'Gateway merespons'
  } catch {
    gatewayStatus.value = 'Gateway belum dapat diakses. Pastikan service lokal aktif dan CORS diizinkan.'
  }
}

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
        <p class="subtitle">Atur printer struk outlet, jenis koneksi, dan cek status gateway lokal sebelum dipakai kasir.</p>
      </div>
      <div class="toolbar">
        <button class="btn btn-secondary" @click="testGateway">Tes gateway</button>
        <button class="btn btn-primary" @click="openAdd">Tambah printer</button>
      </div>
    </section>

    <div class="alert alert-info">Status gateway: {{ gatewayStatus }}</div>
    <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>

    <section class="card stack">
      <div v-if="loading" class="empty-state">Memuat printer settings...</div>
      <div v-else-if="!printers.length" class="empty-state">Belum ada printer yang terdaftar pada outlet ini.</div>
      <div v-else class="table-wrap">
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
            <tr v-for="printer in printers" :key="printer.id">
              <td><strong>{{ printer.printer_name }}</strong></td>
              <td>{{ printer.printer_type }}</td>
              <td>{{ printer.connection_value }}</td>
              <td>{{ printer.paper_width }}</td>
              <td><span class="badge" :class="printer.is_active ? 'badge-success' : 'badge-danger'">{{ printer.is_active ? 'Aktif' : 'Nonaktif' }}</span></td>
              <td>
                <div class="toolbar">
                  <button class="btn btn-secondary" @click="openEdit(printer)">Edit</button>
                  <button class="btn btn-danger" @click="remove(printer.id)">Hapus</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div v-if="showForm" class="modal-backdrop" @click="showForm = false">
      <div class="modal-card stack" @click.stop>
        <div class="section-title">
          <div>
            <h2 style="margin:0">{{ editTarget ? 'Edit printer' : 'Tambah printer' }}</h2>
            <p class="subtitle">Simpan konfigurasi agar printer bisa dipanggil dari setting atau edge function.</p>
          </div>
          <button class="btn btn-secondary" @click="showForm = false">Tutup</button>
        </div>

        <div class="form-grid-2">
          <div class="stack" style="gap:8px;"><label class="field-label">Nama printer</label><input v-model="form.printer_name" class="input" /></div>
          <div class="stack" style="gap:8px;"><label class="field-label">Tipe</label>
            <select v-model="form.printer_type" class="select">
              <option value="network">Network</option>
              <option value="bluetooth">Bluetooth</option>
              <option value="usb">USB</option>
            </select>
          </div>
        </div>

        <div class="form-grid-2">
          <div class="stack" style="gap:8px;"><label class="field-label">Connection value</label><input v-model="form.connection_value" class="input" placeholder="IP address / MAC address / device path" /></div>
          <div class="stack" style="gap:8px;"><label class="field-label">Lebar kertas</label>
            <select v-model="form.paper_width" class="select">
              <option value="58mm">58mm</option>
              <option value="80mm">80mm</option>
            </select>
          </div>
        </div>

        <label style="display:flex;align-items:center;gap:10px;font-weight:700;"><input v-model="form.auto_print_receipt" type="checkbox" /> Cetak otomatis setelah transaksi</label>
        <label style="display:flex;align-items:center;gap:10px;font-weight:700;"><input v-model="form.is_active" type="checkbox" /> Printer aktif</label>
        <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? 'Menyimpan...' : 'Simpan printer' }}</button>
      </div>
    </div>
  </div>
</template>

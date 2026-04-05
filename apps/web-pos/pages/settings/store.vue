<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const supabase = useSupabaseClient()
const workspace = useWorkspace()
const saving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const form = reactive({
  name: '',
  brand_name: '',
  address: '',
  phone: '',
  timezone: 'Asia/Jakarta'
})

const timezoneOptions = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura']

const load = () => {
  const outlet = workspace.activeOutlet.value
  if (!outlet) return
  form.name = outlet.name || ''
  form.brand_name = outlet.brand_name || ''
  form.address = outlet.address || ''
  form.phone = outlet.phone || ''
  form.timezone = outlet.timezone || 'Asia/Jakarta'
}

const save = async () => {
  if (!workspace.activeOutletId.value) return
  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const { error } = await supabase.from('outlets').update({
      name: form.name.trim(),
      brand_name: form.brand_name.trim() || null,
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      timezone: form.timezone
    }).eq('id', workspace.activeOutletId.value)

    if (error) throw error
    successMessage.value = 'Pengaturan outlet berhasil diperbarui.'
    await workspace.bootstrap(true)
  } catch (error: any) {
    errorMessage.value = error?.message || 'Gagal menyimpan pengaturan outlet.'
  } finally {
    saving.value = false
  }
}

const storeSummary = computed(() => ({
  name: form.name || 'Nama outlet',
  brand: form.brand_name || 'Belum diisi',
  phone: form.phone || '-',
  address: form.address || 'Alamat outlet belum diisi.',
  timezone: form.timezone || 'Asia/Jakarta'
}))

onMounted(async () => {
  await workspace.bootstrap()
  load()
})

watch(() => workspace.activeOutlet.value, load)
</script>

<template>
  <div class="page">
    <section class="section-title">
      <div>
        <h1 class="title">Pengaturan Outlet</h1>
        <p class="subtitle">Identitas outlet yang dipakai di dashboard, struk, dan laporan bisnis. Layout dibuat lebih nyaman dipakai dari Android tanpa mengubah struktur data.</p>
      </div>
    </section>

    <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div>
    <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>

    <div class="grid grid-2">
      <section class="card stack">
        <div>
          <h2 style="margin:0">Form outlet</h2>
          <p class="subtitle">Isi data identitas dasar outlet aktif.</p>
        </div>

        <div class="form-grid-2">
          <div class="stack" style="gap:8px;"><label class="field-label">Nama outlet</label><input v-model="form.name" class="input" placeholder="Contoh: Angkringan Pos Pusat" /></div>
          <div class="stack" style="gap:8px;"><label class="field-label">Nama brand</label><input v-model="form.brand_name" class="input" placeholder="Contoh: Angkringan Pos" /></div>
        </div>

        <div class="form-grid-2">
          <div class="stack" style="gap:8px;"><label class="field-label">No. telepon</label><input v-model="form.phone" class="input" placeholder="08xxxxxxxxxx" /></div>
          <div class="stack" style="gap:8px;">
            <label class="field-label">Timezone</label>
            <select v-model="form.timezone" class="select">
              <option v-for="timezone in timezoneOptions" :key="timezone" :value="timezone">{{ timezone }}</option>
            </select>
          </div>
        </div>

        <div class="stack" style="gap:8px;"><label class="field-label">Alamat</label><textarea v-model="form.address" class="textarea" placeholder="Masukkan alamat outlet lengkap"></textarea></div>

        <div class="toolbar form-actions-row">
          <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? 'Menyimpan...' : 'Simpan pengaturan outlet' }}</button>
        </div>
      </section>

      <section class="card stack">
        <div>
          <h2 style="margin:0">Preview identitas outlet</h2>
          <p class="subtitle">Ringkasan cepat untuk memastikan data yang tampil di aplikasi sudah benar.</p>
        </div>

        <article class="management-card">
          <div class="management-card-top">
            <div>
              <h3>{{ storeSummary.name }}</h3>
              <p class="management-card-description">Brand: {{ storeSummary.brand }}</p>
            </div>
            <span class="badge badge-soft">{{ storeSummary.timezone }}</span>
          </div>

          <div class="management-card-stats detail-grid-2">
            <div>
              <span class="muted small">Telepon</span>
              <strong>{{ storeSummary.phone }}</strong>
            </div>
            <div>
              <span class="muted small">Outlet aktif</span>
              <strong>{{ workspace.activeOutlet?.name || '-' }}</strong>
            </div>
          </div>

          <div class="stack" style="gap:8px;">
            <span class="muted small">Alamat</span>
            <strong style="line-height:1.6;">{{ storeSummary.address }}</strong>
          </div>
        </article>
      </section>
    </div>
  </div>
</template>

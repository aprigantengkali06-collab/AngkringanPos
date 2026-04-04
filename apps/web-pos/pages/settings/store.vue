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
        <p class="subtitle">Identitas outlet yang dipakai di dashboard, struk, dan laporan bisnis.</p>
      </div>
    </section>

    <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div>
    <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>

    <section class="card stack" style="max-width: 860px;">
      <div class="form-grid-2">
        <div class="stack" style="gap:8px;"><label class="field-label">Nama outlet</label><input v-model="form.name" class="input" /></div>
        <div class="stack" style="gap:8px;"><label class="field-label">Nama brand</label><input v-model="form.brand_name" class="input" /></div>
      </div>
      <div class="form-grid-2">
        <div class="stack" style="gap:8px;"><label class="field-label">No. telepon</label><input v-model="form.phone" class="input" /></div>
        <div class="stack" style="gap:8px;"><label class="field-label">Timezone</label><input v-model="form.timezone" class="input" /></div>
      </div>
      <div class="stack" style="gap:8px;"><label class="field-label">Alamat</label><textarea v-model="form.address" class="textarea"></textarea></div>
      <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? 'Menyimpan...' : 'Simpan pengaturan outlet' }}</button>
    </section>
  </div>
</template>

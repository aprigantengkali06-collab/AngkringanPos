<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const supabase = useSupabaseClient()
const workspace = useWorkspace()

const form = reactive({
  brand_name: '',
  primary_color: '#F59E0B',
  secondary_color: '#0F172A',
  receipt_footer: 'Terima kasih, semoga harimu hangat.',
  whatsapp_number: '',
  instagram_url: ''
})

const saving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const load = async () => {
  if (!workspace.activeOutletId.value) return
  const { data, error } = await supabase
    .from('branding_settings')
    .select('*')
    .eq('outlet_id', workspace.activeOutletId.value)
    .maybeSingle()

  if (!error && data) {
    Object.assign(form, {
      brand_name: data.brand_name || '',
      primary_color: data.primary_color || '#F59E0B',
      secondary_color: data.secondary_color || '#0F172A',
      receipt_footer: data.receipt_footer || 'Terima kasih, semoga harimu hangat.',
      whatsapp_number: data.whatsapp_number || '',
      instagram_url: data.instagram_url || ''
    })
  } else if (workspace.activeOutlet.value) {
    form.brand_name = workspace.activeOutlet.value.brand_name || workspace.activeOutlet.value.name
  }
}

const save = async () => {
  if (!workspace.activeOutletId.value) return
  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const { error } = await supabase.from('branding_settings').upsert({
      outlet_id: workspace.activeOutletId.value,
      brand_name: form.brand_name.trim() || workspace.activeOutlet.value?.name || 'Outlet',
      primary_color: form.primary_color,
      secondary_color: form.secondary_color,
      receipt_footer: form.receipt_footer.trim() || null,
      whatsapp_number: form.whatsapp_number.trim() || null,
      instagram_url: form.instagram_url.trim() || null
    }, { onConflict: 'outlet_id' })

    if (error) throw error
    successMessage.value = 'Branding outlet berhasil diperbarui.'
    await workspace.bootstrap(true)
  } catch (error: any) {
    errorMessage.value = error?.message || 'Gagal menyimpan branding.'
  } finally {
    saving.value = false
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
        <h1 class="title">Branding & Struk</h1>
        <p class="subtitle">Warna brand, footer struk, WhatsApp, dan identitas yang tampil ke pelanggan.</p>
      </div>
    </section>

    <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div>
    <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>

    <div class="grid grid-2">
      <section class="card stack">
        <div class="form-grid-2">
          <div class="stack" style="gap:8px;"><label class="field-label">Nama brand</label><input v-model="form.brand_name" class="input" /></div>
          <div class="stack" style="gap:8px;"><label class="field-label">WhatsApp</label><input v-model="form.whatsapp_number" class="input" /></div>
        </div>
        <div class="form-grid-2">
          <div class="stack" style="gap:8px;"><label class="field-label">Warna utama</label><input v-model="form.primary_color" class="input" type="color" /></div>
          <div class="stack" style="gap:8px;"><label class="field-label">Warna sekunder</label><input v-model="form.secondary_color" class="input" type="color" /></div>
        </div>
        <div class="stack" style="gap:8px;"><label class="field-label">Instagram URL</label><input v-model="form.instagram_url" class="input" /></div>
        <div class="stack" style="gap:8px;"><label class="field-label">Footer struk</label><textarea v-model="form.receipt_footer" class="textarea"></textarea></div>
        <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? 'Menyimpan...' : 'Simpan branding' }}</button>
      </section>

      <section class="card stack">
        <div>
          <h2 style="margin:0">Preview cepat</h2>
          <p class="subtitle">Contoh tampilan ringkas yang akan memengaruhi identitas outlet.</p>
        </div>
        <div :style="{ borderRadius: '22px', padding: '22px', background: `linear-gradient(180deg, ${form.primary_color}22 0%, #ffffff 100%)`, border: `1px solid ${form.primary_color}44` }">
          <div style="display:grid;gap:8px;">
            <strong :style="{ fontSize: '24px', color: form.secondary_color }">{{ form.brand_name || 'Nama Brand' }}</strong>
            <span class="muted">Outlet {{ workspace.activeOutlet?.name || 'aktif' }}</span>
            <p :style="{ color: form.secondary_color, whiteSpace: 'pre-line' }">{{ form.receipt_footer }}</p>
            <span class="muted">WhatsApp: {{ form.whatsapp_number || '-' }}</span>
            <span class="muted">Instagram: {{ form.instagram_url || '-' }}</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

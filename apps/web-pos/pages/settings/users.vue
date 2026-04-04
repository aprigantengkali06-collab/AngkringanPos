<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const supabase = useSupabaseClient()
const workspace = useWorkspace()

const loading = ref(false)
const saving = ref(false)
const team = ref<any[]>([])
const errorMessage = ref('')
const successMessage = ref('')
const showForm = ref(false)
const editTarget = ref<any | null>(null)
const form = reactive({
  email: '',
  full_name: '',
  password: '',
  role: 'cashier',
  pin_code: '',
  is_active: true
})

const load = async () => {
  if (!workspace.activeOutletId.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    const { data, error } = await supabase.functions.invoke('manage-staff', {
      body: { action: 'list', outlet_id: workspace.activeOutletId.value }
    })

    if (error) throw error
    team.value = data?.users || []
  } catch (error: any) {
    errorMessage.value = error?.message || 'Gagal memuat data tim.'
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  Object.assign(form, { email: '', full_name: '', password: '', role: 'cashier', pin_code: '', is_active: true })
  editTarget.value = null
}

const openAdd = () => {
  resetForm()
  showForm.value = true
}

const openEdit = (row: any) => {
  editTarget.value = row
  Object.assign(form, {
    email: row.email || '',
    full_name: row.full_name || '',
    password: '',
    role: row.role || 'cashier',
    pin_code: row.pin_code || '',
    is_active: Boolean(row.is_active)
  })
  showForm.value = true
}

const save = async () => {
  if (!workspace.activeOutletId.value) return
  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const action = editTarget.value ? 'update' : 'create'
    const { data, error } = await supabase.functions.invoke('manage-staff', {
      body: {
        action,
        outlet_id: workspace.activeOutletId.value,
        user_id: editTarget.value?.id,
        email: form.email.trim(),
        full_name: form.full_name.trim(),
        password: form.password,
        role: form.role,
        pin_code: form.pin_code.trim() || null,
        is_active: form.is_active
      }
    })

    if (error) throw error
    if (data?.ok === false) throw new Error(data.error || 'Gagal menyimpan user')

    successMessage.value = editTarget.value ? 'Data anggota tim berhasil diperbarui.' : 'Akun anggota tim berhasil dibuat.'
    showForm.value = false
    resetForm()
    await load()
  } catch (error: any) {
    errorMessage.value = error?.message || 'Gagal menyimpan anggota tim.'
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
        <h1 class="title">Tim Outlet</h1>
        <p class="subtitle">Buat akun owner, manager, dan kasir langsung dari dashboard tanpa setup manual di Supabase Auth.</p>
      </div>
      <button class="btn btn-primary" @click="openAdd">Tambah anggota tim</button>
    </section>

    <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div>
    <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>

    <section class="card stack">
      <div v-if="loading" class="empty-state">Memuat data tim...</div>
      <div v-else-if="!team.length" class="empty-state">Belum ada anggota tim pada outlet ini.</div>
      <div v-else class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Email</th>
              <th>Role</th>
              <th>PIN</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="member in team" :key="member.id">
              <td><strong>{{ member.full_name }}</strong></td>
              <td>{{ member.email || '-' }}</td>
              <td>{{ member.role }}</td>
              <td>{{ member.pin_code || '-' }}</td>
              <td><span class="badge" :class="member.is_active ? 'badge-success' : 'badge-danger'">{{ member.is_active ? 'Aktif' : 'Nonaktif' }}</span></td>
              <td><button class="btn btn-secondary" @click="openEdit(member)">Edit</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div v-if="showForm" class="modal-backdrop" @click="showForm = false">
      <div class="modal-card stack" @click.stop>
        <div class="section-title">
          <div>
            <h2 style="margin:0">{{ editTarget ? 'Edit anggota tim' : 'Tambah anggota tim' }}</h2>
            <p class="subtitle">Akun baru langsung dibuat di Auth dan dihubungkan ke outlet aktif.</p>
          </div>
          <button class="btn btn-secondary" @click="showForm = false">Tutup</button>
        </div>

        <div class="form-grid-2">
          <div class="stack" style="gap:8px;"><label class="field-label">Nama lengkap</label><input v-model="form.full_name" class="input" /></div>
          <div class="stack" style="gap:8px;"><label class="field-label">Email login</label><input v-model="form.email" class="input" :disabled="Boolean(editTarget)" /></div>
        </div>

        <div class="form-grid-3">
          <div class="stack" style="gap:8px;"><label class="field-label">Role</label>
            <select v-model="form.role" class="select">
              <option value="owner">Owner</option>
              <option value="manager">Manager</option>
              <option value="cashier">Cashier</option>
            </select>
          </div>
          <div class="stack" style="gap:8px;"><label class="field-label">PIN kasir</label><input v-model="form.pin_code" class="input" /></div>
          <div class="stack" style="gap:8px;"><label class="field-label">Password {{ editTarget ? '(opsional)' : '' }}</label><input v-model="form.password" class="input" type="password" placeholder="Minimal 6 karakter" /></div>
        </div>

        <label style="display:flex;align-items:center;gap:10px;font-weight:700;"><input v-model="form.is_active" type="checkbox" /> Akun aktif</label>
        <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? 'Menyimpan...' : 'Simpan anggota tim' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const supabase = useSupabaseClient()
const workspace = useWorkspace()

interface TeamMember {
  id: string
  email: string | null
  full_name: string | null
  role: 'owner' | 'manager' | 'cashier'
  pin_code: string | null
  is_active: boolean
}

const loading = ref(false)
const saving = ref(false)
const team = ref<TeamMember[]>([])
const errorMessage = ref('')
const successMessage = ref('')
const showForm = ref(false)
const editTarget = ref<TeamMember | null>(null)
const search = ref('')
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
    team.value = (data?.users || []) as TeamMember[]
  } catch (error: any) {
    errorMessage.value = error?.message || 'Gagal memuat data tim.'
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  Object.assign(form, { email: '', full_name: '', password: '', role: 'cashier', pin_code: '', is_active: true })
  editTarget.value = null
  showForm.value = false
}

const openAdd = () => {
  resetForm()
  showForm.value = true
}

const openEdit = (row: TeamMember) => {
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
    resetForm()
    await load()
  } catch (error: any) {
    errorMessage.value = error?.message || 'Gagal menyimpan anggota tim.'
  } finally {
    saving.value = false
  }
}

const activeCount = computed(() => team.value.filter((item) => item.is_active).length)
const cashierCount = computed(() => team.value.filter((item) => item.role === 'cashier').length)
const managerCount = computed(() => team.value.filter((item) => item.role === 'manager' || item.role === 'owner').length)
const filteredTeam = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  if (!keyword) return team.value
  return team.value.filter((item) => [item.full_name || '', item.email || '', item.role || '', item.pin_code || ''].join(' ').toLowerCase().includes(keyword))
})
const maskPin = (pin?: string | null) => pin ? `••${String(pin).slice(-2)}` : '-'

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
        <p class="subtitle">Buat akun owner, manager, dan kasir langsung dari dashboard. Editor dibuat lebih mobile-friendly tanpa mengubah proses create/update user.</p>
      </div>
      <div class="toolbar page-header-actions">
        <button class="btn btn-secondary" :disabled="loading" @click="load">{{ loading ? 'Memuat...' : 'Refresh' }}</button>
        <button class="btn btn-primary" @click="openAdd">Tambah anggota tim</button>
      </div>
    </section>

    <div class="grid grid-3">
      <article class="kpi-card"><h3>Total anggota</h3><div class="value">{{ team.length }}</div><div class="hint">Semua akun di outlet aktif</div></article>
      <article class="kpi-card"><h3>Akun aktif</h3><div class="value">{{ activeCount }}</div><div class="hint">Bisa login dan dipakai operasional</div></article>
      <article class="kpi-card"><h3>Cashier / Manager</h3><div class="value">{{ cashierCount }} / {{ managerCount }}</div><div class="hint">Owner masuk hitungan manager</div></article>
    </div>

    <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div>
    <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>

    <section class="card stack">
      <div class="catalogue-toolbar">
        <div class="search-field-wrap">
          <span class="search-icon">⌕</span>
          <input v-model="search" class="input search-field" placeholder="Cari nama, email, role, atau PIN..." />
        </div>
      </div>

      <div v-if="showForm" class="inline-editor-card stack">
        <div class="section-title">
          <div>
            <h2 style="margin:0">{{ editTarget ? 'Edit anggota tim' : 'Tambah anggota tim' }}</h2>
            <p class="subtitle">Akun baru tetap dibuat lewat edge function <strong>manage-staff</strong> yang sudah dipakai aplikasi.</p>
          </div>
          <button class="btn btn-secondary" @click="resetForm">Tutup</button>
        </div>

        <div class="form-grid-2">
          <div class="stack" style="gap:8px;"><label class="field-label">Nama lengkap</label><input v-model="form.full_name" class="input" placeholder="Nama lengkap anggota tim" /></div>
          <div class="stack" style="gap:8px;"><label class="field-label">Email login</label><input v-model="form.email" class="input" :disabled="Boolean(editTarget)" placeholder="email@domain.com" /></div>
        </div>

        <div class="form-grid-3">
          <div class="stack" style="gap:8px;">
            <label class="field-label">Role</label>
            <select v-model="form.role" class="select">
              <option value="owner">Owner</option>
              <option value="manager">Manager</option>
              <option value="cashier">Cashier</option>
            </select>
          </div>
          <div class="stack" style="gap:8px;"><label class="field-label">PIN kasir</label><input v-model="form.pin_code" class="input" placeholder="Contoh: 1234" /></div>
          <div class="stack" style="gap:8px;"><label class="field-label">Password {{ editTarget ? '(opsional)' : '' }}</label><input v-model="form.password" class="input" type="password" placeholder="Minimal 6 karakter" /></div>
        </div>

        <label class="toggle-field"><input v-model="form.is_active" type="checkbox" /> <span>Akun aktif</span></label>

        <div class="toolbar form-actions-row">
          <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? 'Menyimpan...' : 'Simpan anggota tim' }}</button>
          <button class="btn btn-secondary" :disabled="saving" @click="resetForm">Batal</button>
        </div>
      </div>

      <div v-if="loading" class="empty-state">Memuat data tim...</div>
      <div v-else-if="!filteredTeam.length" class="empty-state">Belum ada anggota tim yang cocok dengan filter saat ini.</div>

      <template v-else>
        <div class="table-wrap desktop-table-only">
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
              <tr v-for="member in filteredTeam" :key="member.id">
                <td><strong>{{ member.full_name || '-' }}</strong></td>
                <td>{{ member.email || '-' }}</td>
                <td>{{ member.role }}</td>
                <td>{{ maskPin(member.pin_code) }}</td>
                <td><span class="badge" :class="member.is_active ? 'badge-success' : 'badge-danger'">{{ member.is_active ? 'Aktif' : 'Nonaktif' }}</span></td>
                <td><button class="btn btn-secondary" @click="openEdit(member)">Edit</button></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="management-card-list mobile-card-only">
          <article v-for="member in filteredTeam" :key="member.id" class="management-card compact-card">
            <div class="management-card-top">
              <div>
                <h3>{{ member.full_name || '-' }}</h3>
                <p class="management-card-description">{{ member.email || '-' }}</p>
              </div>
              <span class="badge" :class="member.is_active ? 'badge-success' : 'badge-danger'">{{ member.is_active ? 'Aktif' : 'Nonaktif' }}</span>
            </div>

            <div class="management-card-stats detail-grid-2">
              <div>
                <span class="muted small">Role</span>
                <strong>{{ member.role }}</strong>
              </div>
              <div>
                <span class="muted small">PIN</span>
                <strong>{{ maskPin(member.pin_code) }}</strong>
              </div>
            </div>

            <div class="toolbar form-actions-row">
              <button class="btn btn-secondary" @click="openEdit(member)">Edit</button>
            </div>
          </article>
        </div>
      </template>
    </section>
  </div>
</template>

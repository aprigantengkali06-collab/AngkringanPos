<script setup lang="ts">
const config = useRuntimeConfig()
const supabase = useSupabaseClient()
const workspace = useWorkspace()

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

const submit = async () => {
  try {
    loading.value = true
    errorMessage.value = ''

    const { error } = await supabase.auth.signInWithPassword({
      email: email.value.trim(),
      password: password.value
    })

    if (error) throw error

    await workspace.bootstrap(true)
    await navigateTo('/pos')
  } catch (error: any) {
    errorMessage.value = error?.message || 'Login gagal. Periksa email dan password.'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  const { data } = await supabase.auth.getSession()
  if (data.session) {
    await workspace.bootstrap(true)
    await navigateTo('/pos')
  }
})
</script>

<template>
  <div class="login-shell">
    <div class="login-panel card glass">
      <div class="login-hero">
        <span class="hero-badge">🍢 Siap dipakai bisnis</span>
        <h1>{{ config.public.appName }}</h1>
        <p>
          Login dengan akun Supabase Auth. Setelah masuk, aplikasi otomatis menyiapkan profil, akses outlet, dan workspace kasir.
        </p>
      </div>

      <div class="stack">
        <label class="field-label">Email</label>
        <input v-model="email" class="input" type="email" placeholder="owner@angkringan.com" />

        <label class="field-label">Password</label>
        <input v-model="password" class="input" type="password" placeholder="Masukkan password" @keyup.enter="submit" />

        <button class="btn btn-primary btn-lg" :disabled="loading" @click="submit">
          {{ loading ? 'Memproses login...' : 'Masuk ke Dashboard' }}
        </button>

        <div v-if="errorMessage" class="alert alert-danger">
          {{ errorMessage }}
        </div>
      </div>
    </div>
  </div>
</template>

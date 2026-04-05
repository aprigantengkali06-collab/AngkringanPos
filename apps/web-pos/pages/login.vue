<script setup lang="ts">
const config = useRuntimeConfig()
const supabase = useSupabaseClient()
const workspace = useWorkspace()

const email    = ref('')
const password = ref('')
const loading  = ref(false)
const errorMsg = ref('')
const showPass = ref(false)

const submit = async () => {
  try {
    loading.value = true
    errorMsg.value = ''
    const { error } = await supabase.auth.signInWithPassword({
      email: email.value.trim(),
      password: password.value,
    })
    if (error) throw error
    await workspace.bootstrap(true)
    await navigateTo('/pos')
  } catch (err: any) {
    errorMsg.value = err?.message || 'Login gagal. Periksa email dan password.'
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
    <!-- Left: Brand panel -->
    <div class="login-brand-panel">
      <div class="brand-inner">
        <!-- Logo mark -->
        <div class="brand-logo">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <rect x="15.5" y="1" width="5" height="18" rx="2.5" fill="white"/>
            <circle cx="18" cy="5"  r="4"   fill="white"/>
            <circle cx="18" cy="13" r="3.2" fill="rgba(255,255,255,.6)"/>
            <circle cx="18" cy="19" r="2.2" fill="rgba(255,255,255,.3)"/>
            <path d="M4 26Q18 20 32 26L30 34Q18 29 6 34Z" fill="white"/>
          </svg>
        </div>
        <h1 class="brand-name">{{ config.public.appName }}</h1>
        <p class="brand-tagline">Kasir modern untuk usaha angkringan Anda. Cepat, akurat, dan selalu sinkron.</p>

        <!-- Feature pills -->
        <div class="brand-features">
          <span class="brand-pill">📦 Kelola Produk</span>
          <span class="brand-pill">📊 Laporan Harian</span>
          <span class="brand-pill">🔄 Multi-outlet</span>
          <span class="brand-pill">📱 Mobile-ready</span>
        </div>

        <!-- Decorative circles -->
        <div class="brand-deco deco-1" />
        <div class="brand-deco deco-2" />
        <div class="brand-deco deco-3" />
      </div>
    </div>

    <!-- Right: Form panel -->
    <div class="login-form-panel">
      <div class="login-form-inner">
        <!-- Mobile logo (only visible on small screens) -->
        <div class="mobile-login-logo">
          <div class="mobile-logo-mark">
            <svg width="24" height="24" viewBox="0 0 36 36" fill="none">
              <rect x="15.5" y="1" width="5" height="18" rx="2.5" fill="white"/>
              <circle cx="18" cy="5"  r="4"   fill="white"/>
              <circle cx="18" cy="13" r="3.2" fill="rgba(255,255,255,.6)"/>
              <path d="M4 26Q18 20 32 26L30 34Q18 29 6 34Z" fill="white"/>
            </svg>
          </div>
          <span class="mobile-logo-name">{{ config.public.appName }}</span>
        </div>

        <div class="form-header">
          <h2 class="form-title">Selamat datang 👋</h2>
          <p class="form-subtitle">Masuk ke dashboard kasir Anda</p>
        </div>

        <div class="form-body">
          <div class="field-group">
            <label class="field-label">Email</label>
            <div class="input-icon-wrap">
              <svg class="input-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.4"/>
                <path d="M1 5l7 5 7-5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              </svg>
              <input
                v-model="email"
                class="input input-with-icon"
                type="email"
                placeholder="owner@angkringan.com"
                autocomplete="email"
              />
            </div>
          </div>

          <div class="field-group">
            <label class="field-label">Password</label>
            <div class="input-icon-wrap">
              <svg class="input-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="3" y="7" width="10" height="8" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
                <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                <circle cx="8" cy="11" r="1" fill="currentColor"/>
              </svg>
              <input
                v-model="password"
                class="input input-with-icon"
                :type="showPass ? 'text' : 'password'"
                placeholder="Masukkan password"
                autocomplete="current-password"
                @keyup.enter="submit"
              />
              <button class="input-eye" type="button" @click="showPass = !showPass" aria-label="Toggle password">
                <svg v-if="!showPass" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" stroke-width="1.4"/>
                  <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.4"/>
                </svg>
                <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M1 1l14 14M7 4.2A6.3 6.3 0 0 1 8 4c4.5 0 7 4 7 4s-.9 1.8-2.5 3M4.2 4.8C2.5 6 1 8 1 8s2.5 5 7 5a6.3 6.3 0 0 0 3.8-1.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          <div v-if="errorMsg" class="alert alert-danger login-error">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.4"/>
              <path d="M7 4v4M7 10v.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
            {{ errorMsg }}
          </div>

          <button class="btn btn-primary btn-lg login-btn" :disabled="loading" @click="submit">
            <span v-if="loading" class="login-spinner" />
            <span>{{ loading ? 'Memproses...' : 'Masuk ke Dashboard' }}</span>
          </button>
        </div>

        <p class="form-footer-note">Angkringan POS &copy; {{ new Date().getFullYear() }}</p>
      </div>
    </div>
  </div>
</template>

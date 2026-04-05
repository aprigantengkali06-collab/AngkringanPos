<script setup lang="ts">
const route = useRoute()
const config = useRuntimeConfig()
const isDrawerOpen = ref(false)

const {
  profile,
  outlets,
  activeOutlet,
  activeOutletId,
  error,
  canManage,
  bootstrap,
  switchOutlet,
  signOut
} = useWorkspace()

const navItems = computed(() => {
  const base = [
    { to: '/pos', label: 'Kasir', icon: 'KS' },
    { to: '/orders', label: 'Riwayat Transaksi', icon: 'TR' },
    { to: '/reports/daily', label: 'Laporan', icon: 'LP' },
    { to: '/expenses', label: 'Pengeluaran', icon: 'PG' },
    { to: '/shifts', label: 'Shift', icon: 'SF' }
  ]

  if (canManage.value) {
    base.push(
      { to: '/products', label: 'Kelola Produk', icon: 'PR' },
      { to: '/categories', label: 'Kategori', icon: 'KT' },
      { to: '/settings/store', label: 'Kelola Toko', icon: 'TK' },
      { to: '/settings/branding', label: 'Branding', icon: 'BR' },
      { to: '/settings/printers', label: 'Printer', icon: 'PT' },
      { to: '/settings/users', label: 'Tim Outlet', icon: 'TM' }
    )
  }

  return base
})

const bottomNavItems = computed(() => {
  const items = [
    { to: '/pos', label: 'Kasir', icon: 'KS' },
    { to: '/orders', label: 'Transaksi', icon: 'TR' },
    { to: '/reports/daily', label: 'Laporan', icon: 'LP' },
    canManage.value
      ? { to: '/products', label: 'Produk', icon: 'PR' }
      : { to: '/shifts', label: 'Shift', icon: 'SF' },
    { to: '/shifts', label: 'Shift', icon: 'SF' }
  ]

  const unique = new Map(items.map((item) => [item.to, item]))
  return Array.from(unique.values()).slice(0, 5)
})

const showShell = computed(() => route.path !== '/login')
const appName = computed(() => config.public.appName)

const closeDrawer = () => {
  isDrawerOpen.value = false
}

onMounted(async () => {
  if (showShell.value) {
    await bootstrap()
  }
})

watch(() => route.path, async (path) => {
  closeDrawer()
  if (path !== '/login') {
    await bootstrap()
  }
})
</script>

<template>
  <div v-if="showShell" class="app-shell">
    <div v-if="isDrawerOpen" class="drawer-backdrop" @click="closeDrawer" />

    <aside class="app-sidebar" :class="{ open: isDrawerOpen }">
      <div class="brand-block">
        <div class="brand-mark">AP</div>
        <div>
          <p class="eyebrow">POS mobile-ready</p>
          <h1>{{ appName }}</h1>
          <p class="muted small">Kasir, transaksi, laporan, tim, dan pengaturan outlet dalam satu aplikasi.</p>
        </div>
      </div>

      <div class="sidebar-account-card">
        <div class="sidebar-user-avatar">{{ (profile?.full_name || 'U').slice(0, 1).toUpperCase() }}</div>
        <div>
          <p class="sidebar-user-name">{{ profile?.full_name || 'Memuat...' }}</p>
          <div class="sidebar-user-meta">
            <span class="badge badge-soft">{{ profile?.role || 'user' }}</span>
            <span class="muted small">{{ activeOutlet?.name || 'Belum ada outlet' }}</span>
          </div>
        </div>
      </div>

      <nav class="nav-list">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="nav-link"
          @click="closeDrawer"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </NuxtLink>
      </nav>

      <div class="sidebar-panel">
        <p class="eyebrow">Info aplikasi</p>
        <p class="muted small">Tampilan sudah dioptimalkan agar nyaman dipakai di layar HP dan tablet.</p>
        <p class="muted small" style="margin-top: 10px;">Version mobile POS v2</p>
      </div>
    </aside>

    <div class="app-main">
      <header class="topbar">
        <div class="topbar-main-block">
          <div class="topbar-title-row">
            <button class="menu-toggle mobile-only" @click="isDrawerOpen = true">☰</button>
            <div>
              <p class="eyebrow">Outlet aktif</p>
              <h2>{{ activeOutlet?.name || 'Pilih outlet' }}</h2>
              <p class="muted small">{{ activeOutlet?.address || 'Alamat outlet belum diatur.' }}</p>
            </div>
          </div>
        </div>

        <div class="topbar-actions">
          <select
            v-if="outlets?.length"
            :value="activeOutletId"
            class="input topbar-select"
            @change="switchOutlet(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="outlet in outlets" :key="outlet.id" :value="outlet.id">
              {{ outlet.name }}
            </option>
          </select>
          <button class="btn btn-secondary" @click="bootstrap(true)">Refresh</button>
          <button class="btn btn-dark" @click="signOut">Logout</button>
        </div>
      </header>

      <div v-if="error" class="alert alert-warning top-alert">
        {{ error }}
      </div>

      <main class="content-shell">
        <slot />
      </main>
    </div>

    <nav class="mobile-bottom-nav mobile-only">
      <NuxtLink v-for="item in bottomNavItems" :key="item.to" :to="item.to" class="mobile-bottom-link">
        <span class="mobile-bottom-icon">{{ item.icon }}</span>
        <span>{{ item.label }}</span>
      </NuxtLink>
    </nav>
  </div>

  <div v-else class="auth-shell">
    <slot />
  </div>
</template>

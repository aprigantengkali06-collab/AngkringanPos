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
    { to: '/pos', label: 'Kasir', icon: '🏪', abbr: 'KS' },
    { to: '/orders', label: 'Riwayat Transaksi', icon: '📋', abbr: 'TR' },
    { to: '/reports/daily', label: 'Laporan', icon: '📊', abbr: 'LP' },
    { to: '/expenses', label: 'Pengeluaran', icon: '💸', abbr: 'PG' },
    { to: '/shifts', label: 'Shift', icon: '🕐', abbr: 'SF' }
  ]

  if (canManage.value) {
    base.push(
      { to: '/products', label: 'Kelola Produk', icon: '🍱', abbr: 'PR' },
      { to: '/categories', label: 'Kategori', icon: '🏷️', abbr: 'KT' },
      { to: '/settings/store', label: 'Kelola Toko', icon: '🏬', abbr: 'TK' },
      { to: '/settings/branding', label: 'Branding', icon: '🎨', abbr: 'BR' },
      { to: '/settings/printers', label: 'Printer', icon: '🖨️', abbr: 'PT' },
      { to: '/settings/users', label: 'Tim Outlet', icon: '👥', abbr: 'TM' }
    )
  }

  return base
})

const bottomNavItems = computed(() => {
  if (canManage.value) {
    return [
      { to: '/pos', label: 'Kasir', icon: '🏪' },
      { to: '/products', label: 'Produk', icon: '🍱' },
      { to: '/categories', label: 'Kategori', icon: '🏷️' },
      { to: '/shifts', label: 'Shift', icon: '🕐' },
      { to: '/orders', label: 'Transaksi', icon: '📋' }
    ]
  }
  return [
    { to: '/pos', label: 'Kasir', icon: '🏪' },
    { to: '/orders', label: 'Transaksi', icon: '📋' },
    { to: '/reports/daily', label: 'Laporan', icon: '📊' },
    { to: '/expenses', label: 'Keluar', icon: '💸' },
    { to: '/shifts', label: 'Shift', icon: '🕐' }
  ]
})

const showShell = computed(() => route.path !== '/login')
const appName = computed(() => config.public.appName)

const closeDrawer = () => { isDrawerOpen.value = false }

onMounted(async () => {
  if (showShell.value) await bootstrap()
})

watch(() => route.path, async (path) => {
  closeDrawer()
  if (path !== '/login') await bootstrap()
})
</script>

<template>
  <div v-if="showShell" class="app-shell">
    <div v-if="isDrawerOpen" class="drawer-backdrop" @click="closeDrawer" />

    <aside class="app-sidebar" :class="{ open: isDrawerOpen }">
      <!-- Logo / Brand -->
      <div class="sidebar-brand">
        <div class="sidebar-logo">
          <span class="sidebar-logo-icon">🍢</span>
        </div>
        <div class="sidebar-brand-text">
          <span class="sidebar-app-name">{{ appName }}</span>
          <span class="sidebar-tagline">POS Mobile-Ready</span>
        </div>
        <button class="sidebar-close mobile-only" @click="closeDrawer">✕</button>
      </div>

      <!-- User Card -->
      <div class="sidebar-user">
        <div class="sidebar-avatar">{{ (profile?.full_name || 'U').slice(0, 1).toUpperCase() }}</div>
        <div class="sidebar-user-info">
          <span class="sidebar-user-name">{{ profile?.full_name || 'Memuat...' }}</span>
          <div class="sidebar-user-meta">
            <span class="role-badge">{{ profile?.role || 'user' }}</span>
            <span class="outlet-name">{{ activeOutlet?.name || 'Belum ada outlet' }}</span>
          </div>
        </div>
      </div>

      <!-- Outlet Switcher -->
      <div v-if="outlets?.length" class="sidebar-outlet-switcher">
        <label class="switcher-label">Outlet aktif</label>
        <select
          :value="activeOutletId"
          class="switcher-select"
          @change="switchOutlet(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="outlet in outlets" :key="outlet.id" :value="outlet.id">
            {{ outlet.name }}
          </option>
        </select>
      </div>

      <!-- Nav -->
      <nav class="sidebar-nav">
        <p class="nav-section-label">Menu Utama</p>
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          @click="closeDrawer"
        >
          <span class="nav-item-icon">{{ item.icon }}</span>
          <span class="nav-item-label">{{ item.label }}</span>
        </NuxtLink>
      </nav>

      <!-- Footer -->
      <div class="sidebar-footer">
        <button class="sidebar-refresh-btn" @click="bootstrap(true)">↺ Refresh Data</button>
        <button class="sidebar-logout-btn" @click="signOut">Keluar</button>
      </div>
    </aside>

    <div class="app-main">
      <!-- Topbar -->
      <header class="topbar">
        <div class="topbar-left">
          <button class="hamburger mobile-only" @click="isDrawerOpen = true">
            <span></span><span></span><span></span>
          </button>
          <div class="topbar-outlet">
            <span class="topbar-outlet-label">Outlet aktif</span>
            <span class="topbar-outlet-name">{{ activeOutlet?.name || 'Pilih outlet' }}</span>
          </div>
        </div>
        <div class="topbar-right desktop-only">
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

      <div v-if="error" class="alert alert-warning top-alert">{{ error }}</div>

      <main class="content-shell">
        <slot />
      </main>
    </div>

    <!-- Mobile Bottom Nav -->
    <nav class="mobile-bottom-nav mobile-only">
      <NuxtLink v-for="item in bottomNavItems" :key="item.to" :to="item.to" class="bottom-nav-item">
        <span class="bottom-nav-icon">{{ item.icon }}</span>
        <span class="bottom-nav-label">{{ item.label }}</span>
      </NuxtLink>
    </nav>
  </div>

  <div v-else class="auth-shell">
    <slot />
  </div>
</template>

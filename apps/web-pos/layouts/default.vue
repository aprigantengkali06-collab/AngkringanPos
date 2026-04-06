<script setup lang="ts">
const route = useRoute()
const config = useRuntimeConfig()
const isDrawerOpen = ref(false)

const {
  profile, outlets, activeOutlet, activeOutletId,
  error, canManage, bootstrap, switchOutlet, signOut
} = useWorkspace()

// SVG icon paths — stroke-based, viewBox 0 0 20 20
const icons: Record<string, string> = {
  kasir:       '<rect x="2" y="5" width="16" height="12" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M2 9h16M6 13h2M10 13h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  tagihan:     '<path d="M6 2h8a2 2 0 0 1 2 2v14l-5-3-5 3V4a2 2 0 0 1 2-2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 8h4M8 11h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  transaksi:   '<rect x="4" y="3" width="12" height="15" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M7 8h6M7 12h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  laporan:     '<path d="M4 16V8l6-4 6 4v8M4 16h12M8 16v-5h4v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  pengeluaran: '<circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.5"/><path d="M10 7v6M7.5 9l2.5 4 2.5-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  shift:       '<circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.5"/><path d="M10 6v4l2.5 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  produk:      '<path d="M3 7l7-4 7 4v8l-7 4-7-4V7z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M10 3v14M3 7l7 4 7-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  kategori:    '<rect x="3" y="3" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="11" y="3" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="3" y="13" width="6" height="4" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="11" y="13" width="6" height="4" rx="1" stroke="currentColor" stroke-width="1.5"/>',
  toko:        '<path d="M2 8l2-5h12l2 5M2 8v1a3 3 0 0 0 6 0M8 9a3 3 0 0 0 6 0M14 9a3 3 0 0 0 6 0V8M2 18h16M7 18v-5h3v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  branding:    '<circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="10" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M10 3v2M10 15v2M3 10h2M15 10h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  printer:     '<path d="M5 7V3h10v4M5 15H3V9h14v6h-2M5 11h10M7 15v2h6v-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  tim:         '<circle cx="7.5" cy="7" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M2 17c0-2.8 2.5-5 5.5-5M12.5 10a3 3 0 1 1 0-6M18 17c0-2.8-2.4-5-5.5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
}

const navItems = computed(() => {
  const base = [
    { to: '/pos',           label: 'Kasir',             icon: 'kasir' },
    { to: '/tagihan',       label: 'Tagihan Aktif',     icon: 'tagihan' },
    { to: '/orders',        label: 'Riwayat Transaksi', icon: 'transaksi' },
    { to: '/reports/daily', label: 'Laporan',           icon: 'laporan' },
    { to: '/expenses',      label: 'Pengeluaran',       icon: 'pengeluaran' },
    { to: '/shifts',        label: 'Shift',             icon: 'shift' },
  ]
  if (canManage.value) {
    base.push(
      { to: '/products',          label: 'Kelola Produk', icon: 'produk' },
      { to: '/categories',        label: 'Kategori',      icon: 'kategori' },
      { to: '/settings/store',    label: 'Kelola Toko',   icon: 'toko' },
      { to: '/settings/branding', label: 'Branding',      icon: 'branding' },
      { to: '/settings/printers', label: 'Printer',       icon: 'printer' },
      { to: '/settings/users',    label: 'Tim Outlet',    icon: 'tim' },
    )
  }
  return base
})

const bottomNavItems = computed(() => {
  if (canManage.value) {
    return [
      { to: '/pos',        label: 'Kasir',     icon: 'kasir' },
      { to: '/tagihan',    label: 'Tagihan',   icon: 'tagihan' },
      { to: '/products',   label: 'Produk',    icon: 'produk' },
      { to: '/shifts',     label: 'Shift',     icon: 'shift' },
      { to: '/orders',     label: 'Transaksi', icon: 'transaksi' },
    ]
  }
  return [
    { to: '/pos',        label: 'Kasir',     icon: 'kasir' },
    { to: '/tagihan',    label: 'Tagihan',   icon: 'tagihan' },
    { to: '/orders',     label: 'Transaksi', icon: 'transaksi' },
    { to: '/shifts',     label: 'Shift',     icon: 'shift' },
    { to: '/reports/daily', label: 'Laporan', icon: 'laporan' },
  ]
})

const showShell = computed(() => route.path !== '/login')
const closeDrawer = () => { isDrawerOpen.value = false }

onMounted(async () => { if (showShell.value) await bootstrap() })
watch(() => route.path, async (path) => {
  closeDrawer()
  if (path !== '/login') await bootstrap()
})
</script>

<template>
  <div v-if="showShell" class="app-shell">
    <div v-if="isDrawerOpen" class="drawer-backdrop" @click="closeDrawer" />

    <aside class="app-sidebar" :class="{ open: isDrawerOpen }">

      <!-- ── Brand / Logo ── -->
      <div class="sidebar-brand">
        <div class="sidebar-logo">
          <!--
            Logo mark: angkringan food stall
            Two pillars + arch roof = traditional warung tent
            Clean, geometric, memorable
          -->
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <!-- Tent arch -->
            <path d="M3 11 Q12 4 21 11" stroke="white" stroke-width="2.2" stroke-linecap="round" fill="none"/>
            <!-- Left pillar -->
            <line x1="6" y1="11" x2="6" y2="21" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
            <!-- Right pillar -->
            <line x1="18" y1="11" x2="18" y2="21" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
            <!-- Counter / floor line -->
            <line x1="4" y1="21" x2="20" y2="21" stroke="white" stroke-width="2" stroke-linecap="round"/>
            <!-- Dot accent (food/product symbol) -->
            <circle cx="12" cy="15" r="1.5" fill="rgba(255,255,255,0.7)"/>
          </svg>
        </div>
        <div class="sidebar-brand-text">
          <span class="sidebar-app-name">{{ config.public.appName }}</span>
          <span class="sidebar-tagline">POS Mobile-Ready</span>
        </div>
        <button class="sidebar-close mobile-only" @click="closeDrawer" aria-label="Tutup">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <!-- ── User ── -->
      <div class="sidebar-user">
        <div class="sidebar-avatar">{{ (profile?.full_name || 'U').slice(0,1).toUpperCase() }}</div>
        <div class="sidebar-user-info">
          <span class="sidebar-user-name">{{ profile?.full_name || 'Memuat...' }}</span>
          <div class="sidebar-user-meta">
            <span class="role-badge">{{ profile?.role || 'user' }}</span>
            <span class="outlet-name">{{ activeOutlet?.name || '—' }}</span>
          </div>
        </div>
      </div>

      <!-- ── Outlet Switcher ── -->
      <div v-if="outlets?.length" class="sidebar-outlet-switcher">
        <label class="switcher-label">Outlet aktif</label>
        <select
          :value="activeOutletId"
          class="switcher-select"
          @change="switchOutlet(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="o in outlets" :key="o.id" :value="o.id">{{ o.name }}</option>
        </select>
      </div>

      <!-- ── Nav (flex:1, overflow-y:auto, min-height:0 = footer always visible) ── -->
      <nav class="sidebar-nav">
        <p class="nav-section-label">Menu Utama</p>
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          @click="closeDrawer"
        >
          <svg
            class="nav-item-icon"
            width="18" height="18" viewBox="0 0 20 20" fill="none"
            v-html="icons[item.icon]"
          />
          <span class="nav-item-label">{{ item.label }}</span>
        </NuxtLink>
      </nav>

      <!-- ── Footer — always visible, safe-area aware ── -->
      <div class="sidebar-footer">
        <button class="sidebar-refresh-btn" @click="bootstrap(true)">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M12 7A5 5 0 1 1 7 2M7 2l2.5 2L7 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Refresh Data
        </button>
        <button class="sidebar-logout-btn" @click="signOut">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M5 2H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2M9 10l3-3-3-3M12 7H5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Keluar
        </button>
      </div>
    </aside>

    <!-- ── Main Content ── -->
    <div class="app-main">
      <header class="topbar">
        <div class="topbar-left">
          <button class="hamburger mobile-only" @click="isDrawerOpen = true" aria-label="Menu">
            <span /><span /><span />
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
            <option v-for="o in outlets" :key="o.id" :value="o.id">{{ o.name }}</option>
          </select>
          <button class="btn btn-ghost" @click="bootstrap(true)">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M12 7A5 5 0 1 1 7 2M7 2l2.5 2L7 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Refresh
          </button>
          <button class="btn btn-outline-danger" @click="signOut">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M5 2H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2M9 10l3-3-3-3M12 7H5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Logout
          </button>
        </div>
      </header>

      <div v-if="error" class="alert alert-warning top-alert">{{ error }}</div>

      <main class="content-shell">
        <slot />
      </main>
    </div>

    <!-- ── Mobile Bottom Nav ── -->
    <nav class="mobile-bottom-nav mobile-only">
      <NuxtLink
        v-for="item in bottomNavItems"
        :key="item.to"
        :to="item.to"
        class="bottom-nav-item"
      >
        <svg
          class="bottom-nav-svg"
          width="22" height="22" viewBox="0 0 20 20" fill="none"
          v-html="icons[item.icon]"
        />
        <span class="bottom-nav-label">{{ item.label }}</span>
      </NuxtLink>
    </nav>
  </div>

  <div v-else class="auth-shell">
    <slot />
  </div>
</template>

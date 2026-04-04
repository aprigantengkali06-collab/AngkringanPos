<script setup lang="ts">
const route = useRoute()
const config = useRuntimeConfig()
const workspace = useWorkspace()

const navItems = computed(() => {
  const base = [
    { to: '/pos', label: 'Kasir', icon: '🧾' },
    { to: '/orders', label: 'Transaksi', icon: '📚' },
    { to: '/reports/daily', label: 'Laporan', icon: '📈' },
    { to: '/expenses', label: 'Pengeluaran', icon: '💸' },
    { to: '/shifts', label: 'Shift', icon: '⏱️' }
  ]

  if (workspace.canManage.value) {
    base.push(
      { to: '/products', label: 'Produk', icon: '🍜' },
      { to: '/categories', label: 'Kategori', icon: '🗂️' },
      { to: '/settings/store', label: 'Outlet', icon: '🏪' },
      { to: '/settings/branding', label: 'Branding', icon: '🎨' },
      { to: '/settings/printers', label: 'Printer', icon: '🖨️' },
      { to: '/settings/users', label: 'Tim', icon: '👥' }
    )
  }

  return base
})

const showShell = computed(() => route.path !== '/login')
const appName = computed(() => config.public.appName)

onMounted(async () => {
  if (showShell.value) {
    await workspace.bootstrap()
  }
})

watch(() => route.path, async (path) => {
  if (path !== '/login') {
    await workspace.bootstrap()
  }
})
</script>

<template>
  <div v-if="showShell" class="app-shell">
    <aside class="app-sidebar">
      <div class="brand-block">
        <div class="brand-mark">🍢</div>
        <div>
          <p class="eyebrow">Business-ready POS</p>
          <h1>{{ appName }}</h1>
          <p class="muted small">Kasir, laporan, tim, shift, printer, dan kontrol outlet dalam satu dashboard.</p>
        </div>
      </div>

      <nav class="nav-list">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="nav-link"
        >
          <span>{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </NuxtLink>
      </nav>

      <div class="sidebar-panel">
        <p class="eyebrow">Akun aktif</p>
        <div class="sidebar-user">
          <strong>{{ workspace.profile?.full_name || 'Memuat...' }}</strong>
          <span class="badge badge-soft">{{ workspace.profile?.role || 'user' }}</span>
        </div>
        <p class="muted small">{{ workspace.activeOutlet?.name || 'Belum ada outlet aktif' }}</p>
      </div>
    </aside>

    <div class="app-main">
      <header class="topbar">
        <div>
          <p class="eyebrow">Outlet aktif</p>
          <h2>{{ workspace.activeOutlet?.name || 'Pilih outlet' }}</h2>
          <p class="muted small">{{ workspace.activeOutlet?.address || 'Alamat outlet belum diatur.' }}</p>
        </div>

        <div class="topbar-actions">
          <select
            v-if="workspace.outlets.length"
            :value="workspace.activeOutletId"
            class="input"
            style="min-width: 220px"
            @change="workspace.switchOutlet(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="outlet in workspace.outlets" :key="outlet.id" :value="outlet.id">
              {{ outlet.name }}
            </option>
          </select>
          <button class="btn btn-secondary" @click="workspace.bootstrap(true)">Refresh</button>
          <button class="btn btn-dark" @click="workspace.signOut">Logout</button>
        </div>
      </header>

      <div v-if="workspace.error" class="alert alert-warning" style="margin-bottom: 16px;">
        {{ workspace.error }}
      </div>

      <main class="content-shell">
        <slot />
      </main>
    </div>
  </div>

  <div v-else class="auth-shell">
    <slot />
  </div>
</template>

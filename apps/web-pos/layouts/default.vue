<script setup lang="ts">
const route = useRoute()
const config = useRuntimeConfig()

// ✅ FIX: Destructure refs dari composable supaya Vue template bisa auto-unwrap
// Sebelumnya: const workspace = useWorkspace()
// Bug: workspace.profile adalah Ref object, bukan nilai langsung
// Sehingga workspace.profile?.full_name = undefined → tampil "Memuat..."
// Sehingga workspace.profile?.role = undefined → tampil "user"
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
    { to: '/pos', label: 'Kasir', icon: '🧾' },
    { to: '/orders', label: 'Transaksi', icon: '📚' },
    { to: '/reports/daily', label: 'Laporan', icon: '📈' },
    { to: '/expenses', label: 'Pengeluaran', icon: '💸' },
    { to: '/shifts', label: 'Shift', icon: '⏱️' }
  ]

  // ✅ FIX: canManage sekarang top-level ref, di script tetap pakai .value
  if (canManage.value) {
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
    await bootstrap()
  }
})

watch(() => route.path, async (path) => {
  if (path !== '/login') {
    await bootstrap()
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

      <!-- ✅ FIX: profile sekarang top-level ref, Vue auto-unwrap di template -->
      <!-- Sebelum: workspace.profile?.full_name → undefined (Ref object tidak punya .full_name) -->
      <!-- Sesudah: profile?.full_name → tampil nama benar karena Ref di-unwrap otomatis -->
      <div class="sidebar-panel">
        <p class="eyebrow">Akun aktif</p>
        <div class="sidebar-user">
          <strong>{{ profile?.full_name || 'Memuat...' }}</strong>
          <span class="badge badge-soft">{{ profile?.role || 'user' }}</span>
        </div>
        <!-- ✅ FIX: activeOutlet sekarang top-level ComputedRef, auto-unwrap di template -->
        <p class="muted small">{{ activeOutlet?.name || 'Belum ada outlet aktif' }}</p>
      </div>
    </aside>

    <div class="app-main">
      <header class="topbar">
        <div>
          <p class="eyebrow">Outlet aktif</p>
          <!-- ✅ FIX: activeOutlet auto-unwrap sekarang -->
          <h2>{{ activeOutlet?.name || 'Pilih outlet' }}</h2>
          <p class="muted small">{{ activeOutlet?.address || 'Alamat outlet belum diatur.' }}</p>
        </div>

        <div class="topbar-actions">
          <!-- ✅ FIX: outlets sekarang top-level Ref, .length bisa dibaca dengan benar -->
          <select
            v-if="outlets?.length"
            :value="activeOutletId"
            class="input"
            style="min-width: 220px"
            @change="switchOutlet(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="outlet in outlets" :key="outlet.id" :value="outlet.id">
              {{ outlet.name }}
            </option>
          </select>
          <!-- ✅ FIX: panggil bootstrap() dan signOut() langsung, bukan via workspace. -->
          <button class="btn btn-secondary" @click="bootstrap(true)">Refresh</button>
          <button class="btn btn-dark" @click="signOut">Logout</button>
        </div>
      </header>

      <!-- ✅ FIX: error sekarang top-level Ref, v-if bisa baca nilai string-nya -->
      <!-- Sebelumnya: workspace.error adalah Ref object → selalu truthy! -->
      <div v-if="error" class="alert alert-warning" style="margin-bottom: 16px;">
        {{ error }}
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

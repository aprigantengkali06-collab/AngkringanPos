import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    profile: null as null | { id: string; full_name: string; role: 'owner' | 'manager' | 'cashier' },
    loading: false
  }),
  actions: {
    setProfile(profile: { id: string; full_name: string; role: 'owner' | 'manager' | 'cashier' } | null) {
      this.profile = profile
    }
  }
})

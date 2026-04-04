import { defineStore } from 'pinia'

export const useOutletStore = defineStore('outlet', {
  state: () => ({
    activeOutletId: ''
  }),
  actions: {
    setOutlet(outletId: string) {
      this.activeOutletId = outletId
    }
  }
})

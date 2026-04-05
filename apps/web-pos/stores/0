import { defineStore } from 'pinia'
import type { CartItem } from '~/types/app'

export const useCartStore = defineStore('cart', {
  state: () => ({
    customerName: '',
    paymentMethod: 'cash' as 'cash' | 'transfer' | 'qris',
    items: [] as CartItem[]
  }),
  getters: {
    subtotal: (state) => state.items.reduce((sum, item) => sum + item.subtotal, 0),
    totalQty: (state) => state.items.reduce((sum, item) => sum + item.qty, 0)
  },
  actions: {
    addItem(payload: CartItem) {
      const existing = this.items.find((item) => item.menu_id === payload.menu_id && item.notes === payload.notes)
      if (existing) {
        existing.qty += payload.qty
        existing.subtotal = existing.qty * existing.unit_price
        return
      }
      this.items.push(payload)
    },
    removeAt(index: number) {
      this.items.splice(index, 1)
    },
    clear() {
      this.customerName = ''
      this.paymentMethod = 'cash'
      this.items = []
    }
  }
})

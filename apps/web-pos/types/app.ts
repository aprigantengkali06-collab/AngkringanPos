export type AppRole = 'owner' | 'manager' | 'cashier'
export type PaymentMethod = 'cash' | 'transfer' | 'qris'
export type OrderStatus = 'draft' | 'paid' | 'void'

export interface Outlet {
  id: string
  name: string
  brand_name?: string | null
}

export interface MenuItem {
  id: string
  outlet_id: string
  category_id?: string | null
  sku?: string | null
  name: string
  price: number
  cost_price: number
  is_available: boolean
}

export interface CartItem {
  menu_id?: string | null
  item_name: string
  qty: number
  unit_price: number
  cost_price: number
  subtotal: number
  notes?: string | null
}

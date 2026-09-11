import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type OrderStatus = 'Pendente' | 'Confirmado' | 'Cancelado' | 'Entregue' | 'Contacto'

export interface Order {
  id: string
  userId: string
  userEmail: string
  userName: string
  programId: string
  programName: string
  planId: string
  planName: string
  amount: number
  currency: 'AOA' | 'EUR'
  status: OrderStatus
  phone: string
  address?: string
  nif?: string
  createdAt: string
  updatedAt: string
}

interface OrderContextType {
  orders: Order[]
  addOrder: (data: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>) => Order
  updateOrderStatus: (id: string, status: OrderStatus) => void
  getOrdersByUser: (userId: string) => Order[]
  getAllOrders: () => Order[]
}

const OrderContext = createContext<OrderContextType | undefined>(undefined)
const ORDERS_KEY = 'samora_orders'

export function OrderProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ORDERS_KEY)
      if (raw) setOrders(JSON.parse(raw))
    } catch {
      // ignore
    }
  }, [])

  const saveOrders = (o: Order[]) => {
    setOrders(o)
    localStorage.setItem(ORDERS_KEY, JSON.stringify(o))
  }

  const addOrder = (data: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): Order => {
    const now = new Date().toISOString()
    const order: Order = {
      ...data,
      id: `ORD-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    }
    saveOrders([order, ...orders])
    return order
  }

  const updateOrderStatus = (id: string, status: OrderStatus) => {
    saveOrders(orders.map(o => o.id === id ? { ...o, status, updatedAt: new Date().toISOString() } : o))
  }

  const getOrdersByUser = (userId: string) => orders.filter(o => o.userId === userId)
  const getAllOrders = () => orders

  return (
    <OrderContext.Provider value={{ orders, addOrder, updateOrderStatus, getOrdersByUser, getAllOrders }}>
      {children}
    </OrderContext.Provider>
  )
}

export function useOrders() {
  const ctx = useContext(OrderContext)
  if (!ctx) throw new Error('useOrders must be used within OrderProvider')
  return ctx
}

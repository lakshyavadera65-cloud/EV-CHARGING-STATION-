const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'

export interface UserAccount {
  id: number
  email: string
  role: 'OWNER' | 'CUSTOMER'
  name: string
  customer_id?: number | null
}

export interface ApiResponse<T> {
  success?: boolean
  message?: string
  data?: T
  count?: number
  totals?: any
  error?: {
    status?: number
    message?: string
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('chargeflow_token')
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return
  if (token) {
    localStorage.setItem('chargeflow_token', token)
  } else {
    localStorage.removeItem('chargeflow_token')
  }
}

export function getStoredUser(): UserAccount | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem('chargeflow_user')
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function setStoredUser(user: UserAccount | null) {
  if (typeof window === 'undefined') return
  if (user) {
    localStorage.setItem('chargeflow_user', JSON.stringify(user))
  } else {
    localStorage.removeItem('chargeflow_user')
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_URL}/api${path}`, {
    ...options,
    headers,
  })

  let body: any
  try {
    body = await response.json()
  } catch (err) {
    if (!response.ok) {
      throw new Error(`Server returned status ${response.status}: ${response.statusText}`)
    }
    return {} as T
  }

  if (!response.ok || body.success === false) {
    const errorMsg = body?.error?.message || body?.message || `Request failed (${response.status})`
    throw new Error(errorMsg)
  }

  // Return data if wrapped, or the whole body
  if (body.data !== undefined) {
    return body.data as T
  }
  return body as T
}

export const api = {
  // Auth
  auth: {
    login: async (creds: { email: string; password: string }) => {
      const res = await request<{ success: boolean; token: string; user: UserAccount }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(creds),
      })
      if (res.token) {
        setToken(res.token)
        setStoredUser(res.user)
      }
      return res
    },
    registerCustomer: async (data: { name: string; email: string; phone?: string; address?: string; password: string }) => {
      const res = await request<{ success: boolean; token: string; user: UserAccount }>('/auth/register/customer', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      if (res.token) {
        setToken(res.token)
        setStoredUser(res.user)
      }
      return res
    },
    registerOwner: async (data: { name: string; email: string; phone?: string; password: string }) => {
      const res = await request<{ success: boolean; token: string; user: UserAccount }>('/auth/register/owner', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      if (res.token) {
        setToken(res.token)
        setStoredUser(res.user)
      }
      return res
    },
    me: () => request<{ success: boolean; user: UserAccount }>('/auth/me'),
    logout: () => {
      setToken(null)
      setStoredUser(null)
    },
  },

  // Reports
  reports: {
    summary: () => request<any>('/reports/summary'),
    revenueByStation: () => request<any>('/reports/revenue-by-station'),
    customerEnergyUsage: () => request<any>('/reports/customer-energy-usage'),
    maintenanceCostByStation: () => request<any>('/reports/maintenance-cost-by-station'),
  },

  // Stations
  stations: {
    list: (params?: { status?: string; search?: string }) => {
      const q = params ? '?' + new URLSearchParams(params as any).toString() : ''
      return request<any[]>(`/stations${q}`)
    },
    get: (id: number | string) => request<any>(`/stations/${id}`),
    create: (data: any) => request<any>('/stations', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number | string, data: any) => request<any>(`/stations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: number | string) => request<any>(`/stations/${id}`, { method: 'DELETE' }),
  },

  // Chargers
  chargers: {
    list: (params?: { station_id?: string; status?: string; type?: string; connector?: string }) => {
      const q = params ? '?' + new URLSearchParams(params as any).toString() : ''
      return request<any[]>(`/chargers${q}`)
    },
    get: (id: number | string) => request<any>(`/chargers/${id}`),
    create: (data: any) => request<any>('/chargers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number | string, data: any) => request<any>(`/chargers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: number | string) => request<any>(`/chargers/${id}`, { method: 'DELETE' }),
  },

  // Bookings
  bookings: {
    list: (params?: { date?: string; status?: string; customer_id?: string; charger_id?: string; station_id?: string }) => {
      const q = params ? '?' + new URLSearchParams(params as any).toString() : ''
      return request<any[]>(`/bookings${q}`)
    },
    get: (id: number | string) => request<any>(`/bookings/${id}`),
    create: (data: any) => request<any>('/bookings', { method: 'POST', body: JSON.stringify(data) }),
    cancel: (id: number | string) => request<any>(`/bookings/${id}/cancel`, { method: 'PATCH' }),
    remove: (id: number | string) => request<any>(`/bookings/${id}`, { method: 'DELETE' }),
  },

  // Sessions
  sessions: {
    list: (params?: { status?: string; customer_id?: string; charger_id?: string; station_id?: string }) => {
      const q = params ? '?' + new URLSearchParams(params as any).toString() : ''
      return request<any[]>(`/sessions${q}`)
    },
    get: (id: number | string) => request<any>(`/sessions/${id}`),
    start: (data: { Booking_ID: number | string; Session_Start?: string }) =>
      request<any>('/sessions/start', { method: 'POST', body: JSON.stringify(data) }),
    end: (id: number | string, data: { Energy_Consumed: number; Session_End?: string }) =>
      request<any>(`/sessions/${id}/end`, { method: 'POST', body: JSON.stringify(data) }),
    remove: (id: number | string) => request<any>(`/sessions/${id}`, { method: 'DELETE' }),
  },

  // Payments
  payments: {
    list: (params?: { status?: string; method?: string; customer_id?: string; station_id?: string }) => {
      const q = params ? '?' + new URLSearchParams(params as any).toString() : ''
      return request<any[]>(`/payments${q}`)
    },
    get: (id: number | string) => request<any>(`/payments/${id}`),
    create: (data: { Session_ID: number | string; Payment_Method?: string; Payment_Date?: string; Payment_Status?: string; Amount?: number }) =>
      request<any>('/payments', { method: 'POST', body: JSON.stringify(data) }),
  },

  // Customers
  customers: {
    list: (params?: { search?: string }) => {
      const q = params ? '?' + new URLSearchParams(params as any).toString() : ''
      return request<any[]>(`/customers${q}`)
    },
    get: (id: number | string) => request<any>(`/customers/${id}`),
    create: (data: any) => request<any>('/customers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number | string, data: any) => request<any>(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: number | string) => request<any>(`/customers/${id}`, { method: 'DELETE' }),
  },

  // Employees
  employees: {
    list: (params?: { station_id?: string; designation?: string; search?: string }) => {
      const q = params ? '?' + new URLSearchParams(params as any).toString() : ''
      return request<any[]>(`/employees${q}`)
    },
    get: (id: number | string) => request<any>(`/employees/${id}`),
    create: (data: any) => request<any>('/employees', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number | string, data: any) => request<any>(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: number | string) => request<any>(`/employees/${id}`, { method: 'DELETE' }),
  },

  // Maintenance
  maintenance: {
    list: (params?: { status?: string; charger_id?: string; employee_id?: string; station_id?: string }) => {
      const q = params ? '?' + new URLSearchParams(params as any).toString() : ''
      return request<any[]>(`/maintenance${q}`)
    },
    get: (id: number | string) => request<any>(`/maintenance/${id}`),
    create: (data: any) => request<any>('/maintenance', { method: 'POST', body: JSON.stringify(data) }),
    complete: (id: number | string, data?: { Cost?: number }) =>
      request<any>(`/maintenance/${id}/complete`, { method: 'PATCH', body: JSON.stringify(data || {}) }),
    update: (id: number | string, data: any) => request<any>(`/maintenance/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: number | string) => request<any>(`/maintenance/${id}`, { method: 'DELETE' }),
  },
}

export { API_URL }

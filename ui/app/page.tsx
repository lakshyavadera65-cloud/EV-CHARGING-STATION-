'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Activity,
  AlertCircle,
  BatteryCharging,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  CreditCard,
  DollarSign,
  Download,
  Edit2,
  Filter,
  Gauge,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Moon,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  Wrench,
  X,
  Zap,
} from 'lucide-react'
import { api, getStoredUser, setStoredUser, UserAccount } from '@/lib/api'

// Toast notification model
interface ToastItem {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
}

// Activity notification model
interface AppNotification {
  id: string
  title: string
  detail: string
  time: string
}

export default function Page() {
  const [mounted, setMounted] = useState(false)
  const [active, setActive] = useState('Overview')
  const [dark, setDark] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // Current logged in user
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([
    {
      id: '1',
      title: 'Database Connected',
      detail: 'Connected to MySQL database ev_charging_db successfully.',
      time: 'Just now',
    },
  ])

  // Toasts
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4500)
  }

  const addNotification = (title: string, detail: string) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    setNotifications((prev) => [{ id: Math.random().toString(), title, detail, time: timeStr }, ...prev.slice(0, 15)])
  }

  // Real Database Entities
  const [summary, setSummary] = useState<any>(null)
  const [revenueByStation, setRevenueByStation] = useState<any[]>([])
  const [customerEnergyUsage, setCustomerEnergyUsage] = useState<any[]>([])
  const [stations, setStations] = useState<any[]>([])
  const [chargers, setChargers] = useState<any[]>([])
  const [bookings, setBookings] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [maintenance, setMaintenance] = useState<any[]>([])

  // Filters for sub-tabs
  const [chargerStatusFilter, setChargerStatusFilter] = useState('ALL')
  const [bookingStatusFilter, setBookingStatusFilter] = useState('ALL')
  const [sessionStatusFilter, setSessionStatusFilter] = useState('ALL')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('ALL')
  const [maintenanceStatusFilter, setMaintenanceStatusFilter] = useState('ALL')

  // Modals
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authTab, setAuthTab] = useState<'demo' | 'login' | 'register_customer' | 'register_owner'>('demo')
  const [authForm, setAuthForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    address: '',
  })

  // Entity Modals
  const [stationModalOpen, setStationModalOpen] = useState(false)
  const [editingStation, setEditingStation] = useState<any | null>(null)
  const [stationForm, setStationForm] = useState({
    Station_Name: '',
    Location: '',
    Contact_Number: '',
    Total_Chargers: '4',
    Operating_Hours: '24 Hours',
    Status: 'Active',
  })

  const [chargerModalOpen, setChargerModalOpen] = useState(false)
  const [editingCharger, setEditingCharger] = useState<any | null>(null)
  const [chargerForm, setChargerForm] = useState({
    Station_ID: '',
    Charger_Type: 'DC Fast',
    Connector_Type: 'CCS2',
    Power_Output: '50.00',
    Availability_Status: 'Available',
  })

  const [customerModalOpen, setCustomerModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null)
  const [customerForm, setCustomerForm] = useState({
    Customer_Name: '',
    Phone_Number: '',
    Email: '',
    Address: '',
  })

  const [employeeModalOpen, setEmployeeModalOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null)
  const [employeeForm, setEmployeeForm] = useState({
    Employee_Name: '',
    Phone_Number: '',
    Email: '',
    Designation: 'Technician',
    Station_ID: '',
  })

  const [bookingModalOpen, setBookingModalOpen] = useState(false)
  const [bookingForm, setBookingForm] = useState({
    Customer_ID: '',
    Charger_ID: '',
    Booking_Date: new Date().toISOString().split('T')[0],
    Start_Time: '10:00',
    End_Time: '11:00',
    Booking_Status: 'Confirmed',
  })

  const [startSessionModalOpen, setStartSessionModalOpen] = useState(false)
  const [selectedBookingForSession, setSelectedBookingForSession] = useState<any | null>(null)

  const [endSessionModalOpen, setEndSessionModalOpen] = useState(false)
  const [selectedSessionToEnd, setSelectedSessionToEnd] = useState<any | null>(null)
  const [endSessionKwh, setEndSessionKwh] = useState('20.00')

  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [selectedSessionToPay, setSelectedSessionToPay] = useState<any | null>(null)
  const [paymentForm, setPaymentForm] = useState({
    Payment_Method: 'UPI',
    Amount: '',
    Upi_Id: 'evdriver@okhdfcbank',
    Card_Number: '4532 8901 2345 6789',
    Card_Expiry: '12/28',
    Card_Cvv: '888',
    Bank_Name: 'HDFC Bank (Demo)',
  })

  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false)
  const [editingMaintenance, setEditingMaintenance] = useState<any | null>(null)
  const [maintenanceForm, setMaintenanceForm] = useState({
    Charger_ID: '',
    Employee_ID: '',
    Maintenance_Date: new Date().toISOString().split('T')[0],
    Status: 'In Progress',
    Cost: '500.00',
    Description: '',
  })

  // 1. Initial Setup: Mount check and Auto-Login
  useEffect(() => {
    setMounted(true)
    const initAuth = async () => {
      const stored = getStoredUser()
      if (stored) {
        setCurrentUser(stored)
        loadAllData()
      } else {
        // Auto-login as demo owner so dashboard immediately functions with real MySQL data
        try {
          const res = await api.auth.login({
            email: 'owner@demo.com',
            password: 'Owner@123',
          })
          setCurrentUser(res.user)
          addNotification('Auto Authenticated', 'Logged in as Demo Station Owner (owner@demo.com)')
          loadAllData()
        } catch (err: any) {
          console.warn('Auto-login error:', err)
          addToast('Please login or create an account to start', 'info')
        }
      }
    }
    initAuth()
  }, [])

  // 2. Fetch all real data from backend
  const loadAllData = async () => {
    setLoading(true)
    try {
      // Parallel fetches with fault tolerance
      const [
        summaryRes,
        revRes,
        energyRes,
        stationsRes,
        chargersRes,
        bookingsRes,
        sessionsRes,
        paymentsRes,
        customersRes,
        employeesRes,
        maintRes,
      ] = await Promise.allSettled([
        api.reports.summary(),
        api.reports.revenueByStation(),
        api.reports.customerEnergyUsage(),
        api.stations.list(),
        api.chargers.list(),
        api.bookings.list(),
        api.sessions.list(),
        api.payments.list(),
        api.customers.list(),
        api.employees.list(),
        api.maintenance.list(),
      ])

      if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value)
      if (revRes.status === 'fulfilled') setRevenueByStation(revRes.value?.data || revRes.value || [])
      if (energyRes.status === 'fulfilled') setCustomerEnergyUsage(energyRes.value?.data || energyRes.value || [])
      if (stationsRes.status === 'fulfilled') setStations(stationsRes.value || [])
      if (chargersRes.status === 'fulfilled') setChargers(chargersRes.value || [])
      if (bookingsRes.status === 'fulfilled') setBookings(bookingsRes.value || [])
      if (sessionsRes.status === 'fulfilled') setSessions(sessionsRes.value || [])
      if (paymentsRes.status === 'fulfilled') setPayments(paymentsRes.value || [])
      if (customersRes.status === 'fulfilled') setCustomers(customersRes.value || [])
      if (employeesRes.status === 'fulfilled') setEmployees(employeesRes.value || [])
      if (maintRes.status === 'fulfilled') setMaintenance(maintRes.value || [])
    } catch (err: any) {
      console.error('Data load error:', err)
      addToast(err.message || 'Error refreshing data', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Refresh trigger
  const triggerRefresh = () => {
    setRefreshKey((k) => k + 1)
    loadAllData()
  }

  // Navigation Items
  const nav = [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'Stations', icon: Gauge },
    { label: 'Chargers', icon: BatteryCharging },
    { label: 'Bookings', icon: CalendarDays },
    { label: 'Sessions', icon: Activity },
    { label: 'Payments', icon: CreditCard },
    { label: 'Customers', icon: Users },
    { label: 'Employees', icon: UserCheck },
    { label: 'Maintenance', icon: Wrench },
  ]

  // KPI calculations
  const totalRevenue = useMemo(() => {
    if (summary?.financials?.total_revenue !== undefined) {
      return Number(summary.financials.total_revenue)
    }
    if (summary?.payments?.revenue_collected !== undefined) {
      return Number(summary.payments.revenue_collected)
    }
    return payments
      .filter((p) => p.Payment_Status === 'Paid')
      .reduce((acc, curr) => acc + Number(curr.Amount || 0), 0)
  }, [summary, payments])

  const totalEnergy = useMemo(() => {
    if (summary?.sessions?.total_energy_kwh !== undefined) {
      return Number(summary.sessions.total_energy_kwh)
    }
    if (summary?.sessions?.total_energy_consumed_kwh !== undefined) {
      return Number(summary.sessions.total_energy_consumed_kwh)
    }
    return sessions.reduce((acc, curr) => acc + Number(curr.Energy_Consumed || 0), 0)
  }, [summary, sessions])

  const totalStations = summary?.stations?.total ?? stations.length
  const availableChargers = summary?.chargers?.available ?? chargers.filter((c) => c.Availability_Status === 'Available').length
  const totalChargers = summary?.chargers?.total ?? chargers.length
  const activeBookings = summary?.bookings?.confirmed ?? bookings.filter((b) => b.Booking_Status === 'Confirmed').length

  // Filtered lists based on search query
  const q = query.toLowerCase().trim()

  const filteredStations = useMemo(() => {
    return stations.filter((s) => !q || `${s.Station_Name} ${s.Location} ${s.Status}`.toLowerCase().includes(q))
  }, [stations, q])

  const filteredChargers = useMemo(() => {
    return chargers.filter((c) => {
      const matchesStatus = chargerStatusFilter === 'ALL' || c.Availability_Status === chargerStatusFilter
      const matchesQuery =
        !q ||
        `${c.Charger_ID} ${c.Charger_Type} ${c.Connector_Type} ${c.Station_Name} ${c.Availability_Status}`
          .toLowerCase()
          .includes(q)
      return matchesStatus && matchesQuery
    })
  }, [chargers, chargerStatusFilter, q])

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const matchesStatus = bookingStatusFilter === 'ALL' || b.Booking_Status === bookingStatusFilter
      const matchesQuery =
        !q ||
        `${b.Booking_ID} ${b.Customer_Name} ${b.Station_Name} ${b.Charger_Type} ${b.Booking_Date}`
          .toLowerCase()
          .includes(q)
      return matchesStatus && matchesQuery
    })
  }, [bookings, bookingStatusFilter, q])

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const isCompleted = s.Session_End !== null
      const matchesStatus =
        sessionStatusFilter === 'ALL' ||
        (sessionStatusFilter === 'ACTIVE' && !isCompleted) ||
        (sessionStatusFilter === 'COMPLETED' && isCompleted)
      const matchesQuery =
        !q ||
        `${s.Session_ID} ${s.Customer_Name} ${s.Station_Name} ${s.Charger_ID} ${s.Booking_ID}`
          .toLowerCase()
          .includes(q)
      return matchesStatus && matchesQuery
    })
  }, [sessions, sessionStatusFilter, q])

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const matchesStatus = paymentStatusFilter === 'ALL' || p.Payment_Status === paymentStatusFilter
      const matchesQuery =
        !q ||
        `${p.Payment_ID} ${p.Customer_Name} ${p.Station_Name} ${p.Payment_Method} ${p.Payment_Status} ${p.Session_ID}`
          .toLowerCase()
          .includes(q)
      return matchesStatus && matchesQuery
    })
  }, [payments, paymentStatusFilter, q])

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      return (
        !q ||
        `${c.Customer_Name} ${c.Email} ${c.Phone_Number} ${c.Address}`
          .toLowerCase()
          .includes(q)
      )
    })
  }, [customers, q])

  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      return (
        !q ||
        `${e.Employee_Name} ${e.Designation} ${e.Station_Name} ${e.Email} ${e.Phone_Number}`
          .toLowerCase()
          .includes(q)
      )
    })
  }, [employees, q])

  const filteredMaintenance = useMemo(() => {
    return maintenance.filter((m) => {
      const matchesStatus = maintenanceStatusFilter === 'ALL' || m.Status === maintenanceStatusFilter
      const matchesQuery =
        !q ||
        `${m.Maintenance_ID} ${m.Charger_ID} ${m.Station_Name} ${m.Employee_Name} ${m.Description}`
          .toLowerCase()
          .includes(q)
      return matchesStatus && matchesQuery
    })
  }, [maintenance, maintenanceStatusFilter, q])

  // Chart data formatted
  const chartRevenue = useMemo(() => {
    if (!revenueByStation || revenueByStation.length === 0) {
      return stations.map((s) => ({ name: s.Station_Name.split(' ')[0], value: 0 }))
    }
    return revenueByStation.map((item) => ({
      name: (item.Station_Name || `Stn ${item.Station_ID}`).split(' ')[0],
      fullName: item.Station_Name,
      value: parseFloat(item.Total_Revenue || 0),
    }))
  }, [revenueByStation, stations])

  const chartEnergy = useMemo(() => {
    if (!customerEnergyUsage || customerEnergyUsage.length === 0) {
      return customers.slice(0, 5).map((c) => ({ name: c.Customer_Name.split(' ')[0], value: 0 }))
    }
    return customerEnergyUsage.slice(0, 6).map((item) => ({
      name: (item.Customer_Name || `Cust ${item.Customer_ID}`).split(' ')[0],
      fullName: item.Customer_Name,
      value: parseFloat(item.Total_Energy_KWh || 0),
    }))
  }, [customerEnergyUsage, customers])

  // CSV Export Function
  const handleExportCSV = () => {
    let rows: any[] = []
    let filename = `chargeflow_${active.toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`

    if (active === 'Stations') rows = filteredStations
    else if (active === 'Chargers') rows = filteredChargers
    else if (active === 'Bookings') rows = filteredBookings
    else if (active === 'Sessions') rows = filteredSessions
    else if (active === 'Payments') rows = filteredPayments
    else if (active === 'Customers') rows = filteredCustomers
    else if (active === 'Employees') rows = filteredEmployees
    else if (active === 'Maintenance') rows = filteredMaintenance
    else {
      // Overview export: revenue by station
      rows = revenueByStation.length > 0 ? revenueByStation : filteredSessions
      filename = `chargeflow_overview_summary_${new Date().toISOString().split('T')[0]}.csv`
    }

    if (!rows || rows.length === 0) {
      addToast('No data available to export', 'info')
      return
    }

    const headers = Object.keys(rows[0])
    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        headers
          .map((field) => {
            const val = row[field] === null || row[field] === undefined ? '' : String(row[field])
            return `"${val.replace(/"/g, '""')}"`
          })
          .join(',')
      ),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    addToast(`Exported ${rows.length} rows to ${filename}`, 'success')
  }

  // -------------------------------------------------------------
  // ACTIONS: CRUD & FLOWS
  // -------------------------------------------------------------

  // --- Auth Handlers ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await api.auth.login({
        email: authForm.email,
        password: authForm.password,
      })
      setCurrentUser(res.user)
      setAuthModalOpen(false)
      addToast(`Welcome back, ${res.user.name}!`, 'success')
      addNotification('Logged In', `User ${res.user.email} signed in as ${res.user.role}.`)
      triggerRefresh()
    } catch (err: any) {
      addToast(err.message, 'error')
    }
  }

  const handleRegisterCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await api.auth.registerCustomer({
        name: authForm.name,
        email: authForm.email,
        phone: authForm.phone,
        address: authForm.address,
        password: authForm.password,
      })
      setCurrentUser(res.user)
      setAuthModalOpen(false)
      addToast(`Customer account created! Welcome ${res.user.name}`, 'success')
      addNotification('Account Created', `New customer ${res.user.email} registered.`)
      triggerRefresh()
    } catch (err: any) {
      addToast(err.message, 'error')
    }
  }

  const handleRegisterOwner = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await api.auth.registerOwner({
        name: authForm.name,
        email: authForm.email,
        phone: authForm.phone,
        password: authForm.password,
      })
      setCurrentUser(res.user)
      setAuthModalOpen(false)
      addToast(`Station Owner account registered! Welcome ${res.user.name}`, 'success')
      addNotification('Owner Registered', `New owner ${res.user.email} registered.`)
      triggerRefresh()
    } catch (err: any) {
      addToast(err.message, 'error')
    }
  }

  const handleDemoSwitch = async (role: 'OWNER' | 'CUSTOMER') => {
    try {
      if (role === 'OWNER') {
        const res = await api.auth.login({
          email: 'owner@demo.com',
          password: 'Owner@123',
        })
        setCurrentUser(res.user)
        addToast('Switched to Demo Station Owner (owner@demo.com)', 'success')
        addNotification('Role Switched', 'Active account: Demo Station Owner')
      } else {
        const res = await api.auth.login({
          email: 'rahul@gmail.com',
          password: 'Customer@123',
        })
        setCurrentUser(res.user)
        addToast('Switched to Demo Customer (rahul@gmail.com)', 'success')
        addNotification('Role Switched', 'Active account: Demo Customer')
      }
      setAuthModalOpen(false)
      setUserMenuOpen(false)
      triggerRefresh()
    } catch (err: any) {
      addToast(err.message, 'error')
    }
  }

  const handleLogout = () => {
    api.auth.logout()
    setCurrentUser(null)
    setUserMenuOpen(false)
    addToast('You have been logged out', 'info')
  }

  // --- Station CRUD ---
  const handleSaveStation = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (!stationForm.Station_Name.trim() || !stationForm.Location.trim()) {
        addToast('Station Name and Location are required', 'error')
        return
      }

      if (editingStation) {
        await api.stations.update(editingStation.Station_ID, stationForm)
        addToast(`Station "${stationForm.Station_Name}" updated successfully`, 'success')
        addNotification('Station Updated', `Station #${editingStation.Station_ID} modified.`)
      } else {
        await api.stations.create(stationForm)
        addToast(`Station "${stationForm.Station_Name}" created successfully`, 'success')
        addNotification('Station Created', `New station "${stationForm.Station_Name}" added.`)
      }
      setStationModalOpen(false)
      setEditingStation(null)
      triggerRefresh()
    } catch (err: any) {
      addToast(err.message, 'error')
    }
  }

  const handleDeleteStation = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete station "${name}" (ID #${id})?`)) return
    try {
      await api.stations.remove(id)
      addToast(`Station #${id} deleted`, 'success')
      addNotification('Station Deleted', `Station #${id} removed.`)
      triggerRefresh()
    } catch (err: any) {
      addToast(err.message, 'error')
    }
  }

  // --- Charger CRUD ---
  const handleSaveCharger = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (!chargerForm.Station_ID) {
        addToast('Please select a Charging Station', 'error')
        return
      }

      const payload = {
        Station_ID: parseInt(chargerForm.Station_ID, 10),
        Charger_Type: chargerForm.Charger_Type,
        Connector_Type: chargerForm.Connector_Type,
        Power_Output: parseFloat(chargerForm.Power_Output) || 50,
        Availability_Status: chargerForm.Availability_Status,
      }

      if (editingCharger) {
        await api.chargers.update(editingCharger.Charger_ID, payload)
        addToast(`Charger #${editingCharger.Charger_ID} updated`, 'success')
        addNotification('Charger Updated', `Charger #${editingCharger.Charger_ID} modified.`)
      } else {
        await api.chargers.create(payload)
        addToast('New charger point added successfully', 'success')
        addNotification('Charger Added', `New ${payload.Charger_Type} charger installed.`)
      }
      setChargerModalOpen(false)
      setEditingCharger(null)
      triggerRefresh()
    } catch (err: any) {
      addToast(err.message, 'error')
    }
  }

  const handleDeleteCharger = async (id: number) => {
    if (!confirm(`Delete Charger #${id}?`)) return
    try {
      await api.chargers.remove(id)
      addToast(`Charger #${id} deleted`, 'success')
      addNotification('Charger Deleted', `Charger #${id} removed.`)
      triggerRefresh()
    } catch (err: any) {
      addToast(err.message, 'error')
    }
  }

  // --- Customer CRUD ---
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (!customerForm.Customer_Name.trim()) {
        addToast('Customer Name is required', 'error')
        return
      }
      if (editingCustomer) {
        await api.customers.update(editingCustomer.Customer_ID, customerForm)
        addToast(`Customer "${customerForm.Customer_Name}" updated`, 'success')
        addNotification('Customer Updated', `Customer #${editingCustomer.Customer_ID} details modified.`)
      } else {
        await api.customers.create(customerForm)
        addToast(`Customer "${customerForm.Customer_Name}" added`, 'success')
        addNotification('Customer Added', `Customer "${customerForm.Customer_Name}" registered.`)
      }
      setCustomerModalOpen(false)
      setEditingCustomer(null)
      triggerRefresh()
    } catch (err: any) {
      addToast(err.message, 'error')
    }
  }

  const handleDeleteCustomer = async (id: number, name: string) => {
    if (!confirm(`Delete customer "${name}" (ID #${id})?`)) return
    try {
      await api.customers.remove(id)
      addToast(`Customer #${id} deleted`, 'success')
      addNotification('Customer Deleted', `Customer #${id} removed.`)
      triggerRefresh()
    } catch (err: any) {
      addToast(err.message, 'error')
    }
  }

  // --- Employee CRUD ---
  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (!employeeForm.Employee_Name.trim() || !employeeForm.Station_ID) {
        addToast('Employee Name and Station are required', 'error')
        return
      }

      const payload = {
        ...employeeForm,
        Station_ID: parseInt(employeeForm.Station_ID, 10),
      }

      if (editingEmployee) {
        await api.employees.update(editingEmployee.Employee_ID, payload)
        addToast(`Employee "${employeeForm.Employee_Name}" updated`, 'success')
        addNotification('Employee Updated', `Staff member #${editingEmployee.Employee_ID} updated.`)
      } else {
        await api.employees.create(payload)
        addToast(`Employee "${employeeForm.Employee_Name}" registered`, 'success')
        addNotification('Employee Added', `New staff member "${employeeForm.Employee_Name}" added.`)
      }
      setEmployeeModalOpen(false)
      setEditingEmployee(null)
      triggerRefresh()
    } catch (err: any) {
      addToast(err.message, 'error')
    }
  }

  const handleDeleteEmployee = async (id: number, name: string) => {
    if (!confirm(`Delete employee "${name}"?`)) return
    try {
      await api.employees.remove(id)
      addToast(`Employee #${id} deleted`, 'success')
      addNotification('Employee Deleted', `Staff #${id} deleted.`)
      triggerRefresh()
    } catch (err: any) {
      addToast(err.message, 'error')
    }
  }

  // --- Booking Flow & Validations ---
  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { Customer_ID, Charger_ID, Booking_Date, Start_Time, End_Time, Booking_Status } = bookingForm

      if (!Customer_ID || !Charger_ID || !Booking_Date || !Start_Time || !End_Time) {
        addToast('All booking fields are required', 'error')
        return
      }

      // Client validation: End_Time must be after Start_Time
      if (End_Time <= Start_Time) {
        addToast(`End Time (${End_Time}) must be after Start Time (${Start_Time})`, 'error')
        return
      }

      const payload = {
        Customer_ID: parseInt(Customer_ID, 10),
        Charger_ID: parseInt(Charger_ID, 10),
        Booking_Date,
        Start_Time,
        End_Time,
        Booking_Status,
      }

      await api.bookings.create(payload)
      addToast('Booking confirmed successfully!', 'success')
      addNotification('Booking Created', `Slot booked on ${Booking_Date} (${Start_Time} - ${End_Time})`)
      setBookingModalOpen(false)
      triggerRefresh()
    } catch (err: any) {
      addToast(err.message, 'error')
    }
  }

  const handleCancelBooking = async (id: number) => {
    if (!confirm(`Cancel Booking #${id}?`)) return
    try {
      await api.bookings.cancel(id)
      addToast(`Booking #${id} cancelled`, 'success')
      addNotification('Booking Cancelled', `Booking #${id} was cancelled.`)
      triggerRefresh()
    } catch (err: any) {
      addToast(err.message, 'error')
    }
  }

  const handleDeleteBooking = async (id: number) => {
    if (!confirm(`Delete Booking #${id}?`)) return
    try {
      await api.bookings.remove(id)
      addToast(`Booking #${id} removed`, 'success')
      triggerRefresh()
    } catch (err: any) {
      addToast(err.message, 'error')
    }
  }

  // --- Charging Session Lifecycle ---
  const handleStartSession = async () => {
    if (!selectedBookingForSession) return
    try {
      await api.sessions.start({
        Booking_ID: selectedBookingForSession.Booking_ID,
      })
      addToast(`Charging session started for Booking #${selectedBookingForSession.Booking_ID}! Charger is now Occupied.`, 'success')
      addNotification('Session Started', `Charging started for ${selectedBookingForSession.Customer_Name} (Charger #${selectedBookingForSession.Charger_ID})`)
      setStartSessionModalOpen(false)
      setSelectedBookingForSession(null)
      triggerRefresh()
    } catch (err: any) {
      addToast(err.message, 'error')
    }
  }

  const handleEndSession = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSessionToEnd) return
    try {
      const kwh = parseFloat(endSessionKwh)
      if (isNaN(kwh) || kwh < 0) {
        addToast('Please enter a valid energy amount (kWh)', 'error')
        return
      }

      const res = await api.sessions.end(selectedSessionToEnd.Session_ID, {
        Energy_Consumed: kwh,
      })

      const cost = res.calculation?.charging_cost ?? (kwh * 12.0)
      addToast(`Session ended! Cost calculated: ₹ ${cost.toFixed(2)}. Charger is now Available.`, 'success')
      addNotification(
        'Session Completed',
        `Session #${selectedSessionToEnd.Session_ID} ended with ${kwh} kWh delivered (₹ ${cost.toFixed(2)}).`
      )
      setEndSessionModalOpen(false)
      setSelectedSessionToEnd(null)
      triggerRefresh()
    } catch (err: any) {
      addToast(err.message, 'error')
    }
  }

  // --- Payment Flow ---
  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSessionToPay) return
    try {
      const amount = parseFloat(paymentForm.Amount) || parseFloat(selectedSessionToPay.Charging_Cost || '0')
      await api.payments.create({
        Session_ID: selectedSessionToPay.Session_ID,
        Payment_Method: paymentForm.Payment_Method,
        Amount: amount,
        Payment_Status: 'Paid',
      })
      addToast(`Payment of ₹ ${amount.toFixed(2)} processed via ${paymentForm.Payment_Method}!`, 'success')
      addNotification('Payment Received', `₹ ${amount.toFixed(2)} received via ${paymentForm.Payment_Method} for Session #${selectedSessionToPay.Session_ID}`)
      setPaymentModalOpen(false)
      setSelectedSessionToPay(null)
      triggerRefresh()
    } catch (err: any) {
      addToast(err.message, 'error')
    }
  }

  // --- Maintenance Flow ---
  const handleSaveMaintenance = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (!maintenanceForm.Charger_ID || !maintenanceForm.Employee_ID) {
        addToast('Charger and Employee must be selected', 'error')
        return
      }

      const payload = {
        Charger_ID: parseInt(maintenanceForm.Charger_ID, 10),
        Employee_ID: parseInt(maintenanceForm.Employee_ID, 10),
        Maintenance_Date: maintenanceForm.Maintenance_Date,
        Status: maintenanceForm.Status,
        Cost: parseFloat(maintenanceForm.Cost) || 0,
        Description: maintenanceForm.Description,
      }

      if (editingMaintenance) {
        await api.maintenance.update(editingMaintenance.Maintenance_ID, payload)
        addToast(`Maintenance #${editingMaintenance.Maintenance_ID} updated`, 'success')
        addNotification('Maintenance Updated', `Job #${editingMaintenance.Maintenance_ID} updated.`)
      } else {
        await api.maintenance.create(payload)
        const chargerMsg = payload.Status === 'In Progress' ? 'Charger set to Maintenance mode.' : 'Charger is Available.'
        addToast(`Maintenance task logged! ${chargerMsg}`, 'success')
        addNotification('Maintenance Logged', `Charger #${payload.Charger_ID} maintenance logged (${payload.Status}).`)
      }
      setMaintenanceModalOpen(false)
      setEditingMaintenance(null)
      triggerRefresh()
    } catch (err: any) {
      addToast(err.message, 'error')
    }
  }

  const handleCompleteMaintenance = async (id: number) => {
    try {
      await api.maintenance.complete(id)
      addToast(`Maintenance #${id} marked as Completed! Charger is back to Available.`, 'success')
      addNotification('Maintenance Completed', `Maintenance #${id} finished; charger restored to Available.`)
      triggerRefresh()
    } catch (err: any) {
      addToast(err.message, 'error')
    }
  }

  const handleDeleteMaintenance = async (id: number) => {
    if (!confirm(`Delete maintenance record #${id}?`)) return
    try {
      await api.maintenance.remove(id)
      addToast(`Maintenance record #${id} removed`, 'success')
      triggerRefresh()
    } catch (err: any) {
      addToast(err.message, 'error')
    }
  }

  if (!mounted) {
    return <div className="app" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>Loading ChargeFlow...</div>
  }

  return (
    <div className={dark ? 'app dark' : 'app'}>
      {/* Toast Alert Notifications */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {toast.type === 'success' && <CheckCircle2 size={16} />}
              {toast.type === 'error' && <AlertCircle size={16} />}
              {toast.type === 'info' && <Zap size={16} />}
              <span>{toast.message}</span>
            </div>
            <button
              className="toast-close"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Sidebar Navigation */}
      <aside className={mobileOpen ? 'sidebar open' : 'sidebar'}>
        <div className="brand">
          <div className="brand-mark">
            <Zap size={19} fill="currentColor" />
          </div>
          <div>
            <strong>
              Charge<span>Flow</span>
            </strong>
            <small>REAL MYSQL OPERATIONS</small>
          </div>
          <button className="mobile-close" onClick={() => setMobileOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <nav>
          <p className="nav-heading">MAIN MENU</p>
          {nav.map(({ label, icon: Icon }) => (
            <button
              key={label}
              onClick={() => {
                setActive(label)
                setMobileOpen(false)
              }}
              className={active === label ? 'nav-item active' : 'nav-item'}
            >
              <Icon size={18} />
              <span>{label}</span>
              {label === 'Bookings' && activeBookings > 0 && <em>{activeBookings}</em>}
              {label === 'Chargers' && availableChargers > 0 && <em>{availableChargers}</em>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button
            className="nav-item"
            onClick={() => {
              setAuthTab('demo')
              setAuthModalOpen(true)
            }}
          >
            <UserPlus size={18} />
            <span>Create / Switch Account</span>
          </button>

          <button className="nav-item" onClick={triggerRefresh}>
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            <span>Refresh Data</span>
          </button>

          {/* User Profile Chip */}
          <div
            className="user-chip"
            style={{ cursor: 'pointer', position: 'relative' }}
            onClick={() => setUserMenuOpen(!userMenuOpen)}
          >
            <div className="avatar">
              {currentUser?.name ? currentUser.name.slice(0, 2).toUpperCase() : 'CF'}
            </div>
            <div>
              <strong>{currentUser?.name || 'ChargeFlow User'}</strong>
              <small>{currentUser?.role || 'Guest'} · {currentUser?.email?.split('@')[0] || 'demo'}</small>
            </div>
            <ChevronDown size={15} />

            {/* User Dropdown Menu */}
            {userMenuOpen && (
              <div
                className="user-menu-popover"
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ padding: '6px 8px', fontSize: 11, color: 'var(--muted)' }}>
                  Signed in as <strong>{currentUser?.email || 'Guest'}</strong>
                </div>
                <div className="user-menu-divider" />
                <button
                  className="user-menu-item"
                  onClick={() => {
                    handleDemoSwitch('OWNER')
                  }}
                >
                  <ShieldCheck size={14} />
                  <span>Switch to Owner (Demo)</span>
                </button>
                <button
                  className="user-menu-item"
                  onClick={() => {
                    handleDemoSwitch('CUSTOMER')
                  }}
                >
                  <Users size={14} />
                  <span>Switch to Customer (Demo)</span>
                </button>
                <button
                  className="user-menu-item"
                  onClick={() => {
                    setUserMenuOpen(false)
                    setAuthTab('register_customer')
                    setAuthModalOpen(true)
                  }}
                >
                  <UserPlus size={14} />
                  <span>Register Customer</span>
                </button>
                <button
                  className="user-menu-item"
                  onClick={() => {
                    setUserMenuOpen(false)
                    setAuthTab('register_owner')
                    setAuthModalOpen(true)
                  }}
                >
                  <Gauge size={14} />
                  <span>Register Station Owner</span>
                </button>
                <div className="user-menu-divider" />
                <button className="user-menu-item" onClick={handleLogout}>
                  <LogOut size={14} />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main">
        {/* Top Header */}
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileOpen(true)}>
            <Menu size={21} />
          </button>
          <div className="breadcrumb">
            <span>Workspace</span>
            <span>/</span>
            <strong>{active}</strong>
          </div>

          <div className="top-actions">
            <div className="search">
              <Search size={17} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search in ${active}...`}
              />
              {query && (
                <button
                  style={{ background: 'none', border: 0, color: 'var(--muted)', cursor: 'pointer' }}
                  onClick={() => setQuery('')}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <button
              className="icon-button"
              aria-label="Toggle theme"
              onClick={() => setDark(!dark)}
              title="Toggle Dark Mode"
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button
              className="icon-button notification"
              aria-label="Notifications"
              onClick={() => setNotifOpen(!notifOpen)}
              title="Activity Log"
            >
              <Bell size={18} />
              {notifications.length > 0 && <i />}
            </button>

            {/* Notification Drawer */}
            {notifOpen && (
              <div className="notification-popover">
                <div className="notif-header">
                  <span>SYSTEM ACTIVITY LOG</span>
                  <button
                    className="link-button"
                    onClick={() => setNotifications([])}
                  >
                    Clear
                  </button>
                </div>
                {notifications.length === 0 ? (
                  <div className="empty" style={{ minHeight: 60 }}>No recent activity.</div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="notif-item">
                      <strong>{n.title}</strong>
                      <span>{n.detail}</span>
                      <small>{n.time}</small>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </header>

        {/* Dynamic Page Views */}
        <div className="content">
          {/* Top Intro Section */}
          <div className="page-intro">
            <div>
              <p className="eyebrow">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                }).toUpperCase()}{' '}
                <span className="live-dot" /> LIVE MYSQL: ev_charging_db
              </p>
              <h1>
                Welcome back, {currentUser?.name ? currentUser.name.split(' ')[0] : 'Admin'}.
              </h1>
              <p className="muted">
                Real-time management for EV charging stations, chargers, bookings, and billing.
              </p>
            </div>
            <button className="export-button" onClick={handleExportCSV}>
              <Download size={16} /> Export {active} (CSV)
            </button>
          </div>

          {/* -------------------------------------------------------------
              VIEW 1: OVERVIEW DASHBOARD
             ------------------------------------------------------------- */}
          {active === 'Overview' && (
            <>
              {/* Real KPI Cards */}
              <section className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon green">
                    <CreditCard size={20} />
                  </div>
                  <div>
                    <p className="muted small">Total Revenue</p>
                    <p className="stat-value">₹ {totalRevenue.toLocaleString('en-IN')}</p>
                    <p className="trend">Real paid transactions</p>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon blue">
                    <Zap size={20} />
                  </div>
                  <div>
                    <p className="muted small">Energy Delivered</p>
                    <p className="stat-value">{totalEnergy.toLocaleString('en-IN')} kWh</p>
                    <p className="trend">Across all sessions</p>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon orange">
                    <Gauge size={20} />
                  </div>
                  <div>
                    <p className="muted small">Active Stations</p>
                    <p className="stat-value">{totalStations} stations</p>
                    <p className="trend">{chargers.length} chargers deployed</p>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon purple">
                    <BatteryCharging size={20} />
                  </div>
                  <div>
                    <p className="muted small">Available Chargers</p>
                    <p className="stat-value">
                      {availableChargers} / {totalChargers}
                    </p>
                    <p className="trend">
                      {totalChargers > 0
                        ? `${Math.round((availableChargers / totalChargers) * 100)}% available`
                        : 'No chargers'}
                    </p>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon rose">
                    <CalendarDays size={20} />
                  </div>
                  <div>
                    <p className="muted small">Active Bookings</p>
                    <p className="stat-value">{activeBookings}</p>
                    <p className="trend">Confirmed & awaiting charge</p>
                  </div>
                </div>
              </section>

              {/* Real Recharts Visualizations */}
              <section className="chart-grid">
                {/* Revenue by Station */}
                <div className="panel chart-panel">
                  <div className="panel-header">
                    <div>
                      <h2>Revenue by Station</h2>
                      <p className="muted small">Total paid revenue from /api/reports/revenue-by-station</p>
                    </div>
                  </div>
                  <div className="chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartRevenue} margin={{ top: 12, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: 'var(--muted)', fontSize: 11 }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: 'var(--muted)', fontSize: 11 }}
                          tickFormatter={(v) => `₹${v}`}
                        />
                        <Tooltip
                          cursor={{ fill: 'var(--surface-2)' }}
                          formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']}
                        />
                        <Bar dataKey="value" fill="var(--green)" radius={[5, 5, 0, 0]} barSize={34} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Customer Energy Usage */}
                <div className="panel chart-panel">
                  <div className="panel-header">
                    <div>
                      <h2>Customer Energy Usage</h2>
                      <p className="muted small">Delivered energy (kWh) from /api/reports/customer-energy-usage</p>
                    </div>
                  </div>
                  <div className="chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartEnergy}
                        layout="vertical"
                        margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
                      >
                        <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis type="number" hide />
                        <YAxis
                          type="category"
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: 'var(--muted)', fontSize: 11 }}
                          width={60}
                        />
                        <Tooltip
                          cursor={{ fill: 'var(--surface-2)' }}
                          formatter={(v) => [`${v} kWh`, 'Energy Consumed']}
                        />
                        <Bar dataKey="value" fill="var(--blue)" radius={[0, 5, 5, 0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </section>

              {/* Real Recent Charging Sessions Table */}
              <section className="panel table-panel">
                <div className="panel-header">
                  <div>
                    <h2>Recent Charging Sessions</h2>
                    <p className="muted small">Live data from /api/sessions with inline quick actions</p>
                  </div>
                  <button className="link-button" onClick={() => setActive('Sessions')}>
                    View all sessions <span>→</span>
                  </button>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>SESSION ID</th>
                        <th>CUSTOMER</th>
                        <th>STATION & CHARGER</th>
                        <th>ENERGY (kWh)</th>
                        <th>COST</th>
                        <th>STATUS</th>
                        <th style={{ textAlign: 'right' }}>QUICK ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSessions.slice(0, 6).map((session) => {
                        const isDone = session.Session_End !== null
                        const isPaid = session.Payment_Status === 'Paid'

                        return (
                          <tr key={session.Session_ID}>
                            <td>
                              <span className="session-id">SES-{session.Session_ID}</span>
                            </td>
                            <td>
                              <div className="person">
                                <div className="mini-avatar">
                                  {session.Customer_Name ? session.Customer_Name.slice(0, 2).toUpperCase() : 'CU'}
                                </div>
                                <span>{session.Customer_Name}</span>
                              </div>
                            </td>
                            <td>
                              {session.Station_Name || `Station #${session.Station_ID}`} · Charger #{session.Charger_ID}
                            </td>
                            <td>{session.Energy_Consumed !== null ? `${session.Energy_Consumed} kWh` : 'Charging...'}</td>
                            <td>
                              <strong>
                                {session.Charging_Cost !== null
                                  ? `₹ ${Number(session.Charging_Cost).toLocaleString('en-IN')}`
                                  : 'Calculating...'}
                              </strong>
                            </td>
                            <td>
                              {!isDone ? (
                                <span className="badge badge-occupied">In Progress</span>
                              ) : isPaid ? (
                                <span className="badge badge-paid">Paid ({session.Payment_Method || 'UPI'})</span>
                              ) : (
                                <span className="badge badge-unpaid">Payment Due</span>
                              )}
                            </td>
                            <td>
                              <div className="btn-action-group">
                                {!isDone ? (
                                  <button
                                    className="btn-danger btn-sm"
                                    onClick={() => {
                                      setSelectedSessionToEnd(session)
                                      setEndSessionKwh('20.00')
                                      setEndSessionModalOpen(true)
                                    }}
                                  >
                                    End Session
                                  </button>
                                ) : !isPaid ? (
                                  <button
                                    className="btn-primary btn-sm"
                                    onClick={() => {
                                      setSelectedSessionToPay(session)
                                      setPaymentForm({
                                        Payment_Method: 'UPI',
                                        Amount: String(session.Charging_Cost || ''),
                                        Upi_Id: 'evdriver@okhdfcbank',
                                        Card_Number: '4532 8901 2345 6789',
                                        Card_Expiry: '12/28',
                                        Card_Cvv: '888',
                                        Bank_Name: 'HDFC Bank (Demo)',
                                      })
                                      setPaymentModalOpen(true)
                                    }}
                                  >
                                    Pay Now
                                  </button>
                                ) : (
                                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>Completed</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {filteredSessions.length === 0 && (
                    <div className="empty">No charging sessions found in database.</div>
                  )}
                </div>
              </section>
            </>
          )}

          {/* -------------------------------------------------------------
              VIEW 2: STATIONS
             ------------------------------------------------------------- */}
          {active === 'Stations' && (
            <section className="panel table-panel">
              <div className="view-header" style={{ padding: '18px 20px 0' }}>
                <div>
                  <h2>Charging Stations ({filteredStations.length})</h2>
                  <p className="muted small">Manage charging hubs, locations, and operational hours</p>
                </div>
                <div className="view-actions">
                  <button
                    className="btn-primary"
                    onClick={() => {
                      setEditingStation(null)
                      setStationForm({
                        Station_Name: '',
                        Location: '',
                        Contact_Number: '',
                        Total_Chargers: '4',
                        Operating_Hours: '24 Hours',
                        Status: 'Active',
                      })
                      setStationModalOpen(true)
                    }}
                  >
                    <Plus size={16} /> Add Station
                  </button>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>STATION NAME</th>
                      <th>LOCATION</th>
                      <th>CONTACT</th>
                      <th>CHARGERS</th>
                      <th>HOURS</th>
                      <th>STATUS</th>
                      <th style={{ textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStations.map((station) => (
                      <tr key={station.Station_ID}>
                        <td><strong>#{station.Station_ID}</strong></td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{station.Station_Name}</div>
                        </td>
                        <td>{station.Location}</td>
                        <td>{station.Contact_Number || '—'}</td>
                        <td>{station.Actual_Chargers_Count ?? station.Total_Chargers} chargers</td>
                        <td>{station.Operating_Hours}</td>
                        <td>
                          <span className={`badge badge-${station.Status?.toLowerCase()}`}>
                            {station.Status}
                          </span>
                        </td>
                        <td>
                          <div className="btn-action-group">
                            <button
                              className="btn-outline btn-sm"
                              onClick={() => {
                                setEditingStation(station)
                                setStationForm({
                                  Station_Name: station.Station_Name,
                                  Location: station.Location,
                                  Contact_Number: station.Contact_Number || '',
                                  Total_Chargers: String(station.Total_Chargers || 4),
                                  Operating_Hours: station.Operating_Hours || '24 Hours',
                                  Status: station.Status || 'Active',
                                })
                                setStationModalOpen(true)
                              }}
                            >
                              <Edit2 size={12} /> Edit
                            </button>
                            <button
                              className="btn-danger btn-sm"
                              onClick={() => handleDeleteStation(station.Station_ID, station.Station_Name)}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredStations.length === 0 && <div className="empty">No stations found.</div>}
              </div>
            </section>
          )}

          {/* -------------------------------------------------------------
              VIEW 3: CHARGERS
             ------------------------------------------------------------- */}
          {active === 'Chargers' && (
            <section className="panel table-panel">
              <div className="view-header" style={{ padding: '18px 20px 0' }}>
                <div>
                  <h2>Charging Points ({filteredChargers.length})</h2>
                  <p className="muted small">Inspect plug points, power ratings, and live statuses</p>
                </div>
                <div className="view-actions">
                  <div className="filter-tabs">
                    {['ALL', 'Available', 'Occupied', 'Maintenance'].map((st) => (
                      <button
                        key={st}
                        className={chargerStatusFilter === st ? 'filter-tab active' : 'filter-tab'}
                        onClick={() => setChargerStatusFilter(st)}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                  <button
                    className="btn-primary"
                    onClick={() => {
                      setEditingCharger(null)
                      setChargerForm({
                        Station_ID: stations[0]?.Station_ID ? String(stations[0].Station_ID) : '',
                        Charger_Type: 'DC Fast',
                        Connector_Type: 'CCS2',
                        Power_Output: '50.00',
                        Availability_Status: 'Available',
                      })
                      setChargerModalOpen(true)
                    }}
                  >
                    <Plus size={16} /> Add Charger
                  </button>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>CHARGER ID</th>
                      <th>STATION</th>
                      <th>TYPE</th>
                      <th>CONNECTOR</th>
                      <th>POWER OUTPUT</th>
                      <th>AVAILABILITY</th>
                      <th style={{ textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredChargers.map((charger) => (
                      <tr key={charger.Charger_ID}>
                        <td><strong>#{charger.Charger_ID}</strong></td>
                        <td>
                          <strong>{charger.Station_Name || `Station #${charger.Station_ID}`}</strong>
                        </td>
                        <td>{charger.Charger_Type}</td>
                        <td>{charger.Connector_Type}</td>
                        <td><strong>{charger.Power_Output} kW</strong></td>
                        <td>
                          <span className={`badge badge-${charger.Availability_Status?.toLowerCase()}`}>
                            {charger.Availability_Status}
                          </span>
                        </td>
                        <td>
                          <div className="btn-action-group">
                            <button
                              className="btn-outline btn-sm"
                              onClick={() => {
                                setEditingCharger(charger)
                                setChargerForm({
                                  Station_ID: String(charger.Station_ID),
                                  Charger_Type: charger.Charger_Type,
                                  Connector_Type: charger.Connector_Type,
                                  Power_Output: String(charger.Power_Output),
                                  Availability_Status: charger.Availability_Status,
                                })
                                setChargerModalOpen(true)
                              }}
                            >
                              <Edit2 size={12} /> Edit
                            </button>
                            <button
                              className="btn-danger btn-sm"
                              onClick={() => handleDeleteCharger(charger.Charger_ID)}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredChargers.length === 0 && <div className="empty">No chargers found.</div>}
              </div>
            </section>
          )}

          {/* -------------------------------------------------------------
              VIEW 4: BOOKINGS
             ------------------------------------------------------------- */}
          {active === 'Bookings' && (
            <section className="panel table-panel">
              <div className="view-header" style={{ padding: '18px 20px 0' }}>
                <div>
                  <h2>Bookings & Reservations ({filteredBookings.length})</h2>
                  <p className="muted small">Customer slot scheduling with conflict prevention</p>
                </div>
                <div className="view-actions">
                  <div className="filter-tabs">
                    {['ALL', 'Confirmed', 'Completed', 'Cancelled'].map((st) => (
                      <button
                        key={st}
                        className={bookingStatusFilter === st ? 'filter-tab active' : 'filter-tab'}
                        onClick={() => setBookingStatusFilter(st)}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                  <button
                    className="btn-primary"
                    onClick={() => {
                      setBookingForm({
                        Customer_ID: customers[0]?.Customer_ID ? String(customers[0].Customer_ID) : '',
                        Charger_ID: chargers[0]?.Charger_ID ? String(chargers[0].Charger_ID) : '',
                        Booking_Date: new Date().toISOString().split('T')[0],
                        Start_Time: '10:00',
                        End_Time: '11:00',
                        Booking_Status: 'Confirmed',
                      })
                      setBookingModalOpen(true)
                    }}
                  >
                    <Plus size={16} /> New Booking
                  </button>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>BOOKING ID</th>
                      <th>CUSTOMER</th>
                      <th>STATION & CHARGER</th>
                      <th>DATE</th>
                      <th>TIME SLOT</th>
                      <th>STATUS</th>
                      <th style={{ textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBookings.map((booking) => {
                      const isConfirmed = booking.Booking_Status === 'Confirmed'
                      const isCompleted = booking.Booking_Status === 'Completed'
                      const isCancelled = booking.Booking_Status === 'Cancelled'

                      return (
                        <tr key={booking.Booking_ID}>
                          <td><strong>#{booking.Booking_ID}</strong></td>
                          <td>
                            <div className="person">
                              <div className="mini-avatar">
                                {booking.Customer_Name ? booking.Customer_Name.slice(0, 2).toUpperCase() : 'CU'}
                              </div>
                              <div>
                                <div>{booking.Customer_Name}</div>
                                <small style={{ color: 'var(--muted)', fontSize: 10 }}>
                                  {booking.Customer_Phone || ''}
                                </small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <strong>{booking.Station_Name}</strong> · Charger #{booking.Charger_ID} ({booking.Charger_Type})
                          </td>
                          <td>{new Date(booking.Booking_Date).toLocaleDateString()}</td>
                          <td>
                            <strong>
                              {booking.Start_Time.slice(0, 5)} - {booking.End_Time.slice(0, 5)}
                            </strong>
                          </td>
                          <td>
                            <span className={`badge badge-${booking.Booking_Status?.toLowerCase()}`}>
                              {booking.Booking_Status}
                            </span>
                          </td>
                          <td>
                            <div className="btn-action-group">
                              {isConfirmed && (
                                <>
                                  <button
                                    className="btn-primary btn-sm"
                                    onClick={() => {
                                      setSelectedBookingForSession(booking)
                                      setStartSessionModalOpen(true)
                                    }}
                                  >
                                    <Play size={11} /> Start Session
                                  </button>
                                  <button
                                    className="btn-outline btn-sm"
                                    onClick={() => handleCancelBooking(booking.Booking_ID)}
                                  >
                                    Cancel
                                  </button>
                                </>
                              )}
                              <button
                                className="btn-danger btn-sm"
                                onClick={() => handleDeleteBooking(booking.Booking_ID)}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {filteredBookings.length === 0 && <div className="empty">No bookings found.</div>}
              </div>
            </section>
          )}

          {/* -------------------------------------------------------------
              VIEW 5: SESSIONS
             ------------------------------------------------------------- */}
          {active === 'Sessions' && (
            <section className="panel table-panel">
              <div className="view-header" style={{ padding: '18px 20px 0' }}>
                <div>
                  <h2>Charging Sessions ({filteredSessions.length})</h2>
                  <p className="muted small">Live metering and billing calculations (₹12.00 / kWh)</p>
                </div>
                <div className="view-actions">
                  <div className="filter-tabs">
                    {['ALL', 'ACTIVE', 'COMPLETED'].map((st) => (
                      <button
                        key={st}
                        className={sessionStatusFilter === st ? 'filter-tab active' : 'filter-tab'}
                        onClick={() => setSessionStatusFilter(st)}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>SESSION ID</th>
                      <th>BOOKING ID</th>
                      <th>CUSTOMER</th>
                      <th>STATION & CHARGER</th>
                      <th>START TIME</th>
                      <th>END TIME</th>
                      <th>ENERGY</th>
                      <th>COST</th>
                      <th>PAYMENT</th>
                      <th style={{ textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSessions.map((session) => {
                      const isDone = session.Session_End !== null
                      const isPaid = session.Payment_Status === 'Paid'

                      return (
                        <tr key={session.Session_ID}>
                          <td><span className="session-id">SES-{session.Session_ID}</span></td>
                          <td>#{session.Booking_ID}</td>
                          <td>
                            <strong>{session.Customer_Name}</strong>
                          </td>
                          <td>{session.Station_Name} · Charger #{session.Charger_ID}</td>
                          <td>{new Date(session.Session_Start).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                          <td>
                            {session.Session_End
                              ? new Date(session.Session_End).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                              : <span className="badge badge-occupied">Active Now</span>}
                          </td>
                          <td>
                            <strong>
                              {session.Energy_Consumed !== null ? `${session.Energy_Consumed} kWh` : 'In progress'}
                            </strong>
                          </td>
                          <td>
                            <strong>
                              {session.Charging_Cost !== null
                                ? `₹ ${Number(session.Charging_Cost).toFixed(2)}`
                                : '—'}
                            </strong>
                          </td>
                          <td>
                            {isPaid ? (
                              <span className="badge badge-paid">Paid ({session.Payment_Method})</span>
                            ) : isDone ? (
                              <span className="badge badge-unpaid">Pending</span>
                            ) : (
                              <span className="badge badge-occupied">Charging</span>
                            )}
                          </td>
                          <td>
                            <div className="btn-action-group">
                              {!isDone ? (
                                <button
                                  className="btn-danger btn-sm"
                                  onClick={() => {
                                    setSelectedSessionToEnd(session)
                                    setEndSessionKwh('20.00')
                                    setEndSessionModalOpen(true)
                                  }}
                                >
                                  End Session (kWh)
                                </button>
                              ) : !isPaid ? (
                                <button
                                  className="btn-primary btn-sm"
                                  onClick={() => {
                                    setSelectedSessionToPay(session)
                                    setPaymentForm({
                                      Payment_Method: 'UPI',
                                      Amount: String(session.Charging_Cost || ''),
                                      Upi_Id: 'evdriver@okhdfcbank',
                                      Card_Number: '4532 8901 2345 6789',
                                      Card_Expiry: '12/28',
                                      Card_Cvv: '888',
                                      Bank_Name: 'HDFC Bank (Demo)',
                                    })
                                    setPaymentModalOpen(true)
                                  }}
                                >
                                  <DollarSign size={11} /> Pay (UPI/Card)
                                </button>
                              ) : (
                                <span style={{ fontSize: 10, color: 'var(--muted)' }}>Paid</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {filteredSessions.length === 0 && <div className="empty">No sessions found.</div>}
              </div>
            </section>
          )}

          {/* -------------------------------------------------------------
              VIEW 6: PAYMENTS
             ------------------------------------------------------------- */}
          {active === 'Payments' && (
            <section className="panel table-panel">
              <div className="view-header" style={{ padding: '18px 20px 0' }}>
                <div>
                  <h2>Payments & Invoicing ({filteredPayments.length})</h2>
                  <p className="muted small">Settlements and collections history</p>
                </div>
                <div className="view-actions">
                  <div className="filter-tabs">
                    {['ALL', 'Paid', 'Pending'].map((st) => (
                      <button
                        key={st}
                        className={paymentStatusFilter === st ? 'filter-tab active' : 'filter-tab'}
                        onClick={() => setPaymentStatusFilter(st)}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>PAYMENT ID</th>
                      <th>SESSION</th>
                      <th>CUSTOMER</th>
                      <th>STATION</th>
                      <th>DATE</th>
                      <th>METHOD</th>
                      <th>AMOUNT</th>
                      <th>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.map((p) => (
                      <tr key={p.Payment_ID}>
                        <td><strong>PAY-{p.Payment_ID}</strong></td>
                        <td>SES-{p.Session_ID}</td>
                        <td><strong>{p.Customer_Name}</strong></td>
                        <td>{p.Station_Name}</td>
                        <td>{new Date(p.Payment_Date).toLocaleDateString()}</td>
                        <td>
                          <span className="badge badge-confirmed">{p.Payment_Method}</span>
                        </td>
                        <td>
                          <strong style={{ fontSize: 13, color: 'var(--ink)' }}>
                            ₹ {Number(p.Amount).toLocaleString('en-IN')}
                          </strong>
                        </td>
                        <td>
                          <span className={`badge badge-${p.Payment_Status?.toLowerCase()}`}>
                            {p.Payment_Status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredPayments.length === 0 && <div className="empty">No payment transactions recorded.</div>}
              </div>
            </section>
          )}

          {/* -------------------------------------------------------------
              VIEW 7: CUSTOMERS
             ------------------------------------------------------------- */}
          {active === 'Customers' && (
            <section className="panel table-panel">
              <div className="view-header" style={{ padding: '18px 20px 0' }}>
                <div>
                  <h2>Customer Directory ({filteredCustomers.length})</h2>
                  <p className="muted small">Registered EV drivers and vehicle owners</p>
                </div>
                <div className="view-actions">
                  <button
                    className="btn-primary"
                    onClick={() => {
                      setEditingCustomer(null)
                      setCustomerForm({
                        Customer_Name: '',
                        Phone_Number: '',
                        Email: '',
                        Address: '',
                      })
                      setCustomerModalOpen(true)
                    }}
                  >
                    <Plus size={16} /> Add Customer
                  </button>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>CUSTOMER NAME</th>
                      <th>EMAIL</th>
                      <th>PHONE NUMBER</th>
                      <th>ADDRESS</th>
                      <th style={{ textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map((c) => (
                      <tr key={c.Customer_ID}>
                        <td><strong>#{c.Customer_ID}</strong></td>
                        <td>
                          <div className="person">
                            <div className="mini-avatar">{c.Customer_Name.slice(0, 2).toUpperCase()}</div>
                            <strong>{c.Customer_Name}</strong>
                          </div>
                        </td>
                        <td>{c.Email || '—'}</td>
                        <td>{c.Phone_Number || '—'}</td>
                        <td>{c.Address || '—'}</td>
                        <td>
                          <div className="btn-action-group">
                            <button
                              className="btn-outline btn-sm"
                              onClick={() => {
                                setEditingCustomer(c)
                                setCustomerForm({
                                  Customer_Name: c.Customer_Name,
                                  Phone_Number: c.Phone_Number || '',
                                  Email: c.Email || '',
                                  Address: c.Address || '',
                                })
                                setCustomerModalOpen(true)
                              }}
                            >
                              <Edit2 size={12} /> Edit
                            </button>
                            <button
                              className="btn-danger btn-sm"
                              onClick={() => handleDeleteCustomer(c.Customer_ID, c.Customer_Name)}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredCustomers.length === 0 && <div className="empty">No customers found.</div>}
              </div>
            </section>
          )}

          {/* -------------------------------------------------------------
              VIEW 8: EMPLOYEES
             ------------------------------------------------------------- */}
          {active === 'Employees' && (
            <section className="panel table-panel">
              <div className="view-header" style={{ padding: '18px 20px 0' }}>
                <div>
                  <h2>Staff & Technicians ({filteredEmployees.length})</h2>
                  <p className="muted small">On-site operators and certified engineers</p>
                </div>
                <div className="view-actions">
                  <button
                    className="btn-primary"
                    onClick={() => {
                      setEditingEmployee(null)
                      setEmployeeForm({
                        Employee_Name: '',
                        Phone_Number: '',
                        Email: '',
                        Designation: 'Technician',
                        Station_ID: stations[0]?.Station_ID ? String(stations[0].Station_ID) : '',
                      })
                      setEmployeeModalOpen(true)
                    }}
                  >
                    <Plus size={16} /> Add Employee
                  </button>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>EMPLOYEE NAME</th>
                      <th>DESIGNATION</th>
                      <th>ASSIGNED STATION</th>
                      <th>PHONE NUMBER</th>
                      <th>EMAIL</th>
                      <th style={{ textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map((e) => (
                      <tr key={e.Employee_ID}>
                        <td><strong>#{e.Employee_ID}</strong></td>
                        <td>
                          <div className="person">
                            <div className="mini-avatar">{e.Employee_Name.slice(0, 2).toUpperCase()}</div>
                            <strong>{e.Employee_Name}</strong>
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-confirmed">{e.Designation}</span>
                        </td>
                        <td>{e.Station_Name || `Station #${e.Station_ID}`}</td>
                        <td>{e.Phone_Number || '—'}</td>
                        <td>{e.Email || '—'}</td>
                        <td>
                          <div className="btn-action-group">
                            <button
                              className="btn-outline btn-sm"
                              onClick={() => {
                                setEditingEmployee(e)
                                setEmployeeForm({
                                  Employee_Name: e.Employee_Name,
                                  Phone_Number: e.Phone_Number || '',
                                  Email: e.Email || '',
                                  Designation: e.Designation || 'Technician',
                                  Station_ID: String(e.Station_ID),
                                })
                                setEmployeeModalOpen(true)
                              }}
                            >
                              <Edit2 size={12} /> Edit
                            </button>
                            <button
                              className="btn-danger btn-sm"
                              onClick={() => handleDeleteEmployee(e.Employee_ID, e.Employee_Name)}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredEmployees.length === 0 && <div className="empty">No employees found.</div>}
              </div>
            </section>
          )}

          {/* -------------------------------------------------------------
              VIEW 9: MAINTENANCE
             ------------------------------------------------------------- */}
          {active === 'Maintenance' && (
            <section className="panel table-panel">
              <div className="view-header" style={{ padding: '18px 20px 0' }}>
                <div>
                  <h2>Maintenance Operations ({filteredMaintenance.length})</h2>
                  <p className="muted small">Charger repairs automatically update hardware availability status</p>
                </div>
                <div className="view-actions">
                  <div className="filter-tabs">
                    {['ALL', 'In Progress', 'Completed'].map((st) => (
                      <button
                        key={st}
                        className={maintenanceStatusFilter === st ? 'filter-tab active' : 'filter-tab'}
                        onClick={() => setMaintenanceStatusFilter(st)}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                  <button
                    className="btn-primary"
                    onClick={() => {
                      setEditingMaintenance(null)
                      setMaintenanceForm({
                        Charger_ID: chargers[0]?.Charger_ID ? String(chargers[0].Charger_ID) : '',
                        Employee_ID: employees[0]?.Employee_ID ? String(employees[0].Employee_ID) : '',
                        Maintenance_Date: new Date().toISOString().split('T')[0],
                        Status: 'In Progress',
                        Cost: '500.00',
                        Description: 'Routine preventive inspection and connector test',
                      })
                      setMaintenanceModalOpen(true)
                    }}
                  >
                    <Plus size={16} /> Log Maintenance
                  </button>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>LOG ID</th>
                      <th>CHARGER & STATION</th>
                      <th>TECHNICIAN</th>
                      <th>DATE</th>
                      <th>DESCRIPTION</th>
                      <th>COST</th>
                      <th>STATUS</th>
                      <th style={{ textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMaintenance.map((m) => {
                      const isInProgress = m.Status === 'In Progress'

                      return (
                        <tr key={m.Maintenance_ID}>
                          <td><strong>#{m.Maintenance_ID}</strong></td>
                          <td>
                            <strong>Charger #{m.Charger_ID}</strong> · {m.Station_Name}
                          </td>
                          <td>{m.Employee_Name}</td>
                          <td>{new Date(m.Maintenance_Date).toLocaleDateString()}</td>
                          <td>{m.Description || 'No description'}</td>
                          <td>
                            <strong>₹ {Number(m.Cost || 0).toLocaleString('en-IN')}</strong>
                          </td>
                          <td>
                            <span className={`badge badge-${isInProgress ? 'maintenance' : 'completed'}`}>
                              {m.Status}
                            </span>
                          </td>
                          <td>
                            <div className="btn-action-group">
                              {isInProgress && (
                                <button
                                  className="btn-primary btn-sm"
                                  onClick={() => handleCompleteMaintenance(m.Maintenance_ID)}
                                >
                                  <CheckCircle2 size={11} /> Mark Complete
                                </button>
                              )}
                              <button
                                className="btn-danger btn-sm"
                                onClick={() => handleDeleteMaintenance(m.Maintenance_ID)}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {filteredMaintenance.length === 0 && <div className="empty">No maintenance jobs logged.</div>}
              </div>
            </section>
          )}

          {/* Page Footer */}
          <footer>
            <span>ChargeFlow EV Hub Management · MySQL 8 Production Sync</span>
            <span>
              <ShieldCheck size={13} />
              Connected to ev_charging_db · Rate: ₹12.00/kWh
            </span>
          </footer>
        </div>
      </main>

      {/* =============================================================
          MODALS
         ============================================================= */}

      {/* 1. Account / Auth Modal */}
      {authModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="modal-header">
              <h3>Account Management</h3>
              <button className="modal-close" onClick={() => setAuthModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="auth-tabs">
                <button
                  className={authTab === 'demo' ? 'auth-tab active' : 'auth-tab'}
                  onClick={() => setAuthTab('demo')}
                >
                  Demo Switch
                </button>
                <button
                  className={authTab === 'login' ? 'auth-tab active' : 'auth-tab'}
                  onClick={() => setAuthTab('login')}
                >
                  Login
                </button>
                <button
                  className={authTab === 'register_customer' ? 'auth-tab active' : 'auth-tab'}
                  onClick={() => setAuthTab('register_customer')}
                >
                  Create Customer
                </button>
                <button
                  className={authTab === 'register_owner' ? 'auth-tab active' : 'auth-tab'}
                  onClick={() => setAuthTab('register_owner')}
                >
                  Create Owner
                </button>
              </div>

              {authTab === 'demo' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <p className="muted small">
                    Quickly toggle between seeded demo accounts to test role-based permissions:
                  </p>
                  <div
                    style={{
                      background: 'var(--surface-2)',
                      padding: 14,
                      borderRadius: 9,
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <strong>Demo Station Owner</strong>
                      <div className="muted small">owner@demo.com · Role: OWNER</div>
                    </div>
                    <button className="btn-primary btn-sm" onClick={() => handleDemoSwitch('OWNER')}>
                      Activate Owner
                    </button>
                  </div>
                  <div
                    style={{
                      background: 'var(--surface-2)',
                      padding: 14,
                      borderRadius: 9,
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <strong>Demo Customer</strong>
                      <div className="muted small">rahul@gmail.com · Role: CUSTOMER</div>
                    </div>
                    <button className="btn-secondary btn-sm" onClick={() => handleDemoSwitch('CUSTOMER')}>
                      Activate Customer
                    </button>
                  </div>
                </div>
              )}

              {authTab === 'login' && (
                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input
                      className="form-input"
                      type="email"
                      required
                      value={authForm.email}
                      onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                      placeholder="e.g. owner@demo.com"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input
                      className="form-input"
                      type="password"
                      required
                      value={authForm.password}
                      onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                      placeholder="••••••••"
                    />
                  </div>
                  <button type="submit" className="btn-primary" style={{ marginTop: 8 }}>
                    <LogIn size={15} /> Sign In
                  </button>
                </form>
              )}

              {authTab === 'register_customer' && (
                <form onSubmit={handleRegisterCustomer} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <input
                      className="form-input"
                      required
                      value={authForm.name}
                      onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                      placeholder="e.g. Vikramaditya Rathore"
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Email *</label>
                      <input
                        className="form-input"
                        type="email"
                        required
                        value={authForm.email}
                        onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                        placeholder="vikram@example.com"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Phone</label>
                      <input
                        className="form-input"
                        value={authForm.phone}
                        onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })}
                        placeholder="+91 98765 43210"
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Address</label>
                    <input
                      className="form-input"
                      value={authForm.address}
                      onChange={(e) => setAuthForm({ ...authForm, address: e.target.value })}
                      placeholder="e.g. C-Scheme, Jaipur"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password (min 8 chars) *</label>
                    <input
                      className="form-input"
                      type="password"
                      required
                      minLength={8}
                      value={authForm.password}
                      onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                      placeholder="••••••••"
                    />
                  </div>
                  <button type="submit" className="btn-primary" style={{ marginTop: 8 }}>
                    <UserPlus size={15} /> Register Customer Account
                  </button>
                </form>
              )}

              {authTab === 'register_owner' && (
                <form onSubmit={handleRegisterOwner} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Station Owner / Business Name *</label>
                    <input
                      className="form-input"
                      required
                      value={authForm.name}
                      onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                      placeholder="e.g. Jaipur EV Ventures"
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Email *</label>
                      <input
                        className="form-input"
                        type="email"
                        required
                        value={authForm.email}
                        onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                        placeholder="owner@ventures.com"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Phone</label>
                      <input
                        className="form-input"
                        value={authForm.phone}
                        onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })}
                        placeholder="+91 98290 12345"
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password (min 8 chars) *</label>
                    <input
                      className="form-input"
                      type="password"
                      required
                      minLength={8}
                      value={authForm.password}
                      onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                      placeholder="••••••••"
                    />
                  </div>
                  <button type="submit" className="btn-primary" style={{ marginTop: 8 }}>
                    <Gauge size={15} /> Register Station Owner Account
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. Station Modal */}
      {stationModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="modal-header">
              <h3>{editingStation ? 'Edit Station' : 'Add Charging Station'}</h3>
              <button className="modal-close" onClick={() => setStationModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveStation}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Station Name *</label>
                  <input
                    className="form-input"
                    required
                    value={stationForm.Station_Name}
                    onChange={(e) => setStationForm({ ...stationForm, Station_Name: e.target.value })}
                    placeholder="e.g. Tonk Road Supercharger"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Location Address *</label>
                  <input
                    className="form-input"
                    required
                    value={stationForm.Location}
                    onChange={(e) => setStationForm({ ...stationForm, Location: e.target.value })}
                    placeholder="e.g. Near Gopalpura Flyover, Tonk Road, Jaipur"
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Contact Number</label>
                    <input
                      className="form-input"
                      value={stationForm.Contact_Number}
                      onChange={(e) => setStationForm({ ...stationForm, Contact_Number: e.target.value })}
                      placeholder="+91 9876543210"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Total Chargers</label>
                    <input
                      className="form-input"
                      type="number"
                      min={1}
                      value={stationForm.Total_Chargers}
                      onChange={(e) => setStationForm({ ...stationForm, Total_Chargers: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Operating Hours</label>
                    <input
                      className="form-input"
                      value={stationForm.Operating_Hours}
                      onChange={(e) => setStationForm({ ...stationForm, Operating_Hours: e.target.value })}
                      placeholder="e.g. 24 Hours or 06:00 - 23:00"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select
                      className="form-select"
                      value={stationForm.Status}
                      onChange={(e) => setStationForm({ ...stationForm, Status: e.target.value })}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="Maintenance">Maintenance</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setStationModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingStation ? 'Update Station' : 'Create Station'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Charger Modal */}
      {chargerModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="modal-header">
              <h3>{editingCharger ? 'Edit Charging Point' : 'Add Charging Point'}</h3>
              <button className="modal-close" onClick={() => setChargerModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveCharger}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Charging Station *</label>
                  <select
                    className="form-select"
                    required
                    value={chargerForm.Station_ID}
                    onChange={(e) => setChargerForm({ ...chargerForm, Station_ID: e.target.value })}
                  >
                    <option value="">Select a Station</option>
                    {stations.map((s) => (
                      <option key={s.Station_ID} value={s.Station_ID}>
                        {s.Station_Name} ({s.Location})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Charger Type *</label>
                    <select
                      className="form-select"
                      value={chargerForm.Charger_Type}
                      onChange={(e) => setChargerForm({ ...chargerForm, Charger_Type: e.target.value })}
                    >
                      <option value="DC Fast">DC Fast</option>
                      <option value="AC Type 2">AC Type 2</option>
                      <option value="Level 2 AC">Level 2 AC</option>
                      <option value="Ultra-Fast DC">Ultra-Fast DC</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Connector Type *</label>
                    <select
                      className="form-select"
                      value={chargerForm.Connector_Type}
                      onChange={(e) => setChargerForm({ ...chargerForm, Connector_Type: e.target.value })}
                    >
                      <option value="CCS2">CCS2</option>
                      <option value="Type 2">Type 2</option>
                      <option value="CHAdeMO">CHAdeMO</option>
                      <option value="GB/T">GB/T</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Power Output (kW) *</label>
                    <input
                      className="form-input"
                      type="number"
                      step="0.1"
                      required
                      value={chargerForm.Power_Output}
                      onChange={(e) => setChargerForm({ ...chargerForm, Power_Output: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Availability Status</label>
                    <select
                      className="form-select"
                      value={chargerForm.Availability_Status}
                      onChange={(e) => setChargerForm({ ...chargerForm, Availability_Status: e.target.value })}
                    >
                      <option value="Available">Available</option>
                      <option value="Occupied">Occupied</option>
                      <option value="Maintenance">Maintenance</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setChargerModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingCharger ? 'Save Changes' : 'Install Charger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Customer Modal */}
      {customerModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="modal-header">
              <h3>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</h3>
              <button className="modal-close" onClick={() => setCustomerModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveCustomer}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Customer Name *</label>
                  <input
                    className="form-input"
                    required
                    value={customerForm.Customer_Name}
                    onChange={(e) => setCustomerForm({ ...customerForm, Customer_Name: e.target.value })}
                    placeholder="e.g. Ramesh Chandra"
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input
                      className="form-input"
                      value={customerForm.Phone_Number}
                      onChange={(e) => setCustomerForm({ ...customerForm, Phone_Number: e.target.value })}
                      placeholder="+91 98290 54321"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      className="form-input"
                      type="email"
                      value={customerForm.Email}
                      onChange={(e) => setCustomerForm({ ...customerForm, Email: e.target.value })}
                      placeholder="ramesh@example.com"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Address</label>
                  <input
                    className="form-input"
                    value={customerForm.Address}
                    onChange={(e) => setCustomerForm({ ...customerForm, Address: e.target.value })}
                    placeholder="e.g. Malviya Nagar, Jaipur"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setCustomerModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingCustomer ? 'Update Profile' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Employee Modal */}
      {employeeModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="modal-header">
              <h3>{editingEmployee ? 'Edit Employee' : 'Add Employee'}</h3>
              <button className="modal-close" onClick={() => setEmployeeModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveEmployee}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Employee Name *</label>
                  <input
                    className="form-input"
                    required
                    value={employeeForm.Employee_Name}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, Employee_Name: e.target.value })}
                    placeholder="e.g. Rajesh Kumar"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Assigned Station *</label>
                  <select
                    className="form-select"
                    required
                    value={employeeForm.Station_ID}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, Station_ID: e.target.value })}
                  >
                    <option value="">Select Station</option>
                    {stations.map((s) => (
                      <option key={s.Station_ID} value={s.Station_ID}>
                        {s.Station_Name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Designation</label>
                    <select
                      className="form-select"
                      value={employeeForm.Designation}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, Designation: e.target.value })}
                    >
                      <option value="Technician">Technician</option>
                      <option value="Station Supervisor">Station Supervisor</option>
                      <option value="Maintenance Engineer">Maintenance Engineer</option>
                      <option value="Support Agent">Support Agent</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input
                      className="form-input"
                      value={employeeForm.Phone_Number}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, Phone_Number: e.target.value })}
                      placeholder="+91 94140 12345"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    className="form-input"
                    type="email"
                    value={employeeForm.Email}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, Email: e.target.value })}
                    placeholder="rajesh@chargeflow.in"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setEmployeeModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingEmployee ? 'Save Changes' : 'Register Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Booking Modal */}
      {bookingModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="modal-header">
              <h3>Create New Slot Booking</h3>
              <button className="modal-close" onClick={() => setBookingModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateBooking}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Customer *</label>
                  <select
                    className="form-select"
                    required
                    value={bookingForm.Customer_ID}
                    onChange={(e) => setBookingForm({ ...bookingForm, Customer_ID: e.target.value })}
                  >
                    <option value="">Select Customer</option>
                    {customers.map((c) => (
                      <option key={c.Customer_ID} value={c.Customer_ID}>
                        {c.Customer_Name} ({c.Email || c.Phone_Number || 'ID ' + c.Customer_ID})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Select Charger Point *</label>
                  <select
                    className="form-select"
                    required
                    value={bookingForm.Charger_ID}
                    onChange={(e) => setBookingForm({ ...bookingForm, Charger_ID: e.target.value })}
                  >
                    <option value="">Select Charger</option>
                    {chargers.map((ch) => (
                      <option
                        key={ch.Charger_ID}
                        value={ch.Charger_ID}
                        disabled={ch.Availability_Status === 'Maintenance'}
                      >
                        Charger #{ch.Charger_ID} — {ch.Station_Name} ({ch.Charger_Type}, {ch.Power_Output}kW){' '}
                        {ch.Availability_Status === 'Maintenance' ? '[UNDER MAINTENANCE]' : ''}
                      </option>
                    ))}
                  </select>
                  <span className="form-help">Chargers under maintenance cannot be booked.</span>
                </div>

                <div className="form-group">
                  <label className="form-label">Booking Date *</label>
                  <input
                    className="form-input"
                    type="date"
                    required
                    value={bookingForm.Booking_Date}
                    onChange={(e) => setBookingForm({ ...bookingForm, Booking_Date: e.target.value })}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Start Time *</label>
                    <input
                      className="form-input"
                      type="time"
                      required
                      value={bookingForm.Start_Time}
                      onChange={(e) => setBookingForm({ ...bookingForm, Start_Time: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Time *</label>
                    <input
                      className="form-input"
                      type="time"
                      required
                      value={bookingForm.End_Time}
                      onChange={(e) => setBookingForm({ ...bookingForm, End_Time: e.target.value })}
                    />
                  </div>
                </div>
                <span className="form-help">
                  End Time must be after Start Time. Overlapping reservations on the same charger will be rejected.
                </span>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setBookingModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Confirm Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Start Session Confirmation Modal */}
      {startSessionModalOpen && selectedBookingForSession && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="modal-header">
              <h3>Start Charging Session</h3>
              <button className="modal-close" onClick={() => setStartSessionModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>You are about to start a live charging session for:</p>
              <div
                style={{
                  background: 'var(--surface-2)',
                  padding: 14,
                  borderRadius: 9,
                  border: '1px solid var(--border)',
                  fontSize: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div>
                  <strong>Customer:</strong> {selectedBookingForSession.Customer_Name}
                </div>
                <div>
                  <strong>Station:</strong> {selectedBookingForSession.Station_Name}
                </div>
                <div>
                  <strong>Charger:</strong> #{selectedBookingForSession.Charger_ID} (
                  {selectedBookingForSession.Charger_Type})
                </div>
                <div>
                  <strong>Slot:</strong> {selectedBookingForSession.Booking_Date} (
                  {selectedBookingForSession.Start_Time} - {selectedBookingForSession.End_Time})
                </div>
              </div>
              <p className="muted small">
                Starting this session will lock Charger #{selectedBookingForSession.Charger_ID} to{' '}
                <strong style={{ color: 'var(--orange)' }}>Occupied</strong> status.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setStartSessionModalOpen(false)}
              >
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={handleStartSession}>
                <Play size={14} /> Start Session Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. End Session Modal */}
      {endSessionModalOpen && selectedSessionToEnd && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="modal-header">
              <h3>End Charging Session</h3>
              <button className="modal-close" onClick={() => setEndSessionModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEndSession}>
              <div className="modal-body">
                <div
                  style={{
                    background: 'var(--surface-2)',
                    padding: 12,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    fontSize: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div>
                    <strong>Session:</strong> SES-{selectedSessionToEnd.Session_ID}
                  </div>
                  <div>
                    <strong>Customer:</strong> {selectedSessionToEnd.Customer_Name}
                  </div>
                  <div>
                    <strong>Charger:</strong> #{selectedSessionToEnd.Charger_ID} (
                    {selectedSessionToEnd.Station_Name})
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: 10 }}>
                  <label className="form-label">Energy Consumed (kWh) *</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    autoFocus
                    value={endSessionKwh}
                    onChange={(e) => setEndSessionKwh(e.target.value)}
                    placeholder="e.g. 20.00"
                  />
                  <div
                    style={{
                      marginTop: 8,
                      padding: 10,
                      borderRadius: 6,
                      background: 'var(--surface-2)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span className="muted small">Cost Calculation (@ ₹12/kWh):</span>
                    <strong style={{ fontSize: 14, color: 'var(--green)' }}>
                      ₹ {((parseFloat(endSessionKwh) || 0) * 12.0).toFixed(2)}
                    </strong>
                  </div>
                  <span className="form-help">
                    Ending the session marks the booking as Completed and resets charger status to Available.
                  </span>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEndSessionModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-danger">
                  Complete Session & Generate Bill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. Payment Modal */}
      {paymentModalOpen && selectedSessionToPay && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="modal-header">
              <h3>Collect Payment</h3>
              <button className="modal-close" onClick={() => setPaymentModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleProcessPayment}>
              <div className="modal-body">
                <div
                  style={{
                    background: 'var(--surface-2)',
                    padding: 12,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    fontSize: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div>
                    <strong>Customer:</strong> {selectedSessionToPay.Customer_Name}
                  </div>
                  <div>
                    <strong>Session:</strong> SES-{selectedSessionToPay.Session_ID} (
                    {selectedSessionToPay.Energy_Consumed} kWh)
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span className="muted">Total Due:</span>
                    <strong style={{ fontSize: 16, color: 'var(--green)' }}>
                      ₹ {Number(selectedSessionToPay.Charging_Cost || 0).toFixed(2)}
                    </strong>
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: 10 }}>
                  <label className="form-label">Payment Method *</label>
                  <select
                    className="form-select"
                    value={paymentForm.Payment_Method}
                    onChange={(e) => setPaymentForm({ ...paymentForm, Payment_Method: e.target.value })}
                  >
                    <option value="UPI">UPI (Google Pay / PhonePe / Paytm / BHIM)</option>
                    <option value="Credit Card">Credit Card (Visa / Mastercard / RuPay)</option>
                    <option value="Debit Card">Debit Card</option>
                    <option value="Net Banking">Net Banking</option>
                    <option value="Cash">Cash (At Counter)</option>
                  </select>
                </div>

                {/* Quick-fill Demo Payment Options */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span className="muted small" style={{ fontWeight: 700, fontSize: 10 }}>
                    DEMO PAYMENT DETAILS (CLICK TO AUTO-FILL):
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <button
                      type="button"
                      className="btn-outline btn-sm"
                      onClick={() =>
                        setPaymentForm({
                          ...paymentForm,
                          Payment_Method: 'UPI',
                          Upi_Id: 'evdriver@okhdfcbank',
                        })
                      }
                    >
                      ⚡ Demo UPI (evdriver@okhdfcbank)
                    </button>
                    <button
                      type="button"
                      className="btn-outline btn-sm"
                      onClick={() =>
                        setPaymentForm({
                          ...paymentForm,
                          Payment_Method: 'Credit Card',
                          Card_Number: '4532 8901 2345 6789',
                          Card_Expiry: '12/28',
                          Card_Cvv: '888',
                        })
                      }
                    >
                      ⚡ Demo Visa (4532 •••• 6789)
                    </button>
                    <button
                      type="button"
                      className="btn-outline btn-sm"
                      onClick={() =>
                        setPaymentForm({
                          ...paymentForm,
                          Payment_Method: 'Debit Card',
                          Card_Number: '5412 7500 1234 5678',
                          Card_Expiry: '08/29',
                          Card_Cvv: '123',
                        })
                      }
                    >
                      ⚡ Demo Mastercard (5412 •••• 5678)
                    </button>
                    <button
                      type="button"
                      className="btn-outline btn-sm"
                      onClick={() =>
                        setPaymentForm({
                          ...paymentForm,
                          Payment_Method: 'Net Banking',
                          Bank_Name: 'HDFC Bank (Demo)',
                        })
                      }
                    >
                      ⚡ Demo Net Banking (HDFC)
                    </button>
                  </div>
                </div>

                {/* Method-Specific Inputs */}
                {paymentForm.Payment_Method === 'UPI' && (
                  <div className="form-group">
                    <label className="form-label">Virtual Payment Address (VPA / UPI ID)</label>
                    <input
                      className="form-input"
                      value={paymentForm.Upi_Id}
                      onChange={(e) => setPaymentForm({ ...paymentForm, Upi_Id: e.target.value })}
                      placeholder="e.g. evdriver@okhdfcbank"
                    />
                    <span className="form-help">Supported handles: @okhdfcbank, @okaxis, @ybl, @paytm</span>
                  </div>
                )}

                {(paymentForm.Payment_Method === 'Credit Card' || paymentForm.Payment_Method === 'Debit Card') && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Card Number</label>
                      <input
                        className="form-input"
                        value={paymentForm.Card_Number}
                        onChange={(e) => setPaymentForm({ ...paymentForm, Card_Number: e.target.value })}
                        placeholder="4532 8901 2345 6789"
                      />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Valid Thru (MM/YY)</label>
                        <input
                          className="form-input"
                          value={paymentForm.Card_Expiry}
                          onChange={(e) => setPaymentForm({ ...paymentForm, Card_Expiry: e.target.value })}
                          placeholder="12/28"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">CVV</label>
                        <input
                          className="form-input"
                          type="password"
                          maxLength={4}
                          value={paymentForm.Card_Cvv}
                          onChange={(e) => setPaymentForm({ ...paymentForm, Card_Cvv: e.target.value })}
                          placeholder="888"
                        />
                      </div>
                    </div>
                  </>
                )}

                {paymentForm.Payment_Method === 'Net Banking' && (
                  <div className="form-group">
                    <label className="form-label">Select Bank</label>
                    <select
                      className="form-select"
                      value={paymentForm.Bank_Name}
                      onChange={(e) => setPaymentForm({ ...paymentForm, Bank_Name: e.target.value })}
                    >
                      <option value="HDFC Bank (Demo)">HDFC Bank (Demo)</option>
                      <option value="ICICI Bank (Demo)">ICICI Bank (Demo)</option>
                      <option value="State Bank of India (Demo)">State Bank of India (Demo)</option>
                      <option value="Axis Bank (Demo)">Axis Bank (Demo)</option>
                      <option value="Kotak Mahindra Bank (Demo)">Kotak Mahindra Bank (Demo)</option>
                    </select>
                  </div>
                )}

                {paymentForm.Payment_Method === 'Cash' && (
                  <div
                    style={{
                      background: 'var(--surface-2)',
                      padding: 10,
                      borderRadius: 7,
                      fontSize: 11,
                      color: 'var(--muted)',
                    }}
                  >
                    💵 Cash payment will be collected by on-site station staff.
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Amount (₹) *</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    required
                    value={paymentForm.Amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, Amount: e.target.value })}
                  />
                </div>

                <div
                  style={{
                    background: '#19c37d15',
                    border: '1px solid #19c37d40',
                    borderRadius: 8,
                    padding: '8px 11px',
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    color: 'var(--green-dark)',
                  }}
                >
                  <ShieldCheck size={14} />
                  <span>
                    Sandbox Demo Gateway: Creates a real payment record in MySQL with Status = <strong>Paid</strong>.
                  </span>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setPaymentModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  <DollarSign size={14} /> Confirm & Mark as Paid
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 10. Maintenance Modal */}
      {maintenanceModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="modal-header">
              <h3>{editingMaintenance ? 'Edit Maintenance' : 'Log Maintenance Task'}</h3>
              <button className="modal-close" onClick={() => setMaintenanceModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveMaintenance}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Target Charger *</label>
                  <select
                    className="form-select"
                    required
                    value={maintenanceForm.Charger_ID}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, Charger_ID: e.target.value })}
                  >
                    <option value="">Select Charger Point</option>
                    {chargers.map((ch) => (
                      <option key={ch.Charger_ID} value={ch.Charger_ID}>
                        Charger #{ch.Charger_ID} ({ch.Station_Name} · {ch.Charger_Type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Assigned Technician *</label>
                  <select
                    className="form-select"
                    required
                    value={maintenanceForm.Employee_ID}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, Employee_ID: e.target.value })}
                  >
                    <option value="">Select Staff</option>
                    {employees.map((em) => (
                      <option key={em.Employee_ID} value={em.Employee_ID}>
                        {em.Employee_Name} ({em.Designation})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Date *</label>
                    <input
                      className="form-input"
                      type="date"
                      required
                      value={maintenanceForm.Maintenance_Date}
                      onChange={(e) => setMaintenanceForm({ ...maintenanceForm, Maintenance_Date: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status *</label>
                    <select
                      className="form-select"
                      value={maintenanceForm.Status}
                      onChange={(e) => setMaintenanceForm({ ...maintenanceForm, Status: e.target.value })}
                    >
                      <option value="In Progress">In Progress (Sets Charger to Maintenance)</option>
                      <option value="Completed">Completed (Restores to Available)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Maintenance Cost (₹)</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    value={maintenanceForm.Cost}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, Cost: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description / Work Notes</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    value={maintenanceForm.Description}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, Description: e.target.value })}
                    placeholder="Details of inspection, cable replacement, software updates..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setMaintenanceModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingMaintenance ? 'Save Changes' : 'Log Maintenance Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

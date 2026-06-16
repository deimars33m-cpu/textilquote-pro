import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { CategoryProvider } from '@/context/CategoryContext'
import AppLayout from '@/components/layout/AppLayout'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import MaterialsPage from '@/pages/MaterialsPage'
import ProcessesPage from '@/pages/ProcessesPage'
import ExpensesAndBudgetsPage from '@/pages/ExpensesAndBudgetsPage'
import ProductTemplatesPage from '@/pages/ProductTemplatesPage'
import TemplateDetailPage from '@/pages/TemplateDetailPage'
import TercerosPage from '@/pages/TercerosPage'
import QuoterPage from '@/pages/QuoterPage'
import QuoteHistoryPage from '@/pages/QuoteHistoryPage'
import QuoteDetailPage from '@/pages/QuoteDetailPage'
import CompanySettingsPage from '@/pages/CompanySettingsPage'
import OrdersPage from '@/pages/OrdersPage'
import GlobalSettingsPage from '@/pages/GlobalSettingsPage'
import { GlobalSettingsProvider } from '@/context/GlobalSettingsContext'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-surface-container-high border-t-primary rounded-full animate-spin" />
          <p className="text-on-surface-variant text-sm">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-surface-container-high border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/materials" element={<MaterialsPage />} />
        <Route path="/processes" element={<ProcessesPage />} />
        <Route path="/expenses" element={<ExpensesAndBudgetsPage />} />
        <Route path="/templates" element={<ProductTemplatesPage />} />
        <Route path="/templates/:id" element={<TemplateDetailPage />} />
        <Route path="/terceros" element={<TercerosPage />} />
        <Route path="/clients" element={<Navigate to="/terceros" replace />} />
        <Route path="/quotes/new" element={<QuoterPage />} />
        <Route path="/quotes" element={<QuoteHistoryPage />} />
        <Route path="/quotes/:id" element={<QuoteDetailPage />} />
        <Route path="/settings" element={<CompanySettingsPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/settings/global" element={<GlobalSettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CategoryProvider>
          <GlobalSettingsProvider>
            <AppRoutes />
          </GlobalSettingsProvider>
        </CategoryProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

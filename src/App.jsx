import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { CategoryProvider } from '@/context/CategoryContext'
import AppLayout from '@/components/layout/AppLayout'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import MaterialsPage from '@/pages/MaterialsPage'
import ProcessesPage from '@/pages/ProcessesPage'
import FixedExpensesPage from '@/pages/FixedExpensesPage'
import ProductTemplatesPage from '@/pages/ProductTemplatesPage'
import TemplateDetailPage from '@/pages/TemplateDetailPage'
import ClientsPage from '@/pages/ClientsPage'
import QuoterPage from '@/pages/QuoterPage'
import QuoteHistoryPage from '@/pages/QuoteHistoryPage'
import QuoteDetailPage from '@/pages/QuoteDetailPage'
import CompanySettingsPage from '@/pages/CompanySettingsPage'
import OrdersPage from '@/pages/OrdersPage'


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
        <Route path="/expenses" element={<FixedExpensesPage />} />
        <Route path="/templates" element={<ProductTemplatesPage />} />
        <Route path="/templates/:id" element={<TemplateDetailPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/quotes/new" element={<QuoterPage />} />
        <Route path="/quotes" element={<QuoteHistoryPage />} />
        <Route path="/quotes/:id" element={<QuoteDetailPage />} />
        <Route path="/settings" element={<CompanySettingsPage />} />
        <Route path="/orders" element={<OrdersPage />} />
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
          <AppRoutes />
        </CategoryProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

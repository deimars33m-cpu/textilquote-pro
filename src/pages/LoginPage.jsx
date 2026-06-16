import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Input, Button, AlertBanner, Card } from '@/components/ui/index.jsx'

export default function LoginPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const isLogin = mode === 'login'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!email.trim() || !password.trim()) {
      setError('Por favor ingresa tu correo y contraseña.')
      return
    }

    if (!isLogin && password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    if (!isLogin && password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    setLoading(true)
    try {
      if (isLogin) {
        await signIn(email, password)
      } else {
        await signUp(email, password)
        setSuccess('Cuenta creada exitosamente. Revisa tu correo para confirmar tu cuenta.')
        setMode('login')
      }
    } catch (err) {
      const messages = {
        'Invalid login credentials': 'Correo o contraseña incorrectos.',
        'User already registered': 'Este correo ya está registrado.',
        'Email not confirmed': 'Confirma tu correo electrónico antes de iniciar sesión.',
        'Signup requires a valid password': 'Ingresa una contraseña válida.',
      }
      setError(messages[err.message] || err.message || 'Ocurrió un error inesperado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full min-h-screen bg-transparent flex flex-col items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-md min-w-[320px] sm:min-w-[400px]">
        {/* Logo / App Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
            <span className="material-symbols-outlined text-primary text-[32px]">cut</span>
          </div>
          <h1 className="text-display-lg text-on-surface font-bold tracking-tight">
            Textil<span className="text-primary">Quote</span> Pro
          </h1>
          <p className="text-body-md text-on-surface-variant mt-2">
            Sistema profesional de cotización textil
          </p>
        </div>

        {/* Card */}
        <Card className="w-full overflow-hidden">
          {/* Tab Toggle */}
          <div className="flex border-b border-outline-variant">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); setSuccess(null) }}
              className={`flex-1 py-3.5 text-sm font-bold transition-colors relative ${
                isLogin
                  ? 'text-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Iniciar Sesión
              {isLogin && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(null); setSuccess(null) }}
              className={`flex-1 py-3.5 text-sm font-bold transition-colors relative ${
                !isLogin
                  ? 'text-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Registrarse
              {!isLogin && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <AlertBanner type="error" onClose={() => setError(null)}>
                {error}
              </AlertBanner>
            )}

            {success && (
              <AlertBanner type="success" onClose={() => setSuccess(null)}>
                {success}
              </AlertBanner>
            )}

            <Input
              label="Correo electrónico"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              autoComplete="email"
              required
            />

            <Input
              label="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              required
            />

            {!isLogin && (
              <Input
                label="Confirmar contraseña"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full mt-2"
              size="lg"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                  {isLogin ? 'Ingresando...' : 'Registrando...'}
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">
                    {isLogin ? 'login' : 'person_add'}
                  </span>
                  {isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
                </>
              )}
            </Button>
          </form>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-on-surface-variant/60 mt-6">
          TextilQuote Pro &copy; {new Date().getFullYear()} — Cotización textil inteligente
        </p>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useCompanySettings } from '@/hooks/useCompanySettings'
import {
  Input, Button, Card, LoadingSpinner, AlertBanner,
} from '@/components/ui/index.jsx'

export default function CompanySettingsPage() {
  const { settings, loading, updateSettings } = useCompanySettings()

  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [toast, setToast] = useState(null)

  // Sync form with settings when loaded
  useEffect(() => {
    if (settings) {
      setForm({
        company_name: settings.company_name || '',
        currency: settings.currency || 'Bs',
        tax_percentage: settings.tax_percentage ?? 0,
        min_margin: settings.min_margin ?? 15,
        default_margin: settings.default_margin ?? 30,
        monthly_capacity_units: settings.monthly_capacity_units ?? 1000,
        monthly_capacity_hours: settings.monthly_capacity_hours ?? 160,
        quote_validity_days: settings.quote_validity_days ?? 15,
      })
    }
  }, [settings])

  const validate = () => {
    const errs = {}
    if (!form.company_name?.trim()) errs.company_name = 'Requerido'
    if (parseFloat(form.min_margin) >= parseFloat(form.default_margin)) {
      errs.min_margin = 'Debe ser menor al margen por defecto'
      errs.default_margin = 'Debe ser mayor al margen mínimo'
    }
    if (parseFloat(form.min_margin) < 0 || parseFloat(form.min_margin) > 100) {
      errs.min_margin = 'Debe estar entre 0 y 100'
    }
    if (parseFloat(form.default_margin) < 0 || parseFloat(form.default_margin) > 100) {
      errs.default_margin = 'Debe estar entre 0 y 100'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    setToast(null)

    try {
      await updateSettings({
        company_name: form.company_name.trim(),
        currency: form.currency.trim() || 'Bs',
        tax_percentage: parseFloat(form.tax_percentage) || 0,
        min_margin: parseFloat(form.min_margin) || 0,
        default_margin: parseFloat(form.default_margin) || 0,
        monthly_capacity_units: parseInt(form.monthly_capacity_units) || 0,
        monthly_capacity_hours: parseInt(form.monthly_capacity_hours) || 0,
        quote_validity_days: parseInt(form.quote_validity_days) || 0,
      })
      setToast({ type: 'success', message: 'Configuración guardada exitosamente.' })
      setTimeout(() => setToast(null), 4000)
    } catch (err) {
      console.error('Error saving settings:', err)
      setToast({ type: 'error', message: err.message || 'Error al guardar la configuración.' })
    } finally {
      setSaving(false)
    }
  }

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="animate-fade-in max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-headline-md font-semibold text-on-surface">Configuración</h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          Ajusta los parámetros generales de tu empresa y cotizaciones
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div className="mb-6">
          <AlertBanner type={toast.type} onClose={() => setToast(null)}>
            {toast.message}
          </AlertBanner>
        </div>
      )}

      <div className="space-y-6">
        {/* Section 1: Información de Empresa */}
        <Card className="p-6">
          <h2 className="text-headline-sm font-semibold text-on-surface mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">business</span>
            Información de Empresa
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nombre de la empresa"
              value={form.company_name || ''}
              onChange={(e) => updateField('company_name', e.target.value)}
              placeholder="Mi Empresa Textil"
              error={errors.company_name}
              className="sm:col-span-2"
            />
            <Input
              label="Moneda"
              value={form.currency || ''}
              onChange={(e) => updateField('currency', e.target.value)}
              placeholder="Bs"
            />
            <Input
              label="Impuesto"
              type="number"
              step="1"
              min="0"
              max="100"
              value={form.tax_percentage ?? ''}
              onChange={(e) => updateField('tax_percentage', e.target.value)}
              placeholder="0"
              suffix="%"
            />
          </div>
        </Card>

        {/* Section 2: Márgenes y Precios */}
        <Card className="p-6">
          <h2 className="text-headline-sm font-semibold text-on-surface mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">trending_up</span>
            Márgenes y Precios
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Margen mínimo"
              type="number"
              step="1"
              min="0"
              max="100"
              value={form.min_margin ?? ''}
              onChange={(e) => updateField('min_margin', e.target.value)}
              placeholder="15"
              suffix="%"
              error={errors.min_margin}
            />
            <Input
              label="Margen por defecto"
              type="number"
              step="1"
              min="0"
              max="100"
              value={form.default_margin ?? ''}
              onChange={(e) => updateField('default_margin', e.target.value)}
              placeholder="30"
              suffix="%"
              error={errors.default_margin}
            />
          </div>
          <p className="text-xs text-on-surface-variant mt-3">
            El margen mínimo genera una alerta cuando una cotización tiene un margen real inferior.
            El margen por defecto se usa como valor inicial al crear nuevas cotizaciones.
          </p>
        </Card>

        {/* Section 4: Cotizaciones */}
        <Card className="p-6">
          <h2 className="text-headline-sm font-semibold text-on-surface mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">description</span>
            Cotizaciones
          </h2>
          <Input
            label="Validez de cotización"
            type="number"
            step="1"
            min="1"
            value={form.quote_validity_days ?? ''}
            onChange={(e) => updateField('quote_validity_days', e.target.value)}
            placeholder="15"
            suffix="días"
            className="max-w-xs"
          />
          <p className="text-xs text-on-surface-variant mt-3">
            Número de días que una cotización es válida desde su fecha de emisión.
          </p>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end pb-6">
          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">save</span>
                Guardar Configuración
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

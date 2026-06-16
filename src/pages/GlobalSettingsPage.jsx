import { useState } from 'react'
import { useGlobalSettings } from '@/context/GlobalSettingsContext'
import { Card, Button, Input, Select, Textarea } from '@/components/ui/index.jsx'
import { formatCurrency } from '@/lib/formatters'

const MULTIPLIERS = {
  light: {
    '2': 0.60, '4': 0.60, '6': 0.60,
    '8': 0.70, '10': 0.70, '12': 0.70,
    '14': 0.80, '16': 0.80,
    'S': 0.85, 'M': 0.92, 'L': 1.00,
    'XL': 1.08, 'XXL': 1.15, 'XXXL': 1.25
  },
  heavy: {
    '2': 0.65, '4': 0.65, '6': 0.65,
    '8': 0.75, '10': 0.75, '12': 0.75,
    '14': 0.85, '16': 0.85,
    'S': 0.90, 'M': 0.95, 'L': 1.00,
    'XL': 1.10, 'XXL': 1.20, 'XXXL': 1.35
  }
}

export default function GlobalSettingsPage() {
  const { 
    settings, 
    updateSizePrice, 
    updatePanelPrice, 
    resetToDefaults,
    addCategory,
    updateCategory,
    deleteCategory,
    addSubcategory,
    updateSubcategory,
    deleteSubcategory,
    updateSizePriceForSubcategory,
    updateMultipleSizePricesForSubcategory,
    addExpenseCategory,
    updateExpenseCategory,
    deleteExpenseCategory,
    addExpenseSubcategory,
    deleteExpenseSubcategory,
    addExpenseSpecificItem,
    deleteExpenseSpecificItem
  } = useGlobalSettings()
  
  const [activeTab, setActiveTab] = useState('categories') // 'categories', 'subcategories', 'sizes', 'panels'
  const [savedStatus, setSavedStatus] = useState({})
  
  // Category Form State
  const [editingCategory, setEditingCategory] = useState(null)
  const [catForm, setCatForm] = useState({ id: '', label: '', icon: '' })

  const [selectedCatForSub, setSelectedCatForSub] = useState('')
  const [editingSub, setEditingSub] = useState(null)
  const [subForm, setSubForm] = useState({ id: '', label: '', icon: '', description: '', unit: 'unidad', unitPrice: 0 })

  // Sizes Form State
  const [sizeSubcategory, setSizeSubcategory] = useState('default')
  const [autoGenBasePrice, setAutoGenBasePrice] = useState('')
  const [autoGenProfile, setAutoGenProfile] = useState('light')

  const handleAutoGenerate = () => {
    if (!autoGenBasePrice || parseFloat(autoGenBasePrice) <= 0) {
      return alert('Ingrese un precio base válido para la Talla L.')
    }
    const base = parseFloat(autoGenBasePrice)
    const profile = MULTIPLIERS[autoGenProfile]
    const newPrices = {}
    
    Object.keys(settings.sizes).forEach(size => {
      if (profile[size]) {
        newPrices[size] = Math.round(base * profile[size])
      } else {
        newPrices[size] = base
      }
    })

    if (sizeSubcategory === 'default') {
      Object.entries(newPrices).forEach(([s, p]) => updateSizePrice(s, p))
    } else {
      updateMultipleSizePricesForSubcategory(sizeSubcategory, newPrices)
    }
    showSavedIndicator('autogen_save')
    alert('Precios autogenerados correctamente.')
  }

  // Panels Auto-Gen State
  const [autoGenPanelPrice, setAutoGenPanelPrice] = useState('')

  const handleAutoGeneratePanels = () => {
    if (!autoGenPanelPrice || parseFloat(autoGenPanelPrice) <= 0) {
      return alert('Ingrese un precio base válido para 1 Panel.')
    }
    const base = parseFloat(autoGenPanelPrice)
    
    Object.keys(settings.panels).forEach(panelKey => {
      // panelKey is like '1 PANEL', '2 PANELES', etc. Extract the number.
      const match = panelKey.match(/^(\d+)/)
      if (match) {
        const count = parseInt(match[1], 10)
        const price = base * count
        updatePanelPrice(panelKey, price)
      }
    })
    showSavedIndicator('autogen_panels_save')
    alert('Precios de paneles autogenerados correctamente.')
  }

  const showSavedIndicator = (id) => {
    setSavedStatus(prev => ({ ...prev, [id]: true }))
    setTimeout(() => setSavedStatus(prev => ({ ...prev, [id]: false })), 1500)
  }

  const handleReset = () => {
    if (window.confirm('¿Estás seguro de que deseas restaurar todos los valores a sus valores por defecto? Perderás cualquier cambio realizado.')) {
      resetToDefaults()
    }
  }

  // --- Categories Logic ---
  const handleSaveCategory = () => {
    if (!catForm.id || !catForm.label || !catForm.icon) return alert('Llene todos los campos')
    
    if (editingCategory) {
      updateCategory(editingCategory.id, catForm)
    } else {
      if (settings.categories.find(c => c.id === catForm.id)) return alert('El ID ya existe')
      addCategory(catForm)
    }
    setEditingCategory(null)
    setCatForm({ id: '', label: '', icon: '' })
    showSavedIndicator('category_save')
  }

  // --- Subcategories Logic ---
  const handleSaveSubcategory = () => {
    if (!selectedCatForSub) return alert('Seleccione una categoría principal')
    if (!subForm.id || !subForm.label || !subForm.icon) return alert('Llene los campos obligatorios')
    
    if (editingSub) {
      updateSubcategory(selectedCatForSub, editingSub.id, subForm)
    } else {
      const existing = settings.subcategories[selectedCatForSub] || []
      if (existing.find(s => s.id === subForm.id)) return alert('El ID ya existe')
      addSubcategory(selectedCatForSub, subForm)
    }
    setEditingSub(null)
    setSubForm({ id: '', label: '', icon: '', description: '', unit: 'unidad', unitPrice: 0 })
    showSavedIndicator('subcategory_save')
  }

  return (
    <div className="animate-fade-in space-y-6 max-w-5xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-headline-md font-semibold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[28px]">admin_panel_settings</span>
            Configuración Global
          </h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            Administra las categorías, subcategorías, unidades de medida y precios base del sistema.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleReset} className="flex items-center gap-2 text-error hover:bg-error/10 border-error/20">
            <span className="material-symbols-outlined text-[18px]">restore</span>
            Restaurar Valores por Defecto
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-surface-container/30 p-1.5 rounded-xl border border-white/5 w-fit">
        {[
          { id: 'categories', label: 'Categorías Principales', icon: 'category' },
          { id: 'subcategories', label: 'Subcategorías y Servicios', icon: 'account_tree' },
          { id: 'sizes', label: 'Precios Tallas (Textil)', icon: 'apparel' },
          { id: 'expenses_structure', label: 'Estructura de Gastos', icon: 'payments' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id)
              setEditingCategory(null)
              setEditingSub(null)
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id 
                ? 'bg-[#ff5c00]/10 text-[#ff5c00] shadow-[0_0_10px_rgba(255,92,0,0.1)] border border-[#ff5c00]/20' 
                : 'text-on-surface-variant hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <Card className="p-6 bg-surface-container/20 border-white/5 min-h-[400px]">
        {/* --- TAB: CATEGORIES --- */}
        {activeTab === 'categories' && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-body-lg font-bold text-white">Categorías Actuales</h3>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                  {settings.categories.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between p-3 bg-[#0f131a] border border-white/5 rounded-xl">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary">{cat.icon}</span>
                        <div>
                          <p className="font-bold text-sm text-white">{cat.label}</p>
                          <p className="text-[10px] text-on-surface-variant font-mono">{cat.id}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => {
                          setEditingCategory(cat)
                          setCatForm(cat)
                        }} className="p-1.5 hover:bg-white/5 text-on-surface-variant hover:text-white rounded">
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                        <button onClick={() => {
                          if(window.confirm('¿Eliminar categoría? Se perderán sus subcategorías.')) deleteCategory(cat.id)
                        }} className="p-1.5 hover:bg-error/10 text-error rounded">
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#0f131a] p-4 rounded-xl border border-white/5 space-y-4 h-fit">
                <h3 className="text-body-lg font-bold text-white">
                  {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
                </h3>
                <Input
                  label="ID Único (sin espacios)"
                  value={catForm.id}
                  onChange={e => setCatForm({...catForm, id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_')})}
                  disabled={!!editingCategory}
                  placeholder="ej_categoria_nueva"
                />
                <Input
                  label="Nombre a mostrar"
                  value={catForm.label}
                  onChange={e => setCatForm({...catForm, label: e.target.value})}
                  placeholder="Ej. Producción Textil"
                />
                <Input
                  label="Icono (Material Symbols)"
                  value={catForm.icon}
                  onChange={e => setCatForm({...catForm, icon: e.target.value})}
                  placeholder="Ej. factory, diamond, print..."
                />
                <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                  {editingCategory && (
                    <Button variant="secondary" onClick={() => {
                      setEditingCategory(null)
                      setCatForm({ id: '', label: '', icon: '' })
                    }}>Cancelar</Button>
                  )}
                  <Button onClick={handleSaveCategory}>
                    Guardar
                  </Button>
                </div>
                {savedStatus['category_save'] && <p className="text-green-400 text-xs text-right animate-pulse">Guardado exitosamente!</p>}
              </div>
            </div>
          </div>
        )}

        {/* --- TAB: SUBCATEGORIES --- */}
        {activeTab === 'subcategories' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex gap-4 mb-4">
              <div className="w-64">
                <Select
                  label="Selecciona la Categoría Principal"
                  value={selectedCatForSub}
                  onChange={e => {
                    setSelectedCatForSub(e.target.value)
                    setEditingSub(null)
                    setSubForm({ id: '', label: '', icon: '', description: '', unit: 'unidad', unitPrice: 0 })
                  }}
                  options={[
                    { value: '', label: 'Seleccionar...' },
                    ...settings.categories.map(c => ({ value: c.id, label: c.label }))
                  ]}
                />
              </div>
            </div>

            {selectedCatForSub ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-body-lg font-bold text-white">Subcategorías y Servicios</h3>
                  <div className="space-y-2 max-h-[450px] overflow-y-auto pr-2">
                    {(settings.subcategories[selectedCatForSub] || []).map(sub => (
                      <div key={sub.id} className="flex items-center justify-between p-3 bg-[#0f131a] border border-white/5 rounded-xl hover:border-white/10">
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-primary">{sub.icon}</span>
                          <div>
                            <p className="font-bold text-sm text-white">{sub.label}</p>
                            <p className="text-[10px] text-on-surface-variant font-mono">
                              {sub.id} | {sub.unit === 'tallas' ? 'Tallas' : sub.unit === 'unidad' ? 'Unidad' : sub.unit === 'metro' ? 'Metro' : sub.unit === '1000_puntadas' ? '1K Puntadas' : sub.unit}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Toggle Switch Tallas ON/OFF */}
                          <div className="flex items-center gap-1.5 mr-2 bg-white/[0.02] border border-white/5 rounded-lg px-2 py-1">
                            <span className="text-[9px] text-on-surface-variant/80 font-mono font-bold">TALLAS:</span>
                            <button
                              type="button"
                              onClick={() => {
                                const newUnit = sub.unit === 'tallas' ? 'unidad' : 'tallas';
                                updateSubcategory(selectedCatForSub, sub.id, {
                                  ...sub,
                                  unit: newUnit
                                });
                              }}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                                sub.unit === 'tallas' ? 'bg-[#ff5c00]' : 'bg-white/10'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  sub.unit === 'tallas' ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                            <span className={`text-[9px] font-bold font-mono ${sub.unit === 'tallas' ? 'text-primary' : 'text-on-surface-variant/50'}`}>
                              {sub.unit === 'tallas' ? 'ON' : 'OFF'}
                            </span>
                          </div>

                          {sub.unitPrice !== undefined && sub.unit !== 'tallas' && (
                            <span className="text-xs text-primary font-mono bg-primary/10 px-2 py-0.5 rounded">
                              Bs {sub.unitPrice}
                            </span>
                          )}
                          <button onClick={() => {
                            setEditingSub(sub)
                            setSubForm({
                              id: sub.id, label: sub.label, icon: sub.icon, 
                              description: sub.description || '', 
                              unit: sub.unit || 'unidad', 
                              unitPrice: sub.unitPrice || 0
                            })
                          }} className="p-1.5 hover:bg-white/5 text-on-surface-variant hover:text-white rounded">
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                          </button>
                          <button onClick={() => {
                            if(window.confirm('¿Eliminar subcategoría?')) deleteSubcategory(selectedCatForSub, sub.id)
                          }} className="p-1.5 hover:bg-error/10 text-error rounded">
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                    {!(settings.subcategories[selectedCatForSub] || []).length && (
                       <p className="text-sm text-on-surface-variant italic py-4 text-center">No hay subcategorías registradas.</p>
                    )}
                  </div>
                </div>
 
                <div className="bg-[#0f131a] p-4 rounded-xl border border-white/5 space-y-4 h-fit">
                  <h3 className="text-body-lg font-bold text-white">
                    {editingSub ? 'Editar Subcategoría' : 'Nueva Subcategoría'}
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="ID Único"
                      value={subForm.id}
                      onChange={e => setSubForm({...subForm, id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_')})}
                      disabled={!!editingSub}
                      placeholder="ej_subcat"
                    />
                    <Input
                      label="Icono"
                      value={subForm.icon}
                      onChange={e => setSubForm({...subForm, icon: e.target.value})}
                      placeholder="Ej. apparel"
                    />
                  </div>
                  <Input
                    label="Nombre a mostrar"
                    value={subForm.label}
                    onChange={e => setSubForm({...subForm, label: e.target.value})}
                    placeholder="Ej. Camisetas"
                  />
                  <Textarea
                    label="Descripción corta"
                    value={subForm.description}
                    onChange={e => setSubForm({...subForm, description: e.target.value})}
                    rows={2}
                  />
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
                     <Select
                        label="Unidad de Cobro"
                        value={subForm.unit}
                        onChange={e => setSubForm({...subForm, unit: e.target.value})}
                        options={[
                           { value: 'tallas', label: 'Por Tallas (Textil)' },
                           { value: 'unidad', label: 'Por Unidad / General' },
                           { value: 'metro', label: 'Por Metro (DTF/Sublimación)' },
                           { value: '1000_puntadas', label: 'Por 1,000 Puntadas (Bordado)' }
                        ]}
                     />
                     <Input
                        label="Precio Sugerido (Bs)"
                        type="number"
                        min="0"
                        step="0.1"
                        value={subForm.unitPrice}
                        onChange={e => setSubForm({...subForm, unitPrice: parseFloat(e.target.value) || 0})}
                     />
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                    {editingSub && (
                      <Button variant="secondary" onClick={() => {
                        setEditingSub(null)
                        setSubForm({ id: '', label: '', icon: '', description: '', unit: 'unidad', unitPrice: 0 })
                      }}>Cancelar</Button>
                    )}
                    <Button onClick={handleSaveSubcategory}>
                      Guardar
                    </Button>
                  </div>
                  {savedStatus['subcategory_save'] && <p className="text-green-400 text-xs text-right animate-pulse">Guardado exitosamente!</p>}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center bg-[#0f131a] rounded-xl border border-white/5">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant/30 mb-2">category</span>
                <p className="text-on-surface-variant">Selecciona una categoría principal para ver y editar sus subcategorías o servicios.</p>
              </div>
            )}
          </div>
        )}

        {/* --- TAB: SIZES --- */}
        {activeTab === 'sizes' && (
          <div className="space-y-6 animate-fade-in">
            {/* Header / Selector */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white/[0.02] p-4 rounded-xl border border-white/5">
              <div className="w-full sm:w-72">
                <Select
                  label="Lista de Precios a Editar"
                  value={sizeSubcategory}
                  onChange={e => setSizeSubcategory(e.target.value)}
                  options={[
                    { value: 'default', label: 'Valores por Defecto (Global)' },
                    ...settings.categories.flatMap(c => 
                      (settings.subcategories[c.id] || [])
                        .filter(s => s.unit === 'tallas')
                        .map(s => ({ value: s.id, label: `${s.label} (${c.label})` }))
                    )
                  ]}
                />
              </div>
              <p className="text-xs text-on-surface-variant/80 flex-1">
                {sizeSubcategory === 'default' 
                  ? 'Estás editando los precios globales que se usarán si una subcategoría no tiene precios específicos.'
                  : 'Estás editando los precios específicos para esta subcategoría.'}
              </p>
            </div>

            {/* Auto-Generador */}
            <div className="bg-[#0f131a] p-4 rounded-xl border border-[#ff5c00]/20 space-y-3 relative overflow-hidden">
               <div className="absolute top-0 right-0 bg-[#ff5c00]/10 text-[#ff5c00] text-[10px] font-bold px-3 py-1 rounded-bl-lg">NUEVO</div>
               <h4 className="text-sm font-bold text-white flex items-center gap-2">
                 <span className="material-symbols-outlined text-[#ff5c00] text-[18px]">magic_button</span>
                 Autogenerar Precios por Escala
               </h4>
               <div className="flex flex-col sm:flex-row gap-3 items-end">
                  <div className="flex-1">
                     <Input
                        label="Precio Base (Talla L) en Bs"
                        type="number"
                        min="0"
                        value={autoGenBasePrice}
                        onChange={e => setAutoGenBasePrice(e.target.value)}
                        placeholder="Ej. 65"
                     />
                  </div>
                  <div className="flex-1">
                     <Select
                        label="Perfil de Escala"
                        value={autoGenProfile}
                        onChange={e => setAutoGenProfile(e.target.value)}
                        options={[
                           { value: 'light', label: 'Prenda Ligera (Poleras, Shorts)' },
                           { value: 'heavy', label: 'Prenda Pesada (Buzos, Chaquetas)' }
                        ]}
                     />
                  </div>
                  <Button onClick={handleAutoGenerate} className="whitespace-nowrap h-[42px]">
                     Calcular y Aplicar
                  </Button>
               </div>
               {savedStatus['autogen_save'] && <p className="text-green-400 text-xs text-right animate-pulse">¡Precios actualizados masivamente!</p>}
            </div>

            {/* Grid de Tallas */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Object.entries(settings.sizes).map(([size, globalPrice]) => {
                const currentPrice = sizeSubcategory === 'default' 
                  ? globalPrice 
                  : (settings.sizesBySubcategory[sizeSubcategory]?.[size] || globalPrice)

                return (
                  <div key={size} className="bg-[#0f131a] p-4 rounded-xl border border-white/10 relative group hover:border-[#ff5c00]/30 transition-colors">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-body-lg font-bold text-primary">{size}</span>
                      {savedStatus[`size_${sizeSubcategory}_${size}`] ? (
                        <span className="material-symbols-outlined text-[16px] text-green-400 animate-pulse">check_circle</span>
                      ) : (
                        <span className="material-symbols-outlined text-[16px] text-on-surface-variant/30 group-hover:text-on-surface-variant/50 transition-colors">edit</span>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">Bs</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={currentPrice}
                        onChange={(e) => {
                          if (sizeSubcategory === 'default') {
                            updateSizePrice(size, e.target.value)
                          } else {
                            updateSizePriceForSubcategory(sizeSubcategory, size, e.target.value)
                          }
                          showSavedIndicator(`size_${sizeSubcategory}_${size}`)
                        }}
                        className="w-full bg-black/40 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-sm text-white font-mono outline-none focus:border-[#ff5c00] transition-colors"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* --- TAB: EXPENSES STRUCTURE --- */}
        {activeTab === 'expenses_structure' && (
          <ExpensesStructureEditor 
            settings={settings}
            addExpenseCategory={addExpenseCategory}
            updateExpenseCategory={updateExpenseCategory}
            deleteExpenseCategory={deleteExpenseCategory}
            addExpenseSubcategory={addExpenseSubcategory}
            deleteExpenseSubcategory={deleteExpenseSubcategory}
            addExpenseSpecificItem={addExpenseSpecificItem}
            deleteExpenseSpecificItem={deleteExpenseSpecificItem}
            showSavedIndicator={showSavedIndicator}
            savedStatus={savedStatus}
          />
        )}
      </Card>
    </div>
  )
}

function ExpensesStructureEditor({
  settings,
  addExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
  addExpenseSubcategory,
  deleteExpenseSubcategory,
  addExpenseSpecificItem,
  deleteExpenseSpecificItem,
  showSavedIndicator,
  savedStatus
}) {
  const expenseStructure = settings.expenseStructure || {}
  
  const [selectedCat, setSelectedCat] = useState('')
  const [selectedSub, setSelectedSub] = useState('')
  
  // Form states
  const [newCatKey, setNewCatKey] = useState('')
  const [newCatLabel, setNewCatLabel] = useState('')
  const [editingCatKey, setEditingCatKey] = useState('')
  const [editingCatLabel, setEditingCatLabel] = useState('')
  
  const [newSubName, setNewSubName] = useState('')
  const [newItemName, setNewItemName] = useState('')

  const handleAddCat = () => {
    if (!newCatKey.trim() || !newCatLabel.trim()) return alert('Ingrese clave y nombre de categoría')
    const formattedKey = newCatKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_')
    if (expenseStructure[formattedKey]) return alert('Esta categoría ya existe')
    
    addExpenseCategory(formattedKey, newCatLabel.trim())
    setNewCatKey('')
    setNewCatLabel('')
    setSelectedCat(formattedKey)
    setSelectedSub('')
    showSavedIndicator('expense_structure_save')
  }

  const handleUpdateCat = () => {
    if (!editingCatLabel.trim()) return
    updateExpenseCategory(editingCatKey, editingCatLabel.trim())
    setEditingCatKey('')
    setEditingCatLabel('')
    showSavedIndicator('expense_structure_save')
  }

  const handleAddSub = () => {
    if (!selectedCat) return alert('Seleccione una categoría primero')
    if (!newSubName.trim()) return alert('Ingrese nombre de la subcategoría')
    
    addExpenseSubcategory(selectedCat, newSubName.trim())
    setSelectedSub(newSubName.trim())
    setNewSubName('')
    showSavedIndicator('expense_structure_save')
  }

  const handleAddItem = () => {
    if (!selectedCat || !selectedSub) return alert('Seleccione categoría y subcategoría')
    if (!newItemName.trim()) return alert('Ingrese nombre del ítem específico')
    
    addExpenseSpecificItem(selectedCat, selectedSub, newItemName.trim())
    setNewItemName('')
    showSavedIndicator('expense_structure_save')
  }

  const categories = Object.entries(expenseStructure)

  return (
    <div className="space-y-6 animate-fade-in text-white">
      <div className="flex justify-between items-center pb-3 border-b border-white/5">
        <h3 className="text-lg font-bold text-white">Estructura de Categorías de Gastos</h3>
        {savedStatus['expense_structure_save'] && (
          <span className="text-emerald-400 text-xs font-bold animate-pulse flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">check_circle</span> Cambios guardados
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* COLUMNA 1: Categorías Principales */}
        <div className="bg-[#0a0d14]/40 p-4 rounded-xl border border-white/5 space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-bold text-primary font-mono uppercase tracking-wider">1. Categorías Principales</h4>
          </div>
          
          <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
            {categories.map(([key, data]) => {
              const isActive = selectedCat === key
              return (
                <div 
                  key={key} 
                  className={`flex items-center justify-between p-2.5 rounded-lg border text-sm transition-all cursor-pointer ${
                    isActive 
                      ? 'bg-[#ff5c00]/10 border-[#ff5c00]/40 text-[#ff5c00]' 
                      : 'bg-[#0f131a] border-white/5 text-on-surface-variant hover:text-white hover:border-white/10'
                  }`}
                  onClick={() => {
                    setSelectedCat(key)
                    setSelectedSub('')
                  }}
                >
                  <div className="flex-1 truncate">
                    <p className="font-bold text-xs">{data.label}</p>
                    <p className="text-[9px] font-mono opacity-50">{key}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <button 
                      onClick={() => {
                        setEditingCatKey(key)
                        setEditingCatLabel(data.label)
                      }}
                      className="p-1 hover:bg-white/5 rounded text-on-surface-variant hover:text-white"
                    >
                      <span className="material-symbols-outlined text-[15px]">edit</span>
                    </button>
                    <button 
                      onClick={() => {
                        if (window.confirm(`¿Eliminar la categoría "${data.label}" y todo su contenido?`)) {
                          deleteExpenseCategory(key)
                          if (selectedCat === key) {
                            setSelectedCat('')
                            setSelectedSub('')
                          }
                          showSavedIndicator('expense_structure_save')
                        }
                      }}
                      className="p-1 hover:bg-error/10 rounded text-error"
                    >
                      <span className="material-symbols-outlined text-[15px]">delete</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {editingCatKey ? (
            <div className="bg-black/20 p-3 rounded-lg border border-white/5 space-y-3">
              <p className="text-[10px] font-bold uppercase text-primary">Editar Categoría</p>
              <input
                type="text"
                placeholder="Nombre de categoría"
                value={editingCatLabel}
                onChange={e => setEditingCatLabel(e.target.value)}
                className="w-full bg-[#0f131a] border border-white/10 rounded px-2.5 py-1.5 text-xs text-white"
              />
              <div className="flex justify-end gap-1.5">
                <button 
                  onClick={() => { setEditingCatKey(''); setEditingCatLabel(''); }} 
                  className="px-2 py-1 bg-white/5 text-[10px] rounded hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleUpdateCat} 
                  className="px-2.5 py-1 bg-primary text-[10px] font-bold rounded hover:bg-primary/80"
                >
                  Guardar
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-black/20 p-3 rounded-lg border border-white/5 space-y-2.5">
              <p className="text-[10px] font-bold uppercase text-on-surface-variant">Nueva Categoría</p>
              <input
                type="text"
                placeholder="CLAVE_UNICA (Ej: LOGISTICA)"
                value={newCatKey}
                onChange={e => setNewCatKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
                className="w-full bg-[#0f131a] border border-white/10 rounded px-2.5 py-1.5 text-xs font-mono text-white"
              />
              <input
                type="text"
                placeholder="Nombre a mostrar (Ej: Logística)"
                value={newCatLabel}
                onChange={e => setNewCatLabel(e.target.value)}
                className="w-full bg-[#0f131a] border border-white/10 rounded px-2.5 py-1.5 text-xs text-white"
              />
              <button 
                onClick={handleAddCat}
                className="w-full py-1.5 bg-primary/20 border border-primary/30 hover:bg-primary text-white rounded text-xs font-bold transition-all"
              >
                Agregar Categoría
              </button>
            </div>
          )}
        </div>

        {/* COLUMNA 2: Subcategorías */}
        <div className="bg-[#0a0d14]/40 p-4 rounded-xl border border-white/5 space-y-4">
          <h4 className="text-xs font-bold text-primary font-mono uppercase tracking-wider">2. Subcategorías</h4>
          
          {selectedCat ? (
            <>
              <p className="text-[11px] text-on-surface-variant">
                En: <strong className="text-white">{expenseStructure[selectedCat]?.label}</strong>
              </p>
              <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
                {Object.keys(expenseStructure[selectedCat]?.subcategories || {}).map(sub => {
                  const isActive = selectedSub === sub
                  return (
                    <div 
                      key={sub} 
                      className={`flex items-center justify-between p-2 rounded-lg border text-xs transition-all cursor-pointer ${
                        isActive 
                          ? 'bg-primary/10 border-primary/40 text-primary' 
                          : 'bg-[#0f131a] border-white/5 text-on-surface-variant hover:text-white hover:border-white/10'
                      }`}
                      onClick={() => setSelectedSub(sub)}
                    >
                      <span className="font-semibold truncate">{sub}</span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          if (window.confirm(`¿Eliminar la subcategoría "${sub}"?`)) {
                            deleteExpenseSubcategory(selectedCat, sub)
                            if (selectedSub === sub) setSelectedSub('')
                            showSavedIndicator('expense_structure_save')
                          }
                        }}
                        className="p-1 hover:bg-error/10 rounded text-error shrink-0"
                      >
                        <span className="material-symbols-outlined text-[15px]">delete</span>
                      </button>
                    </div>
                  )
                })}
                {!Object.keys(expenseStructure[selectedCat]?.subcategories || {}).length && (
                  <p className="text-[11px] text-on-surface-variant/50 italic py-3 text-center">No hay subcategorías.</p>
                )}
              </div>

              <div className="bg-black/20 p-3 rounded-lg border border-white/5 space-y-2">
                <input
                  type="text"
                  placeholder="Nombre de subcategoría..."
                  value={newSubName}
                  onChange={e => setNewSubName(e.target.value)}
                  className="w-full bg-[#0f131a] border border-white/10 rounded px-2.5 py-1.5 text-xs text-white"
                />
                <button 
                  onClick={handleAddSub}
                  className="w-full py-1.5 bg-primary/20 border border-primary/30 hover:bg-primary text-white rounded text-xs font-bold transition-all"
                >
                  Agregar Subcategoría
                </button>
              </div>
            </>
          ) : (
            <p className="text-xs text-on-surface-variant italic py-10 text-center">Seleccione una categoría principal.</p>
          )}
        </div>

        {/* COLUMNA 3: Ítems Específicos */}
        <div className="bg-[#0a0d14]/40 p-4 rounded-xl border border-white/5 space-y-4">
          <h4 className="text-xs font-bold text-primary font-mono uppercase tracking-wider">3. Ítems Específicos</h4>
          
          {selectedCat && selectedSub ? (
            <>
              <div className="text-[11px] text-on-surface-variant leading-tight">
                Categoría: <strong className="text-white">{expenseStructure[selectedCat]?.label}</strong>
                <br />
                Subcat: <strong className="text-primary">{selectedSub}</strong>
              </div>
              <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
                {(expenseStructure[selectedCat]?.subcategories[selectedSub] || []).map(item => (
                  <div 
                    key={item} 
                    className="flex items-center justify-between p-2 rounded-lg border border-white/5 bg-[#0f131a] text-xs text-on-surface-variant"
                  >
                    <span className="font-semibold truncate">{item}</span>
                    <button 
                      onClick={() => {
                        deleteExpenseSpecificItem(selectedCat, selectedSub, item)
                        showSavedIndicator('expense_structure_save')
                      }}
                      className="p-1 hover:bg-error/10 rounded text-error shrink-0"
                    >
                      <span className="material-symbols-outlined text-[15px]">delete</span>
                    </button>
                  </div>
                ))}
                {!(expenseStructure[selectedCat]?.subcategories[selectedSub] || []).length && (
                  <p className="text-[11px] text-on-surface-variant/50 italic py-3 text-center">No hay ítems específicos.</p>
                )}
              </div>

              <div className="bg-black/20 p-3 rounded-lg border border-white/5 space-y-2">
                <input
                  type="text"
                  placeholder="Nombre del ítem (ej: Hilos, Agujas)..."
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                  className="w-full bg-[#0f131a] border border-white/10 rounded px-2.5 py-1.5 text-xs text-white"
                />
                <button 
                  onClick={handleAddItem}
                  className="w-full py-1.5 bg-primary/20 border border-primary/30 hover:bg-primary text-white rounded text-xs font-bold transition-all"
                >
                  Agregar Ítem Específico
                </button>
              </div>
            </>
          ) : (
            <p className="text-xs text-on-surface-variant italic py-10 text-center">Seleccione categoría y subcategoría.</p>
          )}
        </div>

      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
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
    deleteExpenseSpecificItem,
    saveBudgetsAndGoals
  } = useGlobalSettings()
  
  const [activeTab, setActiveTab] = useState('orders_structure') // 'orders_structure', 'sizes', 'expenses_structure'
  const [savedStatus, setSavedStatus] = useState({})

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
      <div className="flex flex-wrap items-center gap-2 bg-surface-container-low p-1.5 rounded-xl border border-outline-variant w-fit">
        {[
          { id: 'orders_structure', label: 'Estructura de Pedidos', icon: 'category' },
          { id: 'sizes', label: 'Precios Tallas (Textil)', icon: 'apparel' },
          { id: 'expenses_structure', label: 'Estructura de Gastos', icon: 'payments' },
          { id: 'budgets_goals', label: 'Metas y Presupuestos', icon: 'savings' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id)
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id 
                ? 'bg-primary/10 text-primary shadow-[0_0_10px_rgba(255,122,0,0.15)] border border-primary/20' 
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high border border-transparent'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <Card className="p-6 min-h-[400px]">
        {/* --- TAB: ORDERS STRUCTURE --- */}
        {activeTab === 'orders_structure' && (
          <OrdersStructureEditor 
            settings={settings}
            addCategory={addCategory}
            updateCategory={updateCategory}
            deleteCategory={deleteCategory}
            addSubcategory={addSubcategory}
            updateSubcategory={updateSubcategory}
            deleteSubcategory={deleteSubcategory}
            showSavedIndicator={showSavedIndicator}
            savedStatus={savedStatus}
          />
        )}

        {/* --- TAB: SIZES --- */}
        {activeTab === 'sizes' && (
          <div className="space-y-6 animate-fade-in">
            {/* Header / Selector */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-surface-container-low p-4 rounded-xl border border-outline-variant">
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
            <div className="bg-surface-container-low p-4 rounded-xl border border-primary/20 space-y-3 relative overflow-hidden">
               <div className="absolute top-0 right-0 bg-[#ff5c00]/10 text-[#ff5c00] text-[10px] font-bold px-3 py-1 rounded-bl-lg">NUEVO</div>
               <h4 className="text-sm font-bold text-on-surface flex items-center gap-2">
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
                {savedStatus['autogen_save'] && <p className="text-tertiary text-xs text-right animate-pulse">¡Precios actualizados masivamente!</p>}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Object.entries(settings.sizes).map(([size, globalPrice]) => {
                const currentPrice = sizeSubcategory === 'default' 
                  ? globalPrice 
                  : (settings.sizesBySubcategory[sizeSubcategory]?.[size] || globalPrice)

                return (
                  <div key={size} className="bg-surface p-4 rounded-xl border border-outline-variant relative group hover:border-primary/30 transition-colors">
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
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg pl-8 pr-3 py-2 text-sm text-on-surface font-mono outline-none focus:border-primary transition-colors"
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

        {/* --- TAB: BUDGETS & GOALS --- */}
        {activeTab === 'budgets_goals' && (
          <BudgetsAndGoalsEditor
            settings={settings}
            saveBudgetsAndGoals={saveBudgetsAndGoals}
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
    <div className="space-y-6 animate-fade-in text-on-surface">
      <div className="flex justify-between items-center pb-3 border-b border-outline-variant">
        <h3 className="text-lg font-bold text-on-surface">Estructura de Categorías de Gastos</h3>
        {savedStatus['expense_structure_save'] && (
          <span className="text-tertiary text-xs font-bold animate-pulse flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">check_circle</span> Cambios guardados
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* COLUMNA 1: Categorías Principales */}
        <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant space-y-4">
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
                      ? 'bg-primary/10 border-primary/40 text-primary' 
                      : 'bg-surface border-outline-variant text-on-surface-variant hover:text-on-surface hover:border-outline'
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
                      className="p-1 hover:bg-surface-container-high rounded text-on-surface-variant hover:text-on-surface"
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
            <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant space-y-3">
              <p className="text-[10px] font-bold uppercase text-primary">Editar Categoría</p>
              <input
                type="text"
                placeholder="Nombre de categoría"
                value={editingCatLabel}
                onChange={e => setEditingCatLabel(e.target.value)}
                className="w-full bg-surface border border-outline rounded px-2.5 py-1.5 text-xs text-on-surface"
              />
              <div className="flex justify-end gap-1.5">
                <button 
                  onClick={() => { setEditingCatKey(''); setEditingCatLabel(''); }} 
                  className="px-2 py-1 bg-surface-container text-[10px] rounded hover:bg-surface-container-high text-on-surface-variant"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleUpdateCat} 
                  className="px-2.5 py-1 bg-primary text-[10px] font-bold text-on-primary rounded hover:brightness-110"
                >
                  Guardar
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant space-y-2.5">
              <p className="text-[10px] font-bold uppercase text-on-surface-variant">Nueva Categoría</p>
              <input
                type="text"
                placeholder="CLAVE_UNICA (Ej: LOGISTICA)"
                value={newCatKey}
                onChange={e => setNewCatKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
                className="w-full bg-surface border border-outline rounded px-2.5 py-1.5 text-xs font-mono text-on-surface"
              />
              <input
                type="text"
                placeholder="Nombre a mostrar (Ej: Logística)"
                value={newCatLabel}
                onChange={e => setNewCatLabel(e.target.value)}
                className="w-full bg-surface border border-outline rounded px-2.5 py-1.5 text-xs text-on-surface"
              />
              <button 
                onClick={handleAddCat}
                className="w-full py-1.5 bg-primary/10 border border-primary/20 hover:bg-primary text-primary hover:text-on-primary rounded text-xs font-bold transition-all"
              >
                Agregar Categoría
              </button>
            </div>
          )}
        </div>

        {/* COLUMNA 2: Subcategorías */}
        <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant space-y-4">
          <h4 className="text-xs font-bold text-primary font-mono uppercase tracking-wider">2. Subcategorías</h4>
          
          {selectedCat ? (
            <>
              <p className="text-[11px] text-on-surface-variant">
                En: <strong className="text-on-surface">{expenseStructure[selectedCat]?.label}</strong>
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
                          : 'bg-surface border-outline-variant text-on-surface-variant hover:text-on-surface hover:border-outline'
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

              <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant space-y-2">
                <input
                  type="text"
                  placeholder="Nombre de subcategoría..."
                  value={newSubName}
                  onChange={e => setNewSubName(e.target.value)}
                  className="w-full bg-surface border border-outline rounded px-2.5 py-1.5 text-xs text-on-surface"
                />
                <button 
                  onClick={handleAddSub}
                  className="w-full py-1.5 bg-primary/10 border border-primary/20 hover:bg-primary text-primary hover:text-on-primary rounded text-xs font-bold transition-all"
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
        <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant space-y-4">
          <h4 className="text-xs font-bold text-primary font-mono uppercase tracking-wider">3. Ítems Específicos</h4>
          
          {selectedCat && selectedSub ? (
            <>
              <div className="text-[11px] text-on-surface-variant leading-tight">
                Categoría: <strong className="text-on-surface">{expenseStructure[selectedCat]?.label}</strong>
                <br />
                Subcat: <strong className="text-primary">{selectedSub}</strong>
              </div>
              <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
                {(expenseStructure[selectedCat]?.subcategories[selectedSub] || []).map(item => (
                  <div 
                    key={item} 
                    className="flex items-center justify-between p-2 rounded-lg border border-outline-variant bg-surface text-xs text-on-surface-variant"
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

              <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant space-y-2">
                <input
                  type="text"
                  placeholder="Nombre del ítem (ej: Hilos, Agujas)..."
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                  className="w-full bg-surface border border-outline rounded px-2.5 py-1.5 text-xs text-on-surface"
                />
                <button 
                  onClick={handleAddItem}
                  className="w-full py-1.5 bg-primary/10 border border-primary/20 hover:bg-primary text-primary hover:text-on-primary rounded text-xs font-bold transition-all"
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

function OrdersStructureEditor({
  settings,
  addCategory,
  updateCategory,
  deleteCategory,
  addSubcategory,
  updateSubcategory,
  deleteSubcategory,
  showSavedIndicator,
  savedStatus
}) {
  const [selectedCat, setSelectedCat] = useState('')
  
  // Category Form States
  const [newCatId, setNewCatId] = useState('')
  const [newCatLabel, setNewCatLabel] = useState('')
  const [newCatIcon, setNewCatIcon] = useState('')
  
  const [editingCatId, setEditingCatId] = useState(null)
  const [editingCatLabel, setEditingCatLabel] = useState('')
  const [editingCatIcon, setEditingCatIcon] = useState('')

  // Subcategory Form States
  const [newSubId, setNewSubId] = useState('')
  const [newSubLabel, setNewSubLabel] = useState('')
  const [newSubIcon, setNewSubIcon] = useState('')
  const [newSubDesc, setNewSubDesc] = useState('')
  const [newSubUnit, setNewSubUnit] = useState('unidad')
  const [newSubPrice, setNewSubPrice] = useState(0)

  const [editingSubId, setEditingSubId] = useState(null)
  const [editingSubLabel, setEditingSubLabel] = useState('')
  const [editingSubIcon, setEditingSubIcon] = useState('')
  const [editingSubDesc, setEditingSubDesc] = useState('')
  const [editingSubUnit, setEditingSubUnit] = useState('unidad')
  const [editingSubPrice, setEditingSubPrice] = useState(0)

  // Actions for Categories
  const handleAddCat = () => {
    if (!newCatId.trim() || !newCatLabel.trim() || !newCatIcon.trim()) {
      return alert('Llene todos los campos de la categoría')
    }
    const formattedId = newCatId.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
    if (settings.categories.find(c => c.id === formattedId)) {
      return alert('El ID de categoría ya existe')
    }
    addCategory({ id: formattedId, label: newCatLabel.trim(), icon: newCatIcon.trim() })
    setNewCatId('')
    setNewCatLabel('')
    setNewCatIcon('')
    setSelectedCat(formattedId)
    showSavedIndicator('category_save')
  }

  const handleUpdateCat = (catId) => {
    if (!editingCatLabel.trim() || !editingCatIcon.trim()) {
      return alert('Llene todos los campos')
    }
    updateCategory(catId, { id: catId, label: editingCatLabel.trim(), icon: editingCatIcon.trim() })
    setEditingCatId(null)
    showSavedIndicator('category_save')
  }

  // Actions for Subcategories
  const handleAddSub = () => {
    if (!selectedCat) return alert('Seleccione una categoría primero')
    if (!newSubId.trim() || !newSubLabel.trim() || !newSubIcon.trim()) {
      return alert('Llene los campos obligatorios de la subcategoría')
    }
    const formattedId = newSubId.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
    const existing = settings.subcategories[selectedCat] || []
    if (existing.find(s => s.id === formattedId)) {
      return alert('El ID de subcategoría ya existe')
    }
    addSubcategory(selectedCat, {
      id: formattedId,
      label: newSubLabel.trim(),
      icon: newSubIcon.trim(),
      description: newSubDesc.trim(),
      unit: newSubUnit,
      unitPrice: parseFloat(newSubPrice) || 0
    })
    setNewSubId('')
    setNewSubLabel('')
    setNewSubIcon('')
    setNewSubDesc('')
    setNewSubUnit('unidad')
    setNewSubPrice(0)
    showSavedIndicator('subcategory_save')
  }

  const handleUpdateSub = (subId) => {
    if (!editingSubLabel.trim() || !editingSubIcon.trim()) {
      return alert('Llene los campos obligatorios')
    }
    updateSubcategory(selectedCat, subId, {
      id: subId,
      label: editingSubLabel.trim(),
      icon: editingSubIcon.trim(),
      description: editingSubDesc.trim(),
      unit: editingSubUnit,
      unitPrice: parseFloat(editingSubPrice) || 0
    })
    setEditingSubId(null)
    showSavedIndicator('subcategory_save')
  }

  return (
    <div className="space-y-6 animate-fade-in text-on-surface">
      <div className="flex justify-between items-center pb-3 border-b border-outline-variant">
        <h3 className="text-lg font-bold text-on-surface">Estructura de Categorías de Pedidos</h3>
        {(savedStatus['category_save'] || savedStatus['subcategory_save']) && (
          <span className="text-tertiary text-xs font-bold animate-pulse flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">check_circle</span> Cambios guardados
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* COLUMNA 1: Categorías Principales */}
        <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant space-y-4">
          <h4 className="text-xs font-bold text-primary font-mono uppercase tracking-wider">1. Categorías de Pedidos</h4>
          
          <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
            {settings.categories.map(cat => {
              const isActive = selectedCat === cat.id
              const isEditing = editingCatId === cat.id

              if (isEditing) {
                return (
                  <div key={cat.id} className="p-3 bg-surface-container border border-primary/30 rounded-xl space-y-2" onClick={e => e.stopPropagation()}>
                    <p className="text-[10px] font-bold uppercase text-primary font-mono">Editar Categoría: {cat.id}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Nombre"
                        value={editingCatLabel}
                        onChange={e => setEditingCatLabel(e.target.value)}
                        className="bg-surface border border-outline-variant rounded px-2 py-1 text-xs text-on-surface"
                      />
                      <input
                        type="text"
                        placeholder="Icono"
                        value={editingCatIcon}
                        onChange={e => setEditingCatIcon(e.target.value)}
                        className="bg-surface border border-outline-variant rounded px-2 py-1 text-xs text-on-surface"
                      />
                    </div>
                    <div className="flex justify-end gap-1">
                      <button 
                        onClick={() => setEditingCatId(null)} 
                        className="px-2 py-1 bg-surface-container-high text-[10px] rounded hover:bg-outline-variant text-on-surface-variant"
                      >
                        Cancelar
                      </button>
                      <button 
                        onClick={() => handleUpdateCat(cat.id)} 
                        className="px-2.5 py-1 bg-primary text-[10px] font-bold text-on-primary rounded hover:brightness-110"
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                )
              }

              return (
                <div 
                  key={cat.id} 
                  className={`flex items-center justify-between p-3 rounded-xl border text-sm transition-all cursor-pointer ${
                    isActive 
                      ? 'bg-primary/10 border-primary/40 text-primary' 
                      : 'bg-surface border-outline-variant text-on-surface-variant hover:text-on-surface hover:border-outline'
                  }`}
                  onClick={() => setSelectedCat(cat.id)}
                >
                  <div className="flex items-center gap-3 truncate">
                    <span className="material-symbols-outlined text-primary">{cat.icon}</span>
                    <div className="truncate">
                      <p className="font-bold text-xs">{cat.label}</p>
                      <p className="text-[9px] font-mono opacity-50">{cat.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <button 
                      onClick={() => {
                        setEditingCatId(cat.id)
                        setEditingCatLabel(cat.label)
                        setEditingCatIcon(cat.icon)
                      }}
                      className="p-1 hover:bg-surface-container-high rounded text-on-surface-variant hover:text-on-surface"
                    >
                      <span className="material-symbols-outlined text-[15px]">edit</span>
                    </button>
                    <button 
                      onClick={() => {
                        if (window.confirm(`¿Eliminar la categoría "${cat.label}" y todas sus subcategorías?`)) {
                          deleteCategory(cat.id)
                          if (selectedCat === cat.id) {
                            setSelectedCat('')
                          }
                          showSavedIndicator('category_save')
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

          {/* Formulario Agregar Categoría (Inline al final de la columna) */}
          <div className="bg-surface-container p-3 rounded-xl border border-outline-variant space-y-2">
            <p className="text-[10px] font-bold uppercase text-on-surface-variant font-mono">Nueva Categoría</p>
            <input
              type="text"
              placeholder="id_unico (ej: camisetas)"
              value={newCatId}
              onChange={e => setNewCatId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
              className="w-full bg-surface border border-outline-variant rounded px-2.5 py-1.5 text-xs font-mono text-on-surface"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Nombre (ej: Camisetas)"
                value={newCatLabel}
                onChange={e => setNewCatLabel(e.target.value)}
                className="w-full bg-surface border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface"
              />
              <input
                type="text"
                placeholder="Icono (ej: apparel)"
                value={newCatIcon}
                onChange={e => setNewCatIcon(e.target.value)}
                className="w-full bg-surface border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface"
              />
            </div>
            <button 
              onClick={handleAddCat}
              className="w-full py-1.5 bg-primary/10 border border-primary/20 hover:bg-primary text-primary hover:text-on-primary rounded text-xs font-bold transition-all"
            >
              Agregar Categoría
            </button>
          </div>
        </div>

        {/* COLUMNA 2: Subcategorías */}
        <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant space-y-4">
          <h4 className="text-xs font-bold text-primary font-mono uppercase tracking-wider">2. Subcategorías y Servicios</h4>
          
          {selectedCat ? (
            <>
              <p className="text-[11px] text-on-surface-variant">
                En categoría: <strong className="text-on-surface">{settings.categories.find(c => c.id === selectedCat)?.label}</strong>
              </p>
              
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                {(settings.subcategories[selectedCat] || []).map(sub => {
                  const isEditing = editingSubId === sub.id

                  if (isEditing) {
                    return (
                      <div key={sub.id} className="p-3 bg-surface-container border border-primary/30 rounded-xl space-y-2" onClick={e => e.stopPropagation()}>
                        <p className="text-[10px] font-bold uppercase text-primary font-mono">Editar Subcategoría: {sub.id}</p>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Nombre"
                            value={editingSubLabel}
                            onChange={e => setEditingSubLabel(e.target.value)}
                            className="bg-surface border border-outline-variant rounded px-2 py-1 text-xs text-on-surface"
                          />
                          <input
                            type="text"
                            placeholder="Icono"
                            value={editingSubIcon}
                            onChange={e => setEditingSubIcon(e.target.value)}
                            className="bg-surface border border-outline-variant rounded px-2 py-1 text-xs text-on-surface"
                          />
                        </div>
                        <textarea
                          placeholder="Descripción corta"
                          value={editingSubDesc}
                          onChange={e => setEditingSubDesc(e.target.value)}
                          rows={2}
                          className="w-full bg-surface border border-outline-variant rounded px-2 py-1 text-xs text-on-surface"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={editingSubUnit}
                            onChange={e => setEditingSubUnit(e.target.value)}
                            className="bg-surface border border-outline-variant rounded px-2 py-1 text-xs text-on-surface"
                          >
                            <option value="tallas">Por Tallas (Textil)</option>
                            <option value="unidad">Por Unidad / General</option>
                            <option value="metro">Por Metro (DTF/Sub)</option>
                            <option value="1000_puntadas">Por 1K Puntadas</option>
                          </select>
                          <input
                            type="number"
                            placeholder="Precio (Bs)"
                            value={editingSubPrice}
                            onChange={e => setEditingSubPrice(e.target.value)}
                            className="bg-surface border border-outline-variant rounded px-2 py-1 text-xs text-on-surface font-mono"
                          />
                        </div>
                        <div className="flex justify-end gap-1">
                          <button 
                            onClick={() => setEditingSubId(null)} 
                            className="px-2 py-1 bg-surface-container-high text-[10px] rounded hover:bg-outline-variant text-on-surface-variant"
                          >
                            Cancelar
                          </button>
                          <button 
                            onClick={() => handleUpdateSub(sub.id)} 
                            className="px-2.5 py-1 bg-primary text-[10px] font-bold text-on-primary rounded hover:brightness-110"
                          >
                            Guardar
                          </button>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div 
                      key={sub.id} 
                      className="flex flex-col p-3 bg-surface border border-outline-variant rounded-xl hover:border-primary/20 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 truncate">
                          <span className="material-symbols-outlined text-primary">{sub.icon}</span>
                          <div className="truncate">
                            <p className="font-bold text-xs text-on-surface">{sub.label}</p>
                            <p className="text-[9px] text-on-surface-variant font-mono">
                              {sub.id} | {sub.unit === 'tallas' ? 'Tallas' : sub.unit === 'unidad' ? 'Unidad' : sub.unit === 'metro' ? 'Metro' : sub.unit === '1000_puntadas' ? '1K Puntadas' : sub.unit}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                          {/* Toggle Switch Tallas ON/OFF */}
                          <div className="flex items-center gap-1 mr-2 bg-surface-container-low border border-outline-variant rounded-lg px-2 py-0.5">
                            <span className="text-[8px] text-on-surface-variant/80 font-mono font-bold">TALLAS:</span>
                            <button
                              type="button"
                              onClick={() => {
                                const newUnit = sub.unit === 'tallas' ? 'unidad' : 'tallas';
                                updateSubcategory(selectedCat, sub.id, {
                                  ...sub,
                                  unit: newUnit
                                });
                              }}
                              className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out outline-none ${
                                sub.unit === 'tallas' ? 'bg-[#ff5c00]' : 'bg-slate-300'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  sub.unit === 'tallas' ? 'translate-x-3' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>

                          {sub.unitPrice !== undefined && sub.unit !== 'tallas' && (
                            <span className="text-[10px] text-primary font-mono bg-primary/10 px-1.5 py-0.5 rounded mr-1">
                              Bs {sub.unitPrice}
                            </span>
                          )}

                          <button 
                            onClick={() => {
                              setEditingSubId(sub.id)
                              setEditingSubLabel(sub.label)
                              setEditingSubIcon(sub.icon)
                              setEditingSubDesc(sub.description || '')
                              setEditingSubUnit(sub.unit || 'unidad')
                              setEditingSubPrice(sub.unitPrice || 0)
                            }} 
                            className="p-1 hover:bg-surface-container-high rounded text-on-surface-variant hover:text-primary"
                          >
                            <span className="material-symbols-outlined text-[15px]">edit</span>
                          </button>
                          <button 
                            onClick={() => {
                              if(window.confirm('¿Eliminar subcategoría?')) {
                                deleteSubcategory(selectedCat, sub.id)
                                showSavedIndicator('subcategory_save')
                              }
                            }} 
                            className="p-1 hover:bg-error/10 text-error rounded"
                          >
                            <span className="material-symbols-outlined text-[15px]">delete</span>
                          </button>
                        </div>
                      </div>
                      {sub.description && (
                        <p className="text-[11px] text-on-surface-variant bg-surface-container-low p-1.5 rounded border border-outline-variant/50 leading-relaxed italic">
                          {sub.description}
                        </p>
                      )}
                    </div>
                  )
                })}
                {!(settings.subcategories[selectedCat] || []).length && (
                  <p className="text-xs text-on-surface-variant italic py-4 text-center">No hay subcategorías registradas.</p>
                )}
              </div>

              {/* Formulario Agregar Subcategoría */}
              <div className="bg-surface-container p-3 rounded-xl border border-outline-variant space-y-2">
                <p className="text-[10px] font-bold uppercase text-on-surface-variant font-mono">Nueva Subcategoría</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="id_unico (ej: polo_manga_corta)"
                    value={newSubId}
                    onChange={e => setNewSubId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                    className="w-full bg-surface border border-outline-variant rounded px-2.5 py-1.5 text-xs font-mono text-on-surface"
                  />
                  <input
                    type="text"
                    placeholder="Icono (ej: apparel)"
                    value={newSubIcon}
                    onChange={e => setNewSubIcon(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Nombre a mostrar (ej: Polo Manga Corta)"
                  value={newSubLabel}
                  onChange={e => setNewSubLabel(e.target.value)}
                  className="w-full bg-surface border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface"
                />
                <textarea
                  placeholder="Descripción corta"
                  value={newSubDesc}
                  onChange={e => setNewSubDesc(e.target.value)}
                  rows={1}
                  className="w-full bg-surface border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={newSubUnit}
                    onChange={e => setNewSubUnit(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface"
                  >
                    <option value="tallas">Por Tallas (Textil)</option>
                    <option value="unidad">Por Unidad / General</option>
                    <option value="metro">Por Metro (DTF/Sublimación)</option>
                    <option value="1000_puntadas">Por 1,000 Puntadas (Bordado)</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Precio (Bs)"
                    value={newSubPrice}
                    onChange={e => setNewSubPrice(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface font-mono"
                  />
                </div>
                <button 
                  onClick={handleAddSub}
                  className="w-full py-1.5 bg-primary/10 border border-primary/20 hover:bg-primary text-primary hover:text-on-primary rounded text-xs font-bold transition-all"
                >
                  Agregar Subcategoría
                </button>
              </div>
            </>
          ) : (
            <p className="text-xs text-on-surface-variant italic py-10 text-center">Seleccione una categoría principal.</p>
          )}
        </div>

      </div>
    </div>
  )
}

function BudgetsAndGoalsEditor({ settings, saveBudgetsAndGoals, showSavedIndicator, savedStatus }) {
  const [localBudgets, setLocalBudgets] = useState([])
  const [localSalesGoals, setLocalSalesGoals] = useState([])

  const [newBudgetCatKey, setNewBudgetCatKey] = useState('')
  const [newBudgetLimit, setNewBudgetLimit] = useState('')
  const [newBudgetPeriod, setNewBudgetPeriod] = useState('mensual')

  const [editingBudgetId, setEditingBudgetId] = useState(null)
  const [editBudgetLimit, setEditBudgetLimit] = useState('')
  const [editBudgetPeriod, setEditBudgetPeriod] = useState('mensual')

  const [newGoalCatId, setNewGoalCatId] = useState('global')
  const [newGoalTarget, setNewGoalTarget] = useState('')
  const [newGoalPeriod, setNewGoalPeriod] = useState('diario')

  const [editingGoalId, setEditingGoalId] = useState(null)
  const [editGoalTarget, setEditGoalTarget] = useState('')
  const [editGoalPeriod, setEditGoalPeriod] = useState('diario')

  const expenseStructure = settings.expenseStructure || {}

  useEffect(() => {
    if (settings.budgets) {
      setLocalBudgets(settings.budgets)
    }
    if (settings.salesGoals) {
      setLocalSalesGoals(Array.isArray(settings.salesGoals) ? settings.salesGoals : [])
    }
  }, [settings.budgets, settings.salesGoals])

  const handleAddBudget = () => {
    if (!newBudgetCatKey || !newBudgetLimit) return
    const newBudget = {
      id: Date.now().toString(),
      categoryKey: newBudgetCatKey,
      limitAmount: parseFloat(newBudgetLimit),
      period: newBudgetPeriod
    }
    setLocalBudgets(prev => [...prev, newBudget])
    setNewBudgetCatKey('')
    setNewBudgetLimit('')
    setNewBudgetPeriod('mensual')
  }

  const handleStartEditBudget = (budget) => {
    setEditingBudgetId(budget.id)
    setEditBudgetLimit(budget.limitAmount.toString())
    setEditBudgetPeriod(budget.period)
  }

  const handleSaveEditBudget = (id) => {
    setLocalBudgets(prev => prev.map(b => b.id === id ? { ...b, limitAmount: parseFloat(editBudgetLimit), period: editBudgetPeriod } : b))
    setEditingBudgetId(null)
  }

  const handleDeleteBudget = (id) => {
    setLocalBudgets(prev => prev.filter(b => b.id !== id))
  }

  const handleAddSalesGoal = () => {
    if (!newGoalCatId || !newGoalTarget) return
    const newGoal = {
      id: Date.now().toString(),
      categoryId: newGoalCatId,
      period: newGoalPeriod,
      targetAmount: parseFloat(newGoalTarget)
    }
    setLocalSalesGoals(prev => [...prev, newGoal])
    setNewGoalCatId('global')
    setNewGoalTarget('')
    setNewGoalPeriod('diario')
  }

  const handleStartEditGoal = (goal) => {
    setEditingGoalId(goal.id)
    setEditGoalTarget(goal.targetAmount.toString())
    setEditGoalPeriod(goal.period)
  }

  const handleSaveEditGoal = (id) => {
    setLocalSalesGoals(prev => prev.map(g => g.id === id ? { ...g, targetAmount: parseFloat(editGoalTarget), period: editGoalPeriod } : g))
    setEditingGoalId(null)
  }

  const handleDeleteGoal = (id) => {
    setLocalSalesGoals(prev => prev.filter(g => g.id !== id))
  }

  const handleSaveAll = () => {
    saveBudgetsAndGoals(localBudgets, localSalesGoals)
    showSavedIndicator('budgets_goals_save')
    alert('Cambios guardados y aplicados correctamente.')
  }

  const allSalesCategories = [
    { id: 'global', label: 'Ventas Globales (Todo)' },
    ...(settings.categories || [])
  ]

  return (
    <div className="space-y-8 animate-fade-in text-on-surface">
      {/* Header status */}
      <div className="flex justify-between items-center pb-3 border-b border-outline-variant">
        <h3 className="text-lg font-bold text-on-surface">Metas de Ventas y Presupuestos de Gastos</h3>
        {savedStatus['budgets_goals_save'] && (
          <span className="text-tertiary text-xs font-bold animate-pulse flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">check_circle</span> Cambios guardados
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* === COLUMNA 1: PRESUPUESTOS DE GASTOS === */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-error/10 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-error text-[20px]">account_balance_wallet</span>
            </div>
            <div>
              <h4 className="text-base font-bold text-on-surface">Presupuestos de Gastos</h4>
              <p className="text-xs text-on-surface-variant">Límites de gastos por categoría principal (semanal/mensual).</p>
            </div>
          </div>

          {/* List of budgets */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {localBudgets.map(budget => {
              const catData = expenseStructure[budget.categoryKey]
              const isEditing = editingBudgetId === budget.id

              return (
                <div key={budget.id} className="bg-surface-container-low rounded-xl border border-outline-variant p-3">
                  {isEditing ? (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-on-surface">
                        {catData?.label || budget.categoryKey}
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={editBudgetLimit}
                          onChange={e => setEditBudgetLimit(e.target.value)}
                          className="flex-1 bg-surface border border-outline rounded px-2.5 py-1.5 text-xs text-on-surface"
                          placeholder="Límite Bs"
                        />
                        <select
                          value={editBudgetPeriod}
                          onChange={e => setEditBudgetPeriod(e.target.value)}
                          className="bg-surface border border-outline rounded px-2.5 py-1.5 text-xs text-on-surface"
                        >
                          <option value="mensual">Mensual</option>
                          <option value="semanal">Semanal</option>
                        </select>
                        <button onClick={() => handleSaveEditBudget(budget.id)} className="px-2.5 py-1.5 bg-primary text-on-primary text-xs font-bold rounded hover:brightness-110">Guardar</button>
                        <button onClick={() => setEditingBudgetId(null)} className="px-2.5 py-1.5 bg-surface-container text-xs rounded hover:bg-surface-container-high text-on-surface-variant">Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-[18px] text-primary">pie_chart</span>
                        <div>
                          <p className="text-sm font-medium text-on-surface">{catData?.label || budget.categoryKey}</p>
                          <p className="text-xs text-on-surface-variant">Límite: Bs {budget.limitAmount?.toLocaleString()} / {budget.period}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleStartEditBudget(budget)} className="p-1.5 rounded hover:bg-surface-container-high text-on-surface-variant">
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                        <button onClick={() => handleDeleteBudget(budget.id)} className="p-1.5 rounded hover:bg-error/10 text-error/60 hover:text-error">
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            {localBudgets.length === 0 && (
              <p className="text-xs text-on-surface-variant/50 italic py-4 text-center">No hay presupuestos configurados.</p>
            )}
          </div>

          {/* Add budget form */}
          <div className="bg-surface-container-low rounded-xl border border-primary/20 p-4 space-y-3">
            <p className="text-xs font-bold uppercase text-on-surface-variant tracking-wider">Agregar Presupuesto</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                value={newBudgetCatKey}
                onChange={e => setNewBudgetCatKey(e.target.value)}
                className="w-full bg-surface border border-outline rounded px-2.5 py-2 text-xs text-on-surface"
              >
                <option value="">Seleccionar categoría...</option>
                {Object.entries(expenseStructure).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
              <select
                value={newBudgetPeriod}
                onChange={e => setNewBudgetPeriod(e.target.value)}
                className="w-full bg-surface border border-outline rounded px-2.5 py-2 text-xs text-on-surface"
              >
                <option value="mensual">Mensual</option>
                <option value="semanal">Semanal</option>
              </select>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={newBudgetLimit}
                onChange={e => setNewBudgetLimit(e.target.value)}
                placeholder="Límite (Bs)"
                className="flex-1 bg-surface border border-outline rounded px-2.5 py-2 text-xs text-on-surface"
                min="0"
              />
              <button
                onClick={handleAddBudget}
                disabled={!newBudgetCatKey || !newBudgetLimit}
                className="px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-lg hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                Añadir Presupuesto
              </button>
            </div>
          </div>
        </div>

        {/* === COLUMNA 2: METAS DE VENTAS === */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-500/10 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-emerald-500 text-[20px]">flag</span>
            </div>
            <div>
              <h4 className="text-base font-bold text-on-surface">Metas de Ventas</h4>
              <p className="text-xs text-on-surface-variant">Objetivos de facturación global o por categoría (diario/semanal/mensual).</p>
            </div>
          </div>

          {/* List of goals */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {localSalesGoals.map(goal => {
              const catData = allSalesCategories.find(c => c.id === goal.categoryId)
              const isEditing = editingGoalId === goal.id

              return (
                <div key={goal.id} className="bg-surface-container-low rounded-xl border border-outline-variant p-3">
                  {isEditing ? (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-on-surface">
                        {catData?.label || goal.categoryId}
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={editGoalTarget}
                          onChange={e => setEditGoalTarget(e.target.value)}
                          className="flex-1 bg-surface border border-outline rounded px-2.5 py-1.5 text-xs text-on-surface"
                          placeholder="Meta Bs"
                        />
                        <select
                          value={editGoalPeriod}
                          onChange={e => setEditGoalPeriod(e.target.value)}
                          className="bg-surface border border-outline rounded px-2.5 py-1.5 text-xs text-on-surface"
                        >
                          <option value="diario">Diario</option>
                          <option value="semanal">Semanal</option>
                          <option value="mensual">Mensual</option>
                        </select>
                        <button onClick={() => handleSaveEditGoal(goal.id)} className="px-2.5 py-1.5 bg-primary text-on-primary text-xs font-bold rounded hover:brightness-110">Guardar</button>
                        <button onClick={() => setEditingGoalId(null)} className="px-2.5 py-1.5 bg-surface-container text-xs rounded hover:bg-surface-container-high text-on-surface-variant">Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-[18px] text-emerald-500">trending_up</span>
                        <div>
                          <p className="text-sm font-medium text-on-surface">{catData?.label || goal.categoryId}</p>
                          <p className="text-xs text-on-surface-variant">Objetivo: Bs {goal.targetAmount?.toLocaleString()} / {goal.period}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleStartEditGoal(goal)} className="p-1.5 rounded hover:bg-surface-container-high text-on-surface-variant">
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                        <button onClick={() => handleDeleteGoal(goal.id)} className="p-1.5 rounded hover:bg-error/10 text-error/60 hover:text-error">
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            {localSalesGoals.length === 0 && (
              <p className="text-xs text-on-surface-variant/50 italic py-4 text-center">No hay metas de ventas configuradas.</p>
            )}
          </div>

          {/* Add goal form */}
          <div className="bg-surface-container-low rounded-xl border border-primary/20 p-4 space-y-3">
            <p className="text-xs font-bold uppercase text-on-surface-variant tracking-wider">Agregar Meta de Ventas</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                value={newGoalCatId}
                onChange={e => setNewGoalCatId(e.target.value)}
                className="w-full bg-surface border border-outline rounded px-2.5 py-2 text-xs text-on-surface"
              >
                {allSalesCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
              <select
                value={newGoalPeriod}
                onChange={e => setNewGoalPeriod(e.target.value)}
                className="w-full bg-surface border border-outline rounded px-2.5 py-2 text-xs text-on-surface"
              >
                <option value="diario">Diario</option>
                <option value="semanal">Semanal</option>
                <option value="mensual">Mensual</option>
              </select>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={newGoalTarget}
                onChange={e => setNewGoalTarget(e.target.value)}
                placeholder="Meta (Bs)"
                className="flex-1 bg-surface border border-outline rounded px-2.5 py-2 text-xs text-on-surface"
                min="0"
              />
              <button
                onClick={handleAddSalesGoal}
                disabled={!newGoalCatId || !newGoalTarget}
                className="px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-lg hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                Añadir Meta
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="pt-6 border-t border-outline-variant flex justify-end">
        <Button
          onClick={handleSaveAll}
          className="px-6 py-2.5 bg-primary text-on-primary font-bold shadow-md hover:brightness-110 flex items-center gap-2"
        >
          <span className="material-symbols-outlined">save</span>
          Guardar y Aplicar Cambios
        </Button>
      </div>
    </div>
  )
}

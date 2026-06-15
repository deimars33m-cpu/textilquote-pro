import { useState } from 'react'
import { useCategories } from '@/context/CategoryContext'
import { Modal, Input, Button, ConfirmDialog } from '@/components/ui/index.jsx'

export default function MaterialCategoriesModal({ isOpen, onClose, materials = [] }) {
  const { categories, addCategory, updateCategory, deleteCategory, isUsingLocalStorage } = useCategories()
  const [newCatName, setNewCatName] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  // Para eliminación
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteCount, setDeleteCount] = useState(0)

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newCatName.trim()) return
    setError(null)
    setSaving(true)
    try {
      await addCategory(newCatName.trim())
      setNewCatName('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (cat) => {
    setEditingId(cat.id)
    setEditingName(cat.name)
    setError(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingName('')
    setError(null)
  }

  const handleUpdate = async (id) => {
    if (!editingName.trim()) return
    setError(null)
    setSaving(true)
    try {
      await updateCategory(id, editingName.trim())
      setEditingId(null)
      setEditingName('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const initiateDelete = (cat) => {
    // Contar cuántos materiales están usando esta categoría
    const count = materials.filter(m => m.category === cat.code).length
    setDeleteCount(count)
    setDeleteTarget(cat)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setError(null)
    try {
      await deleteCategory(deleteTarget.id)
      setDeleteTarget(null)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Gestionar Categorías" size="md">
        <div className="space-y-6">
          {isUsingLocalStorage && (
            <div className="p-3 bg-warning-container/20 border border-warning text-warning-container text-xs rounded-lg flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">info</span>
              <span>Modo desconectado: Los cambios se guardarán localmente en este navegador.</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-error-container/10 border border-error text-error text-sm rounded-lg flex justify-between items-center">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="material-symbols-outlined text-sm">close</button>
            </div>
          )}

          {/* Formulario para agregar */}
          <form onSubmit={handleAdd} className="flex gap-2 items-end">
            <div className="flex-1">
              <Input
                label="Nueva Categoría"
                placeholder="Ej: Botones, Hilos Elásticos..."
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                disabled={saving}
              />
            </div>
            <Button type="submit" disabled={saving || !newCatName.trim()} className="h-[38px] flex items-center justify-center">
              {saving ? (
                <div className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-[18px]">add</span>
              )}
            </Button>
          </form>

          {/* Lista de categorías */}
          <div className="border border-outline-variant/30 rounded-xl overflow-hidden bg-surface-container-lowest">
            <div className="max-h-[350px] overflow-y-auto divide-y divide-outline-variant/20">
              {categories.length === 0 ? (
                <p className="p-4 text-center text-sm text-on-surface-variant">No hay categorías registradas.</p>
              ) : (
                categories.map((cat) => (
                  <div key={cat.id} className="p-3 flex items-center justify-between gap-4 group transition-colors hover:bg-surface-container-high/30">
                    {editingId === cat.id ? (
                      <div className="flex-1 flex gap-2 items-center">
                        <input
                          type="text"
                          className="flex-1 px-2.5 py-1.5 bg-surface-container-high border border-primary rounded text-sm text-on-surface outline-none"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          autoFocus
                        />
                        <button
                          onClick={() => handleUpdate(cat.id)}
                          disabled={saving || !editingName.trim()}
                          className="p-1.5 rounded-lg bg-primary text-on-primary hover:brightness-110 flex items-center justify-center transition-all disabled:opacity-50"
                          title="Guardar"
                        >
                          <span className="material-symbols-outlined text-[16px]">done</span>
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="p-1.5 rounded-lg border border-outline-variant hover:bg-surface-container-high text-on-surface-variant transition-colors flex items-center justify-center"
                          title="Cancelar"
                        >
                          <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-on-surface">{cat.name}</span>
                          <span className="text-xs text-on-surface-variant font-mono">{cat.code}</span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => startEdit(cat)}
                            className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors"
                            title="Editar"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                          </button>
                          {/* No permitir borrar 'otro' de forma simple o avisar */}
                          <button
                            onClick={() => initiateDelete(cat)}
                            className="p-1.5 rounded-lg hover:bg-error-container/20 text-on-surface-variant hover:text-error transition-colors"
                            title="Eliminar"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-outline-variant/30">
            <Button variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirmar Eliminación */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar Categoría"
        message={
          deleteCount > 0
            ? `¿Estás seguro de que deseas eliminar la categoría "${deleteTarget?.name}"? Hay ${deleteCount} material(es) que la utilizan actualmente. Nota: Al eliminarla, deberás reasignar los materiales manualmente ya que su categoría quedará huérfana.`
            : `¿Estás seguro de que deseas eliminar la categoría "${deleteTarget?.name}"?`
        }
      />
    </>
  )
}

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

const CategoryContext = createContext(null)

const DEFAULT_MATERIAL_CATEGORIES = [
  { code: 'tela', name: 'Tela' },
  { code: 'hilo', name: 'Hilo' },
  { code: 'cierre', name: 'Cierre' },
  { code: 'tinta', name: 'Tinta' },
  { code: 'papel_sublimatico', name: 'Papel Sublimático' },
  { code: 'etiqueta', name: 'Etiqueta' },
  { code: 'bolsa', name: 'Bolsa' },
  { code: 'avio', name: 'Avío' },
  { code: 'servicio_externo', name: 'Servicio Externo' },
  { code: 'tintas_sublimacion', name: 'Tintas de Sublimación' },
  { code: 'vinil', name: 'Vinil' },
  { code: 'materiales_acolchado', name: 'Materiales de Acolchado' },
  { code: 'forros', name: 'Forros' },
  { code: 'otro', name: 'Otro' }
]

const DEFAULT_PRODUCT_CATEGORIES = [
  { code: 'ropa_deportiva', name: 'Ropa Deportiva' },
  { code: 'ropa_institucional', name: 'Ropa Institucional o Corporativa' },
  { code: 'mochilas_bolsos', name: 'Mochilas, Maletines y Bolsos' },
  { code: 'ropa_escolar', name: 'Ropa Escolar' },
  { code: 'otro', name: 'Otro' }
]

export function CategoryProvider({ children }) {
  const { user } = useAuth()
  
  // Categorías de Materiales
  const [materialCategories, setMaterialCategories] = useState([])
  const [loadingMaterials, setLoadingMaterials] = useState(true)
  const [isUsingLSForMaterials, setIsUsingLSForMaterials] = useState(false)

  // Categorías de Productos
  const [productCategories, setProductCategories] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [isUsingLSForProducts, setIsUsingLSForProducts] = useState(false)

  const [error, setError] = useState(null)

  // ── FETCH CATEGORÍAS DE MATERIALES ──
  const fetchMaterialCategories = useCallback(async () => {
    if (!user) {
      setMaterialCategories([])
      setLoadingMaterials(false)
      return
    }
    setLoadingMaterials(true)
    try {
      const { data, error: fetchError } = await supabase
        .from('material_categories')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true })

      if (fetchError) {
        if (fetchError.code === 'PGRST205' || fetchError.message?.includes('Could not find')) {
          console.warn("Tabla 'material_categories' no encontrada. Usando LocalStorage de respaldo.")
          setIsUsingLSForMaterials(true)
          loadMaterialsLS()
          return
        }
        throw fetchError
      }

      if (!data || data.length === 0) {
        console.log("Sembrando categorías de materiales por defecto...")
        const seeds = DEFAULT_MATERIAL_CATEGORIES.map(cat => ({ ...cat, user_id: user.id }))
        const { data: inserted, error: seedError } = await supabase
          .from('material_categories')
          .insert(seeds)
          .select()

        if (seedError) throw seedError
        setMaterialCategories(inserted || [])
      } else {
        setMaterialCategories(data)
      }
      setIsUsingLSForMaterials(false)
    } catch (err) {
      console.error('Error fetching material categories:', err)
      setError(err.message)
      setIsUsingLSForMaterials(true)
      loadMaterialsLS()
    } finally {
      setLoadingMaterials(false)
    }
  }, [user])

  const loadMaterialsLS = () => {
    const key = `textilquote_mat_categories_${user?.id || 'guest'}`
    const stored = localStorage.getItem(key)
    if (stored) {
      try {
        setMaterialCategories(JSON.parse(stored))
      } catch (e) {
        setMaterialCategories(DEFAULT_MATERIAL_CATEGORIES)
      }
    } else {
      localStorage.setItem(key, JSON.stringify(DEFAULT_MATERIAL_CATEGORIES))
      setMaterialCategories(DEFAULT_MATERIAL_CATEGORIES)
    }
  }

  const saveMaterialsLS = (newCats) => {
    const key = `textilquote_mat_categories_${user?.id || 'guest'}`
    localStorage.setItem(key, JSON.stringify(newCats))
    setMaterialCategories(newCats)
  }

  // ── FETCH CATEGORÍAS DE PRODUCTOS ──
  const fetchProductCategories = useCallback(async () => {
    if (!user) {
      setProductCategories([])
      setLoadingProducts(false)
      return
    }
    setLoadingProducts(true)
    try {
      const { data, error: fetchError } = await supabase
        .from('product_categories')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true })

      if (fetchError) {
        if (fetchError.code === 'PGRST205' || fetchError.message?.includes('Could not find')) {
          console.warn("Tabla 'product_categories' no encontrada. Usando LocalStorage de respaldo.")
          setIsUsingLSForProducts(true)
          loadProductsLS()
          return
        }
        throw fetchError
      }

      if (!data || data.length === 0) {
        console.log("Sembrando categorías de productos por defecto...")
        const seeds = DEFAULT_PRODUCT_CATEGORIES.map(cat => ({ ...cat, user_id: user.id }))
        const { data: inserted, error: seedError } = await supabase
          .from('product_categories')
          .insert(seeds)
          .select()

        if (seedError) throw seedError
        setProductCategories(inserted || [])
      } else {
        setProductCategories(data)
      }
      setIsUsingLSForProducts(false)
    } catch (err) {
      console.error('Error fetching product categories:', err)
      setError(err.message)
      setIsUsingLSForProducts(true)
      loadProductsLS()
    } finally {
      setLoadingProducts(false)
    }
  }, [user])

  const loadProductsLS = () => {
    const key = `textilquote_prod_categories_${user?.id || 'guest'}`
    const stored = localStorage.getItem(key)
    if (stored) {
      try {
        setProductCategories(JSON.parse(stored))
      } catch (e) {
        setProductCategories(DEFAULT_PRODUCT_CATEGORIES)
      }
    } else {
      localStorage.setItem(key, JSON.stringify(DEFAULT_PRODUCT_CATEGORIES))
      setProductCategories(DEFAULT_PRODUCT_CATEGORIES)
    }
  }

  const saveProductsLS = (newCats) => {
    const key = `textilquote_prod_categories_${user?.id || 'guest'}`
    localStorage.setItem(key, JSON.stringify(newCats))
    setProductCategories(newCats)
  }

  useEffect(() => {
    fetchMaterialCategories()
    fetchProductCategories()
  }, [fetchMaterialCategories, fetchProductCategories])

  // Normalizar nombres a códigos slug
  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
  }

  // ── CRUD MATERIAL CATEGORIES ──
  const addMaterialCategory = async (name) => {
    if (!user) throw new Error('Usuario no autenticado')
    const code = generateSlug(name)
    
    if (materialCategories.some(cat => cat.code === code || cat.name.toLowerCase() === name.toLowerCase())) {
      throw new Error('Ya existe una categoría de material con ese nombre')
    }

    if (isUsingLSForMaterials) {
      const newCat = { id: crypto.randomUUID(), name, code, user_id: user.id }
      const newCats = [...materialCategories, newCat].sort((a, b) => a.name.localeCompare(b.name))
      saveMaterialsLS(newCats)
      return newCat
    } else {
      const { data, error: insertError } = await supabase
        .from('material_categories')
        .insert({ name, code, user_id: user.id })
        .select()
        .single()

      if (insertError) throw insertError
      setMaterialCategories(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      return data
    }
  }

  const updateMaterialCategory = async (id, name) => {
    if (!user) throw new Error('Usuario no autenticado')
    const target = materialCategories.find(c => c.id === id)
    if (!target) throw new Error('Categoría no encontrada')
    if (target.name.toLowerCase() === name.toLowerCase()) return target

    if (materialCategories.some(cat => cat.id !== id && cat.name.toLowerCase() === name.toLowerCase())) {
      throw new Error('Ya existe una categoría con ese nombre')
    }

    if (isUsingLSForMaterials) {
      const newCats = materialCategories.map(cat => cat.id === id ? { ...cat, name } : cat)
        .sort((a, b) => a.name.localeCompare(b.name))
      saveMaterialsLS(newCats)
      return { ...target, name }
    } else {
      const { data, error: updateError } = await supabase
        .from('material_categories')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (updateError) throw updateError
      setMaterialCategories(prev => prev.map(item => item.id === id ? data : item).sort((a, b) => a.name.localeCompare(b.name)))
      return data
    }
  }

  const deleteMaterialCategory = async (id) => {
    if (!user) throw new Error('Usuario no autenticado')
    const target = materialCategories.find(c => c.id === id)
    if (!target) throw new Error('Categoría no encontrada')

    if (isUsingLSForMaterials) {
      const newCats = materialCategories.filter(cat => cat.id !== id)
      saveMaterialsLS(newCats)
    } else {
      const { error: deleteError } = await supabase
        .from('material_categories')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError
      setMaterialCategories(prev => prev.filter(item => item.id !== id))
    }
    return target
  }

  // ── CRUD PRODUCT CATEGORIES ──
  const addProductCategory = async (name) => {
    if (!user) throw new Error('Usuario no autenticado')
    const code = generateSlug(name)
    
    if (productCategories.some(cat => cat.code === code || cat.name.toLowerCase() === name.toLowerCase())) {
      throw new Error('Ya existe una categoría de producto con ese nombre')
    }

    if (isUsingLSForProducts) {
      const newCat = { id: crypto.randomUUID(), name, code, user_id: user.id }
      const newCats = [...productCategories, newCat].sort((a, b) => a.name.localeCompare(b.name))
      saveProductsLS(newCats)
      return newCat
    } else {
      const { data, error: insertError } = await supabase
        .from('product_categories')
        .insert({ name, code, user_id: user.id })
        .select()
        .single()

      if (insertError) throw insertError
      setProductCategories(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      return data
    }
  }

  const updateProductCategory = async (id, name) => {
    if (!user) throw new Error('Usuario no autenticado')
    const target = productCategories.find(c => c.id === id)
    if (!target) throw new Error('Categoría no encontrada')
    if (target.name.toLowerCase() === name.toLowerCase()) return target

    if (productCategories.some(cat => cat.id !== id && cat.name.toLowerCase() === name.toLowerCase())) {
      throw new Error('Ya existe una categoría con ese nombre')
    }

    if (isUsingLSForProducts) {
      const newCats = productCategories.map(cat => cat.id === id ? { ...cat, name } : cat)
        .sort((a, b) => a.name.localeCompare(b.name))
      saveProductsLS(newCats)
      return { ...target, name }
    } else {
      const { data, error: updateError } = await supabase
        .from('product_categories')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (updateError) throw updateError
      setProductCategories(prev => prev.map(item => item.id === id ? data : item).sort((a, b) => a.name.localeCompare(b.name)))
      return data
    }
  }

  const deleteProductCategory = async (id) => {
    if (!user) throw new Error('Usuario no autenticado')
    const target = productCategories.find(c => c.id === id)
    if (!target) throw new Error('Categoría no encontrada')

    if (isUsingLSForProducts) {
      const newCats = productCategories.filter(cat => cat.id !== id)
      saveProductsLS(newCats)
    } else {
      const { error: deleteError } = await supabase
        .from('product_categories')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError
      setProductCategories(prev => prev.filter(item => item.id !== id))
    }
    return target
  }

  // Mapas rápidos de mapeo code -> label
  const categoryMap = materialCategories.reduce((acc, cat) => {
    acc[cat.code] = cat.name
    return acc
  }, {})

  const productCategoryMap = productCategories.reduce((acc, cat) => {
    acc[cat.code] = cat.name
    return acc
  }, {})

  return (
    <CategoryContext.Provider value={{
      categories: materialCategories,     // Compatible con MaterialsPage (categorías de materiales)
      categoryMap: categoryMap,           // Compatible con MaterialsPage (categorías de materiales)
      materialCategories,
      categoryMap,
      productCategories,
      productCategoryMap,
      loading: loadingMaterials || loadingProducts,
      error,
      isUsingLocalStorage: isUsingLSForMaterials || isUsingLSForProducts,
      
      // Funciones Materiales
      addCategory: addMaterialCategory,
      updateCategory: updateMaterialCategory,
      deleteCategory: deleteMaterialCategory,
      
      // Funciones Productos
      addProductCategory,
      updateProductCategory,
      deleteProductCategory,
      
      refresh: () => {
        fetchMaterialCategories()
        fetchProductCategories()
      }
    }}>
      {children}
    </CategoryContext.Provider>
  )
}

export function useCategories() {
  const context = useContext(CategoryContext)
  if (!context) {
    throw new Error('useCategories debe usarse dentro de un CategoryProvider')
  }
  return context
}

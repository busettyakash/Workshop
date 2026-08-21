import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import Sidebar from '../../components/layout/Sidebar'
import Topbar from '../../components/layout/Topbar'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import { setActiveNav, selectSidebarOpen, addToast } from '../../redux/slices/uiSlice'
import { ArrowLeft, Loader2, Plus, Trash2, Search, UserPlus, AlertCircle, X, ChevronDown, PackagePlus, ArrowRight, Check } from 'lucide-react'
import api from '../../api/client'
import { getBulkUnitDetails, ALL_UOM_OPTIONS, formatStockDisplay, formatStockDisplayFromBase } from '../../utils/unitHelpers'
import { getRandomCode, getRandomInt } from '../../utils/cryptoUtils'
import '../Dashboard/Dashboard.css'

const S = {
  input: {
    width: '100%', boxSizing: 'border-box', height: '40px', padding: '0 12px',
    border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem',
    color: '#111827', background: '#fff', outline: 'none', fontFamily: 'inherit',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  inputFocus: { borderColor: '#3d68f5', boxShadow: '0 0 0 3px rgba(61,104,245,0.1)' },
  inputError: { borderColor: '#dc2626', boxShadow: '0 0 0 3px rgba(220,38,38,0.08)' },
  label: { display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '6px' },
  error: { color: '#dc2626', fontSize: '0.75rem', marginTop: '4px', display: 'block' },
}

const INR = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount)

function QuickAddPersonModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', phone: '', persona: 'customer' })
  const [saving, setSaving] = useState(false)
  const dispatch = useAppDispatch()
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const res = await api.post('/people', form)
      dispatch(addToast({ message: 'Person added', type: 'success' }))
      onSaved(res.data)
      onClose()
    } catch {
      dispatch(addToast({ message: 'Failed to add person', type: 'error' }))
    } finally {
      setSaving(false)
    }
  }
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: 400, padding: 24, boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '1.125rem', fontWeight: 600 }}>Quick Add Person</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>Name *</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={S.input} autoFocus />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>Phone</label>
            <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={S.input} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, height: 36, background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving || !form.name.trim()} className="btn-blue" style={{ flex: 1, height: 36, justifyContent: 'center', background: saving || !form.name.trim() ? '#9ca3af' : undefined, cursor: saving || !form.name.trim() ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Save Person'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function QuickAddProductModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', sku: '', category: '', price: '', stock: 0, unit: 'pcs', description: '', bag_weight: 100 })
  const [saving, setSaving] = useState(false)
  const [uomOptions, setUomOptions] = useState([])
  const dispatch = useAppDispatch()

  useEffect(() => {
    api.get('/uoms').then(res => {
      if (Array.isArray(res.data) && res.data.length > 0) {
        const activeUnits = res.data.filter(u => u.status !== 'Inactive')
        const opts = activeUnits.map(u => ({ value: u.code, label: `${u.name} (${u.code})`, category: u.category }))
        setUomOptions(opts)
        if (opts.length > 0) {
          setForm(prev => ({
            ...prev,
            unit: opts.some(o => o.value === prev.unit) ? prev.unit : opts[0].value
          }))
        }
      }
    }).catch(() => { })
  }, [])

  const generateSKU = () => {
    const rand = getRandomCode(8)
    setForm(prev => ({ ...prev, sku: `SKU-${rand}` }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.price) return
    setSaving(true)
    try {
      const res = await api.post('/products', form)
      dispatch(addToast({ message: 'Product added', type: 'success' }))
      onSaved(res.data)
      onClose()
    } catch {
      dispatch(addToast({ message: 'Failed to add product', type: 'error' }))
    } finally {
      setSaving(false)
    }
  }

  const bulkUnit = getBulkUnitDetails(form.unit)

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: 480, padding: 24, boxShadow: '0 10px 25px rgba(0,0,0,0.1)', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '1.125rem', fontWeight: 600 }}>Quick Add Product</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={S.label}>Product Name *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={S.input} autoFocus />
            </div>
            <div>
              <label style={S.label}>HSN Code</label>
              <input
                value={form.hsn_code || form.sku || ''}
                onChange={e => setForm({ ...form, hsn_code: e.target.value, sku: e.target.value })}
                style={{ ...S.input, fontFamily: 'monospace', color: '#1e293b', fontWeight: 600 }}
                placeholder="HSN Code / SKU"
              />
            </div>
            <div>
              <label style={S.label}>Category</label>
              <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={S.input} placeholder="Category" />
            </div>
            <div>
              <label style={S.label}>Unit of Measure</label>
              <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} style={S.input}>
                {uomOptions.length === 0 ? (
                  <option value="">-- No UOM found (Create in Settings) --</option>
                ) : (
                  uomOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)
                )}
              </select>
            </div>
            {bulkUnit ? (
              <div>
                <label style={S.label}>100{bulkUnit.short} Benchmark Rate (₹)</label>
                <input
                  type="number"
                  step="any"
                  value={form.price_100 ?? ''}
                  onChange={e => {
                    const val = e.target.value
                    const bw = parseFloat(form.bag_weight || 100)
                    const packPrice = val ? ((parseFloat(val) / 100) * bw).toFixed(2) : ''
                    setForm(prev => ({ ...prev, price_100: val, price: packPrice }))
                  }}
                  placeholder={`Rate for 100${bulkUnit.short}`}
                  style={S.input}
                />
              </div>
            ) : (
              <div>
                <label style={S.label}>Price (₹) *</label>
                <input type="number" step="any" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} style={S.input} />
              </div>
            )}
            {bulkUnit && (
              <div style={{ gridColumn: 'span 2' }}>
                <label style={S.label}>Package / Bag Weight ({bulkUnit.short})</label>
                <input
                  type="number"
                  step="any"
                  value={form.bag_weight}
                  onChange={e => {
                    const bw = parseFloat(e.target.value || 1)
                    const p100 = parseFloat(form.price_100 || (form.price ? ((parseFloat(form.price) / parseFloat(form.bag_weight || 100)) * 100).toFixed(2) : 0))
                    const packPrice = p100 ? ((p100 / 100) * bw).toFixed(2) : form.price
                    setForm(prev => ({ ...prev, bag_weight: e.target.value, price: packPrice }))
                  }}
                  placeholder="Package / Bag Weight"
                  style={S.input}
                />
                {bulkUnit.quickSizes && (
                  <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
                    {bulkUnit.quickSizes.map(size => {
                      const isSelected = Number(form.bag_weight) === size
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => {
                            const p100 = parseFloat(form.price_100 || (form.price ? ((parseFloat(form.price) / parseFloat(form.bag_weight || 100)) * 100).toFixed(2) : 0))
                            const calculatedPrice = p100 ? ((p100 / 100) * size).toFixed(2) : form.price
                            setForm(prev => ({ ...prev, bag_weight: size, price: calculatedPrice }))
                          }}
                          style={{
                            padding: '2px 7px',
                            borderRadius: 5,
                            border: isSelected ? '1px solid #3d68f5' : '1px solid #e5e7eb',
                            background: isSelected ? '#eff6ff' : '#f9fafb',
                            color: isSelected ? '#3d68f5' : '#4b5563',
                            fontSize: '0.72rem',
                            fontWeight: isSelected ? 600 : 500,
                            cursor: 'pointer',
                            transition: 'all 0.12s'
                          }}
                        >
                          {size}{bulkUnit.short}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
            {bulkUnit && (
              <div>
                <label style={S.label}>Calculated Pack Price (₹)</label>
                <input
                  type="text"
                  readOnly
                  value={
                    (() => {
                      const p100 = parseFloat(form.price_100 || (form.price ? ((parseFloat(form.price) / parseFloat(form.bag_weight || 100)) * 100).toFixed(2) : 0))
                      const bw = parseFloat(form.bag_weight || 100)
                      return p100 > 0 ? `₹${((p100 / 100) * bw).toFixed(2)}` : '₹0.00'
                    })()
                  }
                  style={{ ...S.input, background: '#f8fafc', color: '#10b981', fontWeight: 700 }}
                />
              </div>
            )}
            <div>
              <label style={S.label}>
                {bulkUnit && parseFloat(form.bag_weight) > 1
                  ? `Stock Quantity (${bulkUnit.pluralName})`
                  : `Stock Quantity (${bulkUnit?.short || form.unit || 'pcs'})`}
              </label>
              <input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} style={S.input} />
            </div>
          </div>
          {bulkUnit && (form.price_100 || form.price) && form.bag_weight && (
            <div style={{ marginTop: 12, fontSize: '0.8125rem', color: '#10b981', fontWeight: 600 }}>
              Calculated Unit Rate: ₹{(parseFloat(form.price_100 || (form.price ? ((parseFloat(form.price) / parseFloat(form.bag_weight || 100)) * 100) : 0)) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {bulkUnit.short}
              • {form.bag_weight}{bulkUnit.short} {bulkUnit.name} Price: ₹{(((parseFloat(form.price_100 || (form.price ? ((parseFloat(form.price) / parseFloat(form.bag_weight || 100)) * 100) : 0)) / 100) * parseFloat(form.bag_weight))).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          )}
        </form>

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, height: 36, background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
          <button type="submit" disabled={saving || !form.name.trim() || !form.price} className="btn-blue" style={{ flex: 1, height: 36, justifyContent: 'center', background: saving || !form.name.trim() || !form.price ? '#9ca3af' : undefined, cursor: saving || !form.name.trim() || !form.price ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Save Product'}</button>
        </div>
      </div>
    </div>
  )
}

export default function BillForm() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const createdPersonId = searchParams.get('createdPersonId')
  const initialProductId = searchParams.get('productId')
  const sidebarOpen = useAppSelector(selectSidebarOpen)

  const [step, setStep] = useState(1) // 1: Cart & Products, 2: Checkout Details & Summary

  const [form, setForm] = useState({
    bill_number: `INV-${getRandomInt(10000, 100000)}`,
    customer_id: createdPersonId || '',
    status: 'unpaid',
    due_date: '',
    discount: 0,
    tax_rate: 0,
    notes: ''
  })
  const [lineItems, setLineItems] = useState([])

  const [customers, setCustomers] = useState([])
  const [loadingCusts, setLoadingCusts] = useState(true)
  const [showCustDropdown, setShowCustDropdown] = useState(false)
  const [custSearch, setCustSearch] = useState('')
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [showQuickAddProduct, setShowQuickAddProduct] = useState(false)

  const [products, setProducts] = useState([])
  const [loadingProds, setLoadingProds] = useState(true)
  const [productSearch, setProductSearch] = useState('')

  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [focus, setFocus] = useState(null)

  const custSearchInputRef = useRef(null)
  const custDropdownRef = useRef(null)

  useEffect(() => {
    if (showCustDropdown) {
      custSearchInputRef.current?.focus({ preventScroll: true })
    }
  }, [showCustDropdown])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (custDropdownRef.current && !custDropdownRef.current.contains(e.target)) {
        setShowCustDropdown(false)
        setCustSearch('')
      }
    }
    if (showCustDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showCustDropdown])

  useEffect(() => {
    dispatch(setActiveNav('Billing'))
    fetchData()
  }, [dispatch])

  const fetchData = async () => {
    try {
      const [resCust, resProd] = await Promise.all([
        api.get('/people?limit=100'),
        api.get('/products?status=active&limit=100')
      ])
      const custs = resCust.data?.data || []
      const prods = resProd.data?.data || []
      setCustomers(custs)
      setProducts(prods)

      if (createdPersonId) {
        const found = custs.find(c => String(c.id) === String(createdPersonId))
        if (found) {
          setForm(prev => ({ ...prev, customer_id: found.id }))
        }
      }

      if (initialProductId && prods.length > 0) {
        const foundProd = prods.find(p => String(p.id) === String(initialProductId))
        if (foundProd) {
          const prices = calcProductPrices(foundProd)
          const priceToUse = prices.perKgRate > 0 ? prices.perKgRate : (foundProd.price || 0)
          setLineItems([{
            product_id: foundProd.id,
            name: foundProd.name,
            product_name: foundProd.name,
            productName: foundProd.name,
            hsn_code: foundProd.hsn_code || foundProd.sku || '10064000',
            hsn: foundProd.hsn_code || foundProd.sku || '10064000',
            price: priceToUse,
            qty: 1,
            discount: 0,
            unit: foundProd.unit || 'pcs'
          }])
        }
      }

      const defaultDate = new Date()
      defaultDate.setDate(defaultDate.getDate() + 7)
      setForm(prev => ({ ...prev, due_date: defaultDate.toISOString().split('T')[0] }))
    } catch {
      dispatch(addToast({ message: 'Failed to load data', type: 'error' }))
    } finally {
      setLoadingCusts(false)
      setLoadingProds(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
  }

  function calcProductPrices(prod) {
    if (!prod) return { perUnitRate: 0, perKgRate: 0, perPackPrice: 0 }

    const bw = parseFloat(prod?.bag_weight) || 1
    const rawP = parseFloat(prod?.price || 0)
    const rawUP = parseFloat(prod?.updated_price || 0)

    // updated_price and price are both stored as 1-bag price (per bag_weight kg)
    // So to get per-kg rate: divide by bag_weight
    let perKgRate = 0
    if (rawUP > 0) {
      perKgRate = rawUP / bw
    } else if (rawP > 0) {
      perKgRate = rawP / bw
    }

    const perPackPrice = perKgRate * bw
    const perUnitRate = perKgRate

    return {
      perUnitRate: parseFloat(perUnitRate.toFixed(2)),
      perKgRate: parseFloat(perKgRate.toFixed(2)),
      perPackPrice: parseFloat(perPackPrice.toFixed(2))
    }
  }

  const addLineItem = (prod) => {
    const prices = calcProductPrices(prod)
    const priceToUse = prices.perUnitRate > 0 ? prices.perUnitRate : (prod.price || 0)
    const bulkUnit = getBulkUnitDetails(prod.unit)
    const baseUnitStr = bulkUnit?.short || prod.unit || 'pcs'
    setLineItems(prev => [...prev, {
      product_id: prod.id,
      name: prod.name,
      product_name: prod.name,
      productName: prod.name,
      hsn_code: prod.hsn_code || prod.sku || '10064000',
      hsn: prod.hsn_code || prod.sku || '10064000',
      price: priceToUse,
      qty: 1,
      discount: 0,
      unit: baseUnitStr
    }])
    if (errors.items) setErrors(prev => ({ ...prev, items: '' }))
  }

  const removeLineItem = (index) => {
    setLineItems(prev => prev.filter((_, i) => i !== index))
  }

const calcMaxStock = (prod, itemUnit) => {
  if (!prod || prod.stock === undefined || prod.stock === null) return null
  const stockBags = parseFloat(prod.stock) || 0
  const bw = parseFloat(prod.bag_weight) || 1
  const bulkUnit = getBulkUnitDetails(prod.unit)
  const unitStr = String(itemUnit || prod.unit || '').toLowerCase()

  const isBaseUnit = bulkUnit && (
    unitStr === bulkUnit.short?.toLowerCase() ||
    unitStr === 'kgs' || unitStr === 'kg' || unitStr === 'ltr' || unitStr === 'mtr'
  )

  if (isBaseUnit && bw > 1) {
    const maxBase = (stockBags * bw) + parseFloat(prod.loose_kg || 0)
    return {
      maxStock: maxBase,
      displayLabel: `${maxBase} ${bulkUnit.short || 'kg'} (${stockBags} ${bulkUnit.name || 'Bags'})`
    }
  } else {
    const maxBags = stockBags + (bw > 1 ? (parseFloat(prod.loose_kg || 0) / bw) : 0)
    const label = (bulkUnit && bw > 1)
      ? `${bulkUnit.name || 'Bag'} (${bw}${bulkUnit.short || 'kg'})`
      : (bulkUnit?.short || prod.unit || 'pcs')
    return {
      maxStock: maxBags,
      displayLabel: `${stockBags} ${label}`
    }
  }
}

  const updateLineItem = (index, field, value) => {
    if (field === 'qty') {
      const numQty = parseFloat(value) || 0
      const targetItem = lineItems[index]
      const selectedProd = products.find(p => String(p.id) === String(targetItem?.product_id))
      const stockInfo = calcMaxStock(selectedProd, targetItem?.unit)

      if (stockInfo && stockInfo.maxStock >= 0 && numQty > stockInfo.maxStock) {
        dispatch(addToast({
          message: `We have only ${stockInfo.displayLabel} available in stock for ${selectedProd?.name || 'this product'}.`,
          type: 'warning'
        }))

        setLineItems(prev => {
          const newItems = [...prev]
          newItems[index] = { ...newItems[index], qty: stockInfo.maxStock }
          return newItems
        })
        return
      }
    }
    setLineItems(prev => {
      const newItems = [...prev]
      newItems[index] = { ...newItems[index], [field]: value }
      return newItems
    })
  }

  const handleQuickAddSaved = (person) => {
    setCustomers(prev => [person, ...prev])
    setForm(prev => ({ ...prev, customer_id: person.id }))
  }

  const handleQuickAddProductSaved = (product) => {
    setProducts(prev => [product, ...prev])
    addLineItem(product)
  }

  const handleNextStep = () => {
    const err = {}
    if (lineItems.length === 0) err.items = 'Add at least one product'
    for (const item of lineItems) {
      const selectedProd = products.find(p => String(p.id) === String(item.product_id))
      const stockInfo = calcMaxStock(selectedProd, item?.unit)
      const qty = parseFloat(item.qty) || 0
      if (stockInfo && stockInfo.maxStock >= 0 && qty > stockInfo.maxStock) {
        dispatch(addToast({
          message: `Cannot proceed: We have only ${stockInfo.displayLabel} available in stock for ${selectedProd?.name || 'this product'}.`,
          type: 'error'
        }))
        return
      }
    }
    if (Object.keys(err).length) {
      setErrors(err)
      return
    }
    setStep(2)
  }

  // Calculations
  const grossSubtotal = lineItems.reduce((sum, li) => sum + (parseFloat(li.price || 0) * parseFloat(li.qty || 1)), 0)
  const lineDiscounts = lineItems.reduce((sum, li) => sum + parseFloat(li.discount || 0), 0)
  const discountAmt = parseFloat(form.discount || 0)
  const netSubtotal = Math.max(0, grossSubtotal - lineDiscounts - discountAmt)

  const taxRate = parseFloat(form.tax_rate || 0)
  const taxAmount = netSubtotal * (taxRate / 100)
  const cgst = taxAmount / 2
  const sgst = taxAmount / 2

  const total = netSubtotal + taxAmount

  const handleSubmit = async (e) => {
    e.preventDefault()
    const err = {}
    if (form.status === 'unpaid' && !form.due_date) err.due_date = 'Due date is required'
    if (lineItems.length === 0) err.items = 'Add at least one product'
    if (Object.keys(err).length) { setErrors(err); return }

    setSaving(true)
    try {
      const payload = {
        bill_number: form.bill_number ? form.bill_number.trim() : undefined,
        customer_id: form.customer_id || null,
        amount: total,
        status: form.status,
        due_date: form.status === 'unpaid' ? form.due_date : null,
        discount: parseFloat(form.discount || 0),
        tax_rate: parseFloat(form.tax_rate || 0),
        notes: form.notes,
        items: lineItems.map(li => ({
          product_id: li.product_id,
          name: li.name || li.product_name || li.productName || 'Product',
          product_name: li.name || li.product_name || li.productName || 'Product',
          productName: li.name || li.product_name || li.productName || 'Product',
          hsn_code: li.hsn_code || li.hsn || '10064000',
          hsn: li.hsn_code || li.hsn || '10064000',
          qty: parseFloat(li.qty || 1),
          price: parseFloat(li.price || 0),
          discount: parseFloat(li.discount || 0),
          unit: li.unit || 'pcs'
        }))
      }
      await api.post('/billing', payload)
      dispatch(addToast({ message: 'Invoice created successfully!', type: 'success' }))
      navigate('/billing')
    } catch {
      dispatch(addToast({ message: 'Failed to create invoice', type: 'error' }))
    } finally {
      setSaving(false)
    }
  }

  const inp = (field) => ({
    ...S.input,
    ...(focus === field ? S.inputFocus : {}),
    ...(errors[field] ? S.inputError : {}),
  })

  const selectedCustomer = form.customer_id === null
    ? { name: 'Walk-in Customer', phone: '' }
    : customers.find(c => String(c.id) === String(form.customer_id))

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase()))
  )

  return (
    <div className="ws-dash-layout">
      <Sidebar />
      <div className={`ws-dash-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <Topbar />
        <main className="ws-dash-body">
          {/* ── Top Bar Header (Quotes & Import Stock Style) ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Create New Billing Invoice
              </h2>
              <span className="attio-badge attio-badge-blue" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                Draft
              </span>
            </div>

            <button 
              type="button"
              className="attio-btn attio-btn-primary" 
              onClick={() => navigate('/billing')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 32, fontSize: '0.78rem', padding: '0 12px' }}
            >
              <ArrowLeft size={13} /> Back to Billing
            </button>
          </div>

          {/* ── Stepper Navigation Bar (Increased box sizes by 2%) ── */}
          <div className="attio-table-card" style={{ padding: '8px 14px', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 700, margin: '0 auto 16px', boxSizing: 'border-box', flexWrap: 'nowrap', gap: 12 }}>
            <div 
              role="button"
              tabIndex={0}
              onClick={() => setStep(1)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setStep(1) }}
              style={{ 
                flex: 1, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 6, cursor: 'pointer',
                background: step === 1 ? '#eff6ff' : '#f8fafc', border: `1px solid ${step === 1 ? '#2563eb' : '#e2e8f0'}`
              }}
            >
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: step === 1 ? '#2563eb' : '#94a3b8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.72rem', flexShrink: 0 }}>1</div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: step === 1 ? '#1e40af' : '#475467', whiteSpace: 'nowrap' }}>
                Step 1: Add Products & Customer
              </div>
            </div>

            <ArrowRight size={13} style={{ color: '#cbd5e1', flexShrink: 0 }} />

            <div 
              role="button"
              tabIndex={0}
              onClick={() => { if (lineItems.length > 0) setStep(2) }}
              onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && lineItems.length > 0) setStep(2) }}
              style={{ 
                flex: 1, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 6, cursor: 'pointer',
                background: step === 2 ? '#eff6ff' : '#f8fafc', border: `1px solid ${step === 2 ? '#2563eb' : '#e2e8f0'}`
              }}
            >
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: step === 2 ? '#2563eb' : '#94a3b8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.72rem', flexShrink: 0 }}>2</div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: step === 2 ? '#1e40af' : '#475467', whiteSpace: 'nowrap' }}>
                Step 2: Payment, Tax & Finalize
              </div>
            </div>
          </div>

          {step === 1 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>
              {/* ── LEFT COLUMN (Cart) ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <p style={{ fontWeight: 600, color: '#111827', fontSize: '0.9rem', margin: 0 }}>Current Cart</p>
                      <p style={{ fontSize: '0.73rem', color: '#9ca3af', margin: '1px 0 0' }}>Add items from the product catalog on the right</p>
                    </div>
                    {errors.items && <span style={{ ...S.error, margin: 0 }}>{errors.items}</span>}
                  </div>

                  {lineItems.length === 0 ? (
                    <div style={{ padding: '36px 16px', textAlign: 'center', color: '#9ca3af', fontSize: '0.8125rem' }}>
                      <div style={{ background: '#f9fafb', width: 52, height: 52, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                        <Search size={20} color="#d1d5db" />
                      </div>
                      No products added yet. Select items from the catalog.
                    </div>
                  ) : (
                    <div style={{ padding: '0 16px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 90px 75px 90px 28px', gap: 8, padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: '0.68rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        <span>Product</span>
                        <span>Qty / Unit</span>
                        <span>Unit Price</span>
                        <span>Discount (₹)</span>
                        <span style={{ textAlign: 'right' }}>Total</span>
                        <span></span>
                      </div>
                      {lineItems.map((li, idx) => {
                        const productObj = products.find(p => p.id === li.product_id)
                        const stockAvailable = productObj ? productObj.stock : 999999
                        const exceedsStock = parseFloat(li.qty) > stockAvailable
                        const bulkUnit = getBulkUnitDetails(li.unit)

                        return (
                          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 100px 80px 100px 32px', gap: 10, padding: '10px 0', borderBottom: '1px solid #f9fafb', alignItems: 'center' }}>
                            <div>
                              <span style={{ fontSize: '0.84rem', fontWeight: 500, color: '#111827', display: 'block' }}>{li.name}</span>
                              {bulkUnit && productObj && (
                                <span style={{ fontSize: '0.69rem', color: '#059669', display: 'block', marginTop: 2, fontWeight: 500 }}>
                                  {productObj.bag_weight > 1
                                    ? `${bulkUnit.name || 'Pack'}: ₹${calcProductPrices(productObj).perPackPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${productObj.bag_weight}${bulkUnit.short})`
                                    : `${bulkUnit.name || 'Unit'}: ₹${calcProductPrices(productObj).perUnitRate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/${bulkUnit.short}`
                                  }
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <input
                                type="number"
                                step="any"
                                value={li.qty ?? ''}
                                onChange={e => updateLineItem(idx, 'qty', e.target.value)}
                                onFocus={e => e.target.select()}
                                style={{ ...S.input, width: 65, height: 28, padding: '0 6px', fontSize: '0.8125rem' }}
                              />
                              <span style={{ fontSize: '0.78rem', color: '#6b7280', whiteSpace: 'nowrap' }}>{li.unit}</span>
                            </div>
                            <div>
                              <input
                                type="text"
                                readOnly
                                value={`₹${parseFloat(li.price || 0).toFixed(2)}`}
                                style={{ ...S.input, height: 28, padding: '0 6px', fontSize: '0.8125rem', fontWeight: 600, color: '#4b5563', background: '#f8fafc', cursor: 'not-allowed' }}
                              />
                            </div>
                            <div>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={li.discount === 0 ? '' : li.discount}
                                onChange={e => updateLineItem(idx, 'discount', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                style={{ ...S.input, height: 28, padding: '0 6px', fontSize: '0.8125rem' }}
                                placeholder="0"
                              />
                            </div>
                            <div style={{ textAlign: 'right', fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
                              {INR(Math.max(0, (parseFloat(li.price || 0) * parseFloat(li.qty || 0)) - parseFloat(li.discount || 0)))}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeLineItem(idx)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              onMouseEnter={e => e.currentTarget.style.color = '#dc2626'}
                              onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )
                      })}

                      <div style={{ padding: '12px 0 12px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
                        <div style={{ fontSize: '0.875rem', color: '#4b5563' }}>
                          Cart Subtotal: <span style={{ fontWeight: 700, color: '#111827' }}>{INR(Math.max(0, grossSubtotal - lineDiscounts))}</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleNextStep}
                          className="btn-blue"
                        >
                          Next: Payment & GST <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── RIGHT COLUMN (Customer & Catalog) ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Customer Selection Card */}
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ fontWeight: 600, color: '#111827', fontSize: '0.875rem', margin: 0 }}>Select Customer</p>
                    <button
                      type="button"
                      onClick={() => navigate('/people/add?returnUrl=/billing/add')}
                      style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}
                    >
                      <UserPlus size={13} /> + Add Customer
                    </button>
                  </div>

                  <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {loadingCusts ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, color: '#9ca3af', fontSize: '0.8125rem' }}>
                        <Loader2 size={14} className="ws-chat-loader-spin" /> Loading customers...
                      </div>
                    ) : (
                      <>
                        {/* Full-width Searchable Dropdown trigger */}
                        <div ref={custDropdownRef} style={{ position: 'relative', width: '100%' }}>
                          <button
                            type="button"
                            onClick={() => setShowCustDropdown(v => !v)}
                            style={{
                              width: '100%', boxSizing: 'border-box',
                              height: 38, padding: '0 12px',
                              border: `1px solid ${errors.customer_id ? '#dc2626' : (form.customer_id === null ? '#2563eb' : (selectedCustomer ? '#10b981' : '#d1d5db'))}`,
                              borderRadius: '8px', outline: 'none',
                              cursor: 'pointer', display: 'flex',
                              justify: 'space-between', alignItems: 'center',
                              background: form.customer_id === null ? '#eff6ff' : (selectedCustomer ? '#f0fdf4' : '#fff'),
                              fontFamily: 'inherit',
                            }}
                          >
                            <span style={{
                              flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              fontSize: '0.8125rem',
                              fontWeight: (selectedCustomer || form.customer_id === null) ? 600 : 400,
                              color: form.customer_id === null ? '#1d4ed8' : (selectedCustomer ? '#15803d' : '#64748b'),
                              textAlign: 'left',
                            }}>
                              {form.customer_id === null
                                ? '🚶 Walk-in Customer Selected'
                                : (selectedCustomer
                                    ? `✓ ${selectedCustomer.name}${selectedCustomer.phone ? ` (${selectedCustomer.phone})` : ''}`
                                    : 'Search & select customer...')}
                            </span>
                            {(form.customer_id !== '' && form.customer_id !== undefined) ? (
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setForm(prev => ({ ...prev, customer_id: '' }))
                                }}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setForm(prev => ({ ...prev, customer_id: '' })) } }}
                                style={{ cursor: 'pointer', opacity: 0.7, padding: 2, display: 'flex', color: 'inherit' }}
                              >
                                <X size={13} />
                              </span>
                            ) : (
                              <ChevronDown size={14} color="#9ca3af" style={{ flexShrink: 0, marginLeft: 8 }} />
                            )}
                          </button>

                          {/* Absolute Dropdown list */}
                          {showCustDropdown && (
                            <div style={{
                              position: 'absolute',
                              top: 'calc(100% + 4px)',
                              left: 0,
                              width: '100%',
                              background: '#fff',
                              border: '1px solid #cbd5e1',
                              borderRadius: '8px',
                              boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                              zIndex: 9999,
                              padding: '6px',
                              boxSizing: 'border-box',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: '#f8fafc', borderRadius: '6px', marginBottom: 6, border: '1px solid #e2e8f0' }}>
                                <Search size={13} color="#9ca3af" />
                                <input
                                  ref={custSearchInputRef}
                                  type="text"
                                  placeholder="Search name or phone..."
                                  value={custSearch}
                                  onChange={e => setCustSearch(e.target.value)}
                                  style={{ border: 'none', background: 'none', outline: 'none', fontSize: '0.8125rem', width: '100%', fontFamily: 'inherit', color: '#111827' }}
                                  onClick={e => e.stopPropagation()}
                                />
                                {custSearch && (
                                  <button type="button" onClick={() => setCustSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', padding: 2 }}>
                                    <X size={12} />
                                  </button>
                                )}
                              </div>

                              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                {customers.filter(c =>
                                  (c?.name || '').toLowerCase().includes(custSearch.toLowerCase()) ||
                                  (c?.phone && String(c.phone).includes(custSearch))
                                ).length === 0 ? (
                                  <div style={{ padding: '12px 8px', fontSize: '0.8125rem', color: '#9ca3af', textAlign: 'center' }}>No matches found</div>
                                ) : (
                                  customers
                                    .filter(c =>
                                      (c?.name || '').toLowerCase().includes(custSearch.toLowerCase()) ||
                                      (c?.phone && String(c.phone).includes(custSearch))
                                    )
                                    .map(c => {
                                      const isSelected = String(c.id) === String(form.customer_id)
                                      return (
                                        <button
                                          key={c.id}
                                          type="button"
                                          onClick={() => {
                                            setForm(prev => ({ ...prev, customer_id: c.id }))
                                            setShowCustDropdown(false)
                                            setCustSearch('')
                                          }}
                                          style={{
                                            width: '100%', padding: '8px 10px', border: 'none',
                                            background: isSelected ? '#eff6ff' : 'transparent',
                                            textAlign: 'left', cursor: 'pointer', borderRadius: '6px',
                                            display: 'flex', flexDirection: 'column', gap: 2,
                                            fontFamily: 'inherit',
                                          }}
                                          onMouseEnter={e => !isSelected && (e.currentTarget.style.background = '#f8fafc')}
                                          onMouseLeave={e => !isSelected && (e.currentTarget.style.background = 'transparent')}
                                        >
                                          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#111827' }}>{c.name}</span>
                                          {c.phone && <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{c.phone}</span>}
                                        </button>
                                      )
                                    })
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Customer Quick Options Row: Walk-in toggle button */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => {
                              setForm(prev => ({ ...prev, customer_id: prev.customer_id === null ? '' : null }))
                              setShowCustDropdown(false)
                            }}
                            style={{
                              flex: 1, height: 32, borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600,
                              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                              background: form.customer_id === null ? '#2563eb' : '#f8fafc',
                              color: form.customer_id === null ? '#fff' : '#334155',
                              border: `1px solid ${form.customer_id === null ? '#2563eb' : '#cbd5e1'}`,
                              transition: 'background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease'
                            }}
                          >
                            🚶 Walk-in Customer
                          </button>
                        </div>

                        {errors.customer_id && <span style={S.error}>{errors.customer_id}</span>}
                      </>
                    )}
                  </div>
                </div>

                {/* Product Catalog */}
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', height: 440, minHeight: 440 }}>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', flexShrink: 0 }}>
                    <p style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.925rem', margin: 0, fontFamily: 'inherit' }}>Product Catalog</p>
                  </div>

                  {/* Search */}
                  <div style={{ position: 'relative', padding: '10px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', flexShrink: 0 }}>
                    <Search size={15} color="#94a3b8" style={{ flexShrink: 0 }} />
                    <input
                      type="text"
                      placeholder="Search catalog..."
                      value={productSearch}
                      onChange={e => setProductSearch(e.target.value)}
                      style={{ border: 'none', background: 'none', outline: 'none', fontSize: '0.85rem', color: '#0f172a', width: '100%', padding: '2px 24px 2px 0', fontFamily: 'inherit' }}
                    />
                    {productSearch && (
                      <button 
                        type="button" 
                        onClick={() => setProductSearch('')} 
                        style={{ position: 'absolute', right: 12, border: 'none', background: 'none', cursor: 'pointer', padding: 2, color: '#94a3b8', display: 'flex', alignItems: 'center' }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* List */}
                  <div style={{ overflowY: 'scroll', flex: 1 }}>
                    {loadingProds ? (
                      <div style={{ padding: '35px 16px', display: 'flex', justifyContent: 'center' }}>
                        <Loader2 size={22} className="ws-chat-loader-spin" style={{ color: '#94a3b8' }} />
                      </div>
                    ) : filteredProducts.length === 0 ? (
                      <div style={{ padding: '28px 16px', fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center' }}>
                        {productSearch ? 'No products match search' : 'No active products found'}
                      </div>
                    ) : (
                      filteredProducts.map(p => {
                        const lineItem = lineItems.find(li => li.product_id === p.id)
                        const qtyAdded = lineItem ? parseFloat(lineItem.qty || 0) : 0
                        const alreadyAdded = qtyAdded > 0
                        const bulkUnit = getBulkUnitDetails(p.unit)
                        const bw = parseFloat(p.bag_weight || 1)
                        const unitStr = String(lineItem?.unit || p.unit || '').toLowerCase()

                        const isBaseUnit = bulkUnit && (
                          unitStr === bulkUnit.short?.toLowerCase() ||
                          unitStr === 'kgs' || unitStr === 'kg' || unitStr === 'ltr' || unitStr === 'mtr'
                        )

                        const totalAvailableBase = ((parseFloat(p.stock || 0)) * (bulkUnit && bw > 1 ? bw : 1)) + parseFloat(p.loose_kg || 0)
                        const qtyAddedBase = isBaseUnit ? qtyAdded : (qtyAdded * bw)
                        const remainingBaseQty = Math.max(0, totalAvailableBase - qtyAddedBase)

                        const hasNoStock = totalAvailableBase <= 0
                        const isStockDepleted = remainingBaseQty <= 0

                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              if (hasNoStock || (isStockDepleted && !alreadyAdded)) {
                                if (!alreadyAdded) dispatch(addToast({ message: 'Product is out of stock', type: 'error' }))
                                return
                              }
                              addLineItem(p)
                            }}
                            disabled={hasNoStock || (isStockDepleted && !alreadyAdded)}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              width: '100%', padding: '12px 16px', border: 'none', borderBottom: '1px solid #f1f5f9',
                              background: alreadyAdded ? '#f0fdf4' : '#ffffff',
                              cursor: (hasNoStock || (isStockDepleted && !alreadyAdded)) ? 'not-allowed' : 'pointer',
                              textAlign: 'left', transition: 'all 0.15s ease', gap: 12,
                              opacity: (hasNoStock || (isStockDepleted && !alreadyAdded)) ? 0.55 : 1
                            }}
                            onMouseEnter={e => !alreadyAdded && !(hasNoStock || isStockDepleted) && (e.currentTarget.style.background = '#f8fafc')}
                            onMouseLeave={e => !alreadyAdded && !(hasNoStock || isStockDepleted) && (e.currentTarget.style.background = '#ffffff')}
                          >
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a', marginBottom: 3, fontFamily: 'inherit' }}>
                                {p.name}
                              </div>
                              <div style={{ fontSize: '0.74rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {(() => {
                                  const prices = calcProductPrices(p)
                                  if (bulkUnit && p.bag_weight > 1) {
                                    return (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', fontSize: '0.74rem', color: '#64748b', lineHeight: 1.3 }}>
                                        <span>{bulkUnit.name}: {INR(prices.perPackPrice)} ({p.bag_weight}{bulkUnit.short})</span>
                                        <span style={{ color: '#cbd5e1' }}>•</span>
                                        <span>{INR(prices.perUnitRate)}/{bulkUnit.short}</span>
                                        {p.updated_price && (
                                          <span style={{ color: '#10b981', fontWeight: 600 }}>(Updated)</span>
                                        )}
                                      </div>
                                    )
                                  }
                                  return (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', fontSize: '0.74rem', color: '#64748b', lineHeight: 1.3 }}>
                                      <span>Price: {INR(prices.perUnitRate)}/{p.unit || 'pcs'}</span>
                                      {p.updated_price && (
                                        <span style={{ color: '#10b981', fontWeight: 600 }}>(Updated)</span>
                                      )}
                                    </div>
                                  )
                                })()}

                                <div style={{ marginTop: 3 }}>
                                  {hasNoStock || isStockDepleted ? (
                                    <span style={{ color: '#b91c1c', fontWeight: 600, background: '#fee2e2', padding: '2px 7px', borderRadius: 5, fontSize: '0.7rem' }}>Out of Stock</span>
                                  ) : (
                                    <span style={{ color: '#475569', background: '#f1f5f9', padding: '2px 7px', borderRadius: 5, fontSize: '0.72rem', fontWeight: 500, display: 'inline-block' }}>
                                      Stock: {formatStockDisplayFromBase(remainingBaseQty, p.bag_weight, p.unit)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div style={{ flexShrink: 0 }}>
                              {alreadyAdded ? (
                                <span style={{ fontSize: '0.75rem', background: '#dcfce7', color: '#15803d', padding: '3px 10px', borderRadius: '12px', fontWeight: 600 }}>Added</span>
                              ) : (
                                <div style={{ background: '#f1f5f9', width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', transition: 'all 0.15s ease' }}>
                                  <Plus size={15} />
                                </div>
                              )}
                            </div>
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 270px', gap: 16, alignItems: 'start' }}>
              {/* ── LEFT COLUMN (Checkout Details) ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ fontWeight: 600, color: '#111827', fontSize: '0.875rem', margin: 0 }}>Payment & Tax Details</p>
                    <button type="button" onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ArrowLeft size={13} /> Back to Cart
                    </button>
                  </div>
                  <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

                    {/* Status toggle */}
                    <div>
                      <label style={{ ...S.label, fontSize: '0.78rem', marginBottom: 4 }}>Payment Status</label>
                      <div style={{ display: 'flex', gap: 0, border: '1px solid #d1d5db', borderRadius: '6px', overflow: 'hidden' }}>
                        {['unpaid', 'paid'].map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setForm(prev => ({ ...prev, status: s }))}
                            style={{
                              flex: 1, height: 30, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                              fontSize: '0.8125rem', fontWeight: 600, transition: 'all 0.15s',
                              background: form.status === s ? (s === 'paid' ? '#dcfce7' : '#fef3c7') : '#fff',
                              color: form.status === s ? (s === 'paid' ? '#15803d' : '#92400e') : '#6b7280',
                            }}
                          >
                            {s === 'paid' ? 'Paid' : 'Unpaid / Pending'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* GST Selector */}
                    <div>
                      <label style={{ ...S.label, fontSize: '0.78rem', marginBottom: 4 }}>GST Tax Rate</label>
                      <select
                        name="tax_rate"
                        value={form.tax_rate}
                        onChange={e => setForm(prev => ({ ...prev, tax_rate: parseInt(e.target.value) }))}
                        style={{ ...S.input, height: 30, padding: '0 8px', fontSize: '0.8125rem' }}
                      >
                        <option value="0">0% (GST Exempt / Nil Rated)</option>
                        <option value="5">5% GST (CGST 2.5%, SGST 2.5%)</option>
                        <option value="12">12% GST (CGST 6%, SGST 6%)</option>
                        <option value="18">18% GST (CGST 9%, SGST 9%)</option>
                        <option value="28">28% GST (CGST 14%, SGST 14%)</option>
                      </select>
                    </div>

                    {/* Due date */}
                    {form.status === 'unpaid' && (
                      <div>
                        <label style={{ ...S.label, fontSize: '0.78rem', marginBottom: 4 }}>Due Date <span style={{ color: '#dc2626' }}>*</span></label>
                        <input name="due_date" type="date" value={form.due_date} onChange={handleChange} style={{ ...inp('due_date'), height: 30, padding: '0 8px', fontSize: '0.8125rem' }} onFocus={() => setFocus('due_date')} onBlur={() => setFocus(null)} />
                        {errors.due_date && <span style={S.error}>{errors.due_date}</span>}
                      </div>
                    )}

                    {/* Discount */}
                    <div style={form.status === 'paid' ? { gridColumn: '1 / -1' } : {}}>
                      <label style={{ ...S.label, fontSize: '0.78rem', marginBottom: 4 }}>Global Discount (₹)</label>
                      <input name="discount" type="number" min="0" value={form.discount === 0 ? '' : form.discount} onChange={handleChange} placeholder="0" style={{ ...inp('discount'), height: 30, padding: '0 8px', fontSize: '0.8125rem' }} onFocus={() => setFocus('discount')} onBlur={() => setFocus(null)} />
                    </div>

                    {/* Notes */}
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ ...S.label, fontSize: '0.78rem', marginBottom: 4 }}>Invoice Notes / Terms</label>
                      <textarea name="notes" value={form.notes} onChange={handleChange} placeholder="Payment instructions, terms, etc." rows={2} style={{ ...inp('notes'), height: 'auto', padding: '6px 8px', fontSize: '0.8125rem', resize: 'vertical' }} onFocus={() => setFocus('notes')} onBlur={() => setFocus(null)} />
                    </div>

                  </div>
                </div>
              </div>

              {/* ── RIGHT COLUMN (Cart Summary & Checkout) ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid #f3f4f6' }}>
                    <p style={{ fontWeight: 600, color: '#111827', fontSize: '0.875rem', margin: 0 }}>Invoice Summary</p>
                  </div>

                  <div style={{ padding: '10px 14px', borderBottom: '1px solid #f3f4f6' }}>
                    <p style={{ fontSize: '0.68rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, margin: '0 0 4px' }}>Customer</p>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#111827', margin: 0 }}>{selectedCustomer?.name}</p>
                    {selectedCustomer?.phone && <p style={{ fontSize: '0.72rem', color: '#4b5563', margin: '2px 0 0' }}>{selectedCustomer.phone}</p>}
                  </div>

                  {/* ── Cart Items Breakdown ── */}
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid #f3f4f6', background: '#fafafa' }}>
                    <p style={{ fontSize: '0.68rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, margin: '0 0 6px' }}>
                      Cart Items ({lineItems.length})
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                      {lineItems.map((li, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 6 }}>
                            <span style={{ fontWeight: 500, color: '#111827', display: 'block' }}>{li.name}</span>
                            <span style={{ color: '#6b7280', fontSize: '0.7rem' }}>{li.qty} {li.unit} × {INR(li.price)}</span>
                          </div>
                          <span style={{ fontWeight: 600, color: '#111827', flexShrink: 0 }}>
                            {INR(Math.max(0, (parseFloat(li.price || 0) * parseFloat(li.qty || 1)) - parseFloat(li.discount || 0)))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#4b5563' }}>
                      <span>Items Count</span>
                      <span style={{ fontWeight: 500, color: '#111827' }}>{lineItems.length}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#4b5563' }}>
                      <span>Subtotal</span>
                      <span style={{ fontWeight: 500, color: '#111827' }}>{INR(grossSubtotal)}</span>
                    </div>
                    {lineDiscounts > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#059669' }}>
                        <span>Product Discounts</span>
                        <span>- {INR(lineDiscounts)}</span>
                      </div>
                    )}
                    {discountAmt > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#059669' }}>
                        <span>Global Discount</span>
                        <span>- {INR(discountAmt)}</span>
                      </div>
                    )}
                    {form.tax_rate > 0 && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#6b7280' }}>
                          <span>CGST ({form.tax_rate / 2}%)</span>
                          <span>{INR(cgst)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#6b7280' }}>
                          <span>SGST ({form.tax_rate / 2}%)</span>
                          <span>{INR(sgst)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  <div style={{ background: '#f9fafb', padding: '12px 14px', borderTop: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9375rem', fontWeight: 700, color: '#111827', marginBottom: 12 }}>
                      <span>Total Amount</span>
                      <span style={{ fontSize: '1.1rem', color: '#2563eb' }}>{INR(total)}</span>
                    </div>
                    <button
                      type="submit"
                      disabled={saving || lineItems.length === 0}
                      className="btn-blue"
                      style={{ width: '100%', justifyContent: 'center', background: (saving || lineItems.length === 0) ? '#9ca3af' : undefined, cursor: (saving || lineItems.length === 0) ? 'not-allowed' : 'pointer' }}
                    >
                      {saving && <Loader2 size={15} className="ws-chat-loader-spin" />}
                      {saving ? 'Creating Invoice...' : 'Create Invoice'}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}

        </main>
      </div>

      {showQuickAdd && (
        <QuickAddPersonModal
          onClose={() => setShowQuickAdd(false)}
          onSaved={handleQuickAddSaved}
        />
      )}

      {showQuickAddProduct && (
        <QuickAddProductModal
          onClose={() => setShowQuickAddProduct(false)}
          onSaved={handleQuickAddProductSaved}
        />
      )}
    </div>
  )
}

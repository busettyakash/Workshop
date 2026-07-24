// Production UOM List for dropdowns across the application
export const ALL_UOM_OPTIONS = [
  { value: 'pcs', label: 'Pieces (pcs)', category: 'Count' },
  { value: 'box', label: 'Box / Pack (box)', category: 'Package', isBulk: true },
  { value: 'kgs', label: 'Kilograms (kgs)', category: 'Weight', isBulk: true },
  { value: 'mtr', label: 'Meters (mtr)', category: 'Length', isBulk: true },
  { value: 'ltr', label: 'Liters (ltr)', category: 'Volume', isBulk: true },
  { value: 'doz', label: 'Dozen (doz)', category: 'Count' },
  { value: 'set', label: 'Set / Kit (set)', category: 'Count' },
  { value: 'g',   label: 'Grams (g)', category: 'Weight' },
  { value: 'ml',  label: 'Milliliters (ml)', category: 'Volume' },
  { value: 'ft',  label: 'Feet (ft)', category: 'Length' }
];

// Quick Container Size Options for production use cases
export const UOM_QUICK_SIZES = {
  kgs: [25, 50, 75, 100],
  ltr: [25, 50, 75, 100],
  mtr: [25, 50, 75, 100],
  box: [10, 25, 50, 100],
  doz: [12, 60]
};

export const getBulkUnitDetails = (unit) => {
  if (!unit) return null;
  const u = String(unit).toLowerCase().trim();

  // Weight-based (Kg / Bag / Ton)
  if (['kgs', 'kg', 'kilogram', 'kilograms'].includes(u)) {
    return {
      isBulk: true,
      category: 'weight',
      type: 'weight',
      label: 'Pack / Bag Weight (kg)',
      short: 'kg',
      name: 'Bag',
      pluralName: 'Bags',
      unitName: 'Kilogram',
      quickSizes: UOM_QUICK_SIZES.kgs
    };
  }
  if (['g', 'gm', 'gram', 'grams'].includes(u)) {
    return {
      isBulk: false,
      category: 'weight',
      type: 'weight',
      label: 'Weight (g)',
      short: 'g',
      name: 'Pack',
      pluralName: 'Packs',
      unitName: 'Gram'
    };
  }

  // Volume-based (Liter / Can / Drum / Bottle)
  if (['litres', 'litre', 'ltr', 'ltrs', 'liter', 'liters', 'l'].includes(u)) {
    return {
      isBulk: true,
      category: 'volume',
      type: 'volume',
      label: 'Pack / Drum Volume (Liters)',
      short: 'ltr',
      name: 'Drum',
      pluralName: 'Drums',
      unitName: 'Liter',
      quickSizes: UOM_QUICK_SIZES.ltr
    };
  }
  if (['ml', 'milliliter', 'milliliters'].includes(u)) {
    return {
      isBulk: false,
      category: 'volume',
      type: 'volume',
      label: 'Volume (ml)',
      short: 'ml',
      name: 'Bottle',
      pluralName: 'Bottles',
      unitName: 'Milliliter'
    };
  }

  // Length-based (Meter / Roll / Pipe / Coil)
  if (['meters', 'meter', 'mtr', 'mtrs', 'm'].includes(u)) {
    return {
      isBulk: true,
      category: 'length',
      type: 'length',
      label: 'Roll / Bundle Length (Meters)',
      short: 'mtr',
      name: 'Roll',
      pluralName: 'Rolls',
      unitName: 'Meter',
      quickSizes: UOM_QUICK_SIZES.mtr
    };
  }
  if (['ft', 'feet', 'foot'].includes(u)) {
    return {
      isBulk: true,
      category: 'length',
      type: 'length',
      label: 'Length (Feet)',
      short: 'ft',
      name: 'Bundle',
      pluralName: 'Bundles',
      unitName: 'Feet'
    };
  }

  // Box / Pack / Quantity-based
  if (['box', 'boxes', 'pack', 'pkt', 'ctn', 'carton'].includes(u)) {
    return {
      isBulk: true,
      category: 'package',
      type: 'pack',
      label: 'Items per Box / Pack',
      short: 'pc',
      name: 'Box',
      pluralName: 'Boxes',
      unitName: 'Box',
      quickSizes: UOM_QUICK_SIZES.box
    };
  }

  if (['doz', 'dozen'].includes(u)) {
    return {
      isBulk: true,
      category: 'count',
      type: 'pack',
      label: 'Items in Dozen',
      short: 'pc',
      name: 'Dozen',
      pluralName: 'Dozen',
      unitName: 'Dozen',
      quickSizes: UOM_QUICK_SIZES.doz
    };
  }

  return null;
};

// Formatter helper to get clear production unit text string
export const formatProductUnitPrice = (price, unit, packCapacity = 1) => {
  const p = parseFloat(price || 0);
  const cap = parseFloat(packCapacity || 1);
  const details = getBulkUnitDetails(unit);

  if (details && cap > 1) {
    const unitPrice = (p / cap).toFixed(2);
    return `${cap}${details.short} ${details.name} • ₹${unitPrice}/${details.short}`;
  }
  return details ? `₹${p.toFixed(2)} / ${details.short}` : `₹${p.toFixed(2)} / ${unit || 'pcs'}`;
};

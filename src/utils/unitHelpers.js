// Production UOM List for dropdowns across the application
export const ALL_UOM_OPTIONS = [
  { value: 'pcs', label: 'Pieces (pcs)', category: 'Count' },
  { value: 'box', label: 'Box / Pack (box)', category: 'Package', isBulk: true },
  { value: 'kgs', label: 'Kilograms (kgs)', category: 'Weight', isBulk: true },
  { value: 'mtr', label: 'Meters (mtr)', category: 'Length', isBulk: true },
  { value: 'ltr', label: 'Liters (ltr)', category: 'Volume', isBulk: true },
  { value: 'doz', label: 'Dozen (doz)', category: 'Count' },
  { value: 'set', label: 'Set / Kit (set)', category: 'Count' },
  { value: 'ml', label: 'Milliliters (ml)', category: 'Volume' },
  { value: 'ft', label: 'Feet (ft)', category: 'Length' }
];

// Quick Container Size Options for production use cases
export const UOM_QUICK_SIZES = {
  kgs: [25, 50, 75, 100],
  ltr: [25, 50, 75, 100],
  mtr: [25, 50, 75, 100],
  box: [10, 25, 50, 100],
  doz: [12, 60]
};

export const getDynamicFieldLabels = (unit) => {
  const u = String(unit || 'kgs').toLowerCase().trim()

  if (['kgs', 'kg', 'kilogram', 'kilograms'].includes(u)) {
    return {
      packWeightLabel: 'Package Weight (kg) *',
      priceCoversLabel: 'Price Covers (kg)',
      stockQtyLabel: 'Stock Quantity (Bags)',
      short: 'kg',
      unitName: 'Kilogram'
    }
  }

  if (['litres', 'litre', 'ltr', 'ltrs', 'liter', 'liters', 'l'].includes(u)) {
    return {
      packWeightLabel: 'Package Size (L) *',
      priceCoversLabel: 'Price Covers (L)',
      stockQtyLabel: 'Stock Quantity (Cans)',
      short: 'L',
      unitName: 'Liter'
    }
  }

  if (['pcs', 'pc', 'pieces', 'piece', 'box', 'boxes', 'set', 'doz', 'count'].includes(u)) {
    return {
      packWeightLabel: 'Items Per Package *',
      priceCoversLabel: 'Price Covers (Pieces)',
      stockQtyLabel: 'Stock Quantity (Boxes)',
      short: 'pcs',
      unitName: 'Piece'
    }
  }

  return {
    packWeightLabel: 'Package Size *',
    priceCoversLabel: 'Price Covers',
    stockQtyLabel: 'Stock Quantity',
    short: unit || 'unit',
    unitName: unit || 'Unit'
  }
}

export const getBulkUnitDetails = (unit) => {
  if (!unit) return null;
  const u = String(unit).toLowerCase().trim();

  // Weight-based (Kg / Bag / Ton)
  if (['kgs', 'kg', 'kilogram', 'kilograms'].some(k => u.includes(k))) {
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
  if (['litres', 'litre', 'ltr', 'ltrs', 'liter', 'liters', 'l'].some(k => u.includes(k))) {
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
  if (['meters', 'meter', 'mtr', 'mtrs', 'm'].some(k => u.includes(k))) {
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
      short: 'box',
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
      short: 'doz',
      name: 'Dozen',
      pluralName: 'Dozen',
      unitName: 'Dozen',
      quickSizes: UOM_QUICK_SIZES.doz
    };
  }

  return null;
};

// Calculates accurate per-kg and per-pack pricing regardless of bulk lot input size
export const calculateUnitPricing = (price, basePrice, bagWeight = 1, unit = '') => {
  const p = parseFloat(price || 0);
  const bp = parseFloat(basePrice || price || 0);
  const bw = parseFloat(bagWeight || 1);

  if (p <= 0 || bw <= 0) {
    return { perKgPrice: '0.00', perPackPrice: '0.00', packWeight: bw, totalKg: bw, packCount: 1 };
  }

  // Base rate per kg from initial base price
  const baseRatePerKg = bp / bw;

  // Find the multiplier m (1 to 25 bags) of bw that yields per-kg price closest to baseRatePerKg
  let bestM = 1;
  let minDiff = Math.abs((p / bw) - baseRatePerKg);

  for (let m = 1; m <= 25; m++) {
    const candidateRate = p / (m * bw);
    const diff = Math.abs(candidateRate - baseRatePerKg);
    if (diff < minDiff) {
      minDiff = diff;
      bestM = m;
    }
  }

  const totalKg = bestM * bw;
  const perKgPrice = (p / totalKg).toFixed(2);
  const perPackPrice = ((p / totalKg) * bw).toFixed(2);

  return {
    perKgPrice,
    perPackPrice,
    packWeight: bw,
    totalKg,
    packCount: bestM
  };
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

export const formatStockDisplay = (stock, bagWeight = 1, unit = '', looseKg = 0) => {
  if (stock === undefined || stock === null) return '0';
  const numStock = parseFloat(stock);
  const bw = parseFloat(bagWeight) || 1;
  const passedLoose = parseFloat(looseKg || 0);

  if (isNaN(numStock) && isNaN(passedLoose)) return '0';

  const validStock = isNaN(numStock) ? 0 : numStock;
  const rawUnit = String(unit || '').trim();
  const uLow = rawUnit.toLowerCase();
  const unitCode = ['lit', 'lite', 'liter', 'liters', 'litre', 'litres'].includes(uLow) ? 'ltr' : rawUnit;

  // If bagWeight > 1 (bulk packaging like a 50kg bag or 200L barrel), format with container + loose
  if (bw > 1) {
    const bulkUnit = getBulkUnitDetails(unitCode);
    const fullBags = Math.floor(validStock);
    let looseQty = passedLoose > 0 ? passedLoose : (validStock - fullBags) * bw;
    looseQty = Math.round(looseQty * 100) / 100;

    const containerName = (bulkUnit && bulkUnit.name) ? bulkUnit.name : 'Pack';
    const containerPlural = (bulkUnit && bulkUnit.pluralName) ? bulkUnit.pluralName : `${containerName}s`;
    const looseUnitLabel = unitCode || (bulkUnit && bulkUnit.short) || 'unit';

    const packLabel = fullBags === 1 ? containerName : containerPlural;

    if (looseQty > 0 && fullBags > 0) {
      return `${fullBags} ${packLabel} ${looseQty} ${looseUnitLabel}`;
    } else if (fullBags > 0) {
      return `${fullBags} ${packLabel}`;
    } else if (looseQty > 0) {
      return `${looseQty} ${looseUnitLabel}`;
    } else {
      return `0 ${packLabel}`;
    }
  }

  // Standard non-bulk item (or bagWeight <= 1): Display exact stock amount + exact UOM code (e.g. "100 ltr", "40 kgs")
  const totalStock = validStock + (passedLoose > 0 ? passedLoose : 0);
  const displayUnit = unitCode || 'pcs';
  return `${totalStock} ${displayUnit}`;
};

export const formatStockDisplayFromBase = (totalBaseQty, bagWeight = 1, unit = '') => {
  if (totalBaseQty === undefined || totalBaseQty === null) return '0';
  const total = parseFloat(totalBaseQty);
  if (isNaN(total)) return '0';

  const bw = parseFloat(bagWeight) || 1;
  const rawUnit = String(unit || '').trim();
  const uLow = rawUnit.toLowerCase();
  const unitCode = ['lit', 'lite', 'liter', 'liters', 'litre', 'litres'].includes(uLow) ? 'ltr' : rawUnit;

  if (bw > 1) {
    const bulkUnit = getBulkUnitDetails(unitCode) || { name: 'Pack', pluralName: 'Packs' };
    const fullBags = Math.floor(total / bw);
    let looseQty = Math.round((total % bw) * 100) / 100;
    const containerName = bulkUnit.name || 'Pack';
    const containerPlural = bulkUnit.pluralName || `${containerName}s`;
    const looseUnitLabel = unitCode || (bulkUnit && bulkUnit.short) || 'unit';

    const packLabel = fullBags === 1 ? containerName : containerPlural;

    if (looseQty > 0 && fullBags > 0) {
      return `${fullBags} ${packLabel} ${looseQty} ${looseUnitLabel}`;
    } else if (fullBags > 0) {
      return `${fullBags} ${packLabel}`;
    } else if (looseQty > 0) {
      return `${looseQty} ${looseUnitLabel}`;
    } else {
      return `0 ${packLabel}`;
    }
  }

  const displayUnit = unitCode || 'pcs';
  return `${total} ${displayUnit}`;
};

export const getPackWeightLabel = (unit) => {
  if (!unit) return 'Package Weight (kg)';
  const u = String(unit).toLowerCase().trim();
  if (['litres', 'litre', 'ltr', 'ltrs', 'liter', 'liters', 'l'].includes(u)) {
    return 'Package Size (L)';
  }
  if (['pcs', 'pc', 'piece', 'pieces', 'box', 'boxes', 'pack', 'doz', 'dozen', 'set'].includes(u)) {
    return 'Items Per Package';
  }
  return 'Package Weight (kg)';
};

export const getPriceCoversLabel = (unit) => {
  if (!unit) return 'Price Covers (kg)';
  const u = String(unit).toLowerCase().trim();
  if (['litres', 'litre', 'ltr', 'ltrs', 'liter', 'liters', 'l'].includes(u)) {
    return 'Price Covers (L)';
  }
  if (['pcs', 'pc', 'piece', 'pieces', 'box', 'boxes', 'pack', 'doz', 'dozen', 'set'].includes(u)) {
    return 'Price Covers (Pieces)';
  }
  return 'Price Covers (kg)';
};

export const getStockQuantityLabel = (unit) => {
  if (!unit) return 'Stock Quantity (Bags)';
  const u = String(unit).toLowerCase().trim();
  if (['litres', 'litre', 'ltr', 'ltrs', 'liter', 'liters', 'l'].includes(u)) {
    return 'Stock Quantity (Cans)';
  }
  if (['pcs', 'pc', 'piece', 'pieces', 'box', 'boxes', 'pack', 'doz', 'dozen', 'set'].includes(u)) {
    return 'Stock Quantity (Boxes)';
  }
  return 'Stock Quantity (Bags)';
};

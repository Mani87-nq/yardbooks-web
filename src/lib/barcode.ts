/**
 * Barcode Generation & Label Printing Utility
 *
 * - Code 128B SVG barcode generation (shared by receipts + labels)
 * - Internal barcode string generation (AH-XXXXXX format)
 * - Single and bulk label HTML generation for printing
 */

// ─── Code 128B Encoding ───────────────────────────────────────────────────────

const CODE128_START_B = 104;
const CODE128_STOP = 106;

// Code 128B encoding table (subset for alphanumeric)
const CODE128B_PATTERNS: Record<number, string> = {
  0: '11011001100', 32: '11011001100', 33: '11001101100', 34: '11001100110',
  35: '10010011000', 36: '10010001100', 37: '10001001100', 38: '10011001000',
  39: '10011000100', 40: '10001100100', 41: '11001001000', 42: '11001000100',
  43: '11000100100', 44: '10110011100', 45: '10011011100', 46: '10011001110',
  47: '10111001100', 48: '10011101100', 49: '10011100110', 50: '11001110010',
  51: '11001011100', 52: '11001001110', 53: '11011100100', 54: '11001110100',
  55: '11101101110', 56: '11101001100', 57: '11100101100', 58: '11100100110',
  59: '11101100100', 60: '11100110100', 61: '11100110010', 62: '11011011000',
  63: '11011000110', 64: '11000110110', 65: '10100011000', 66: '10001011000',
  67: '10001000110', 68: '10110001000', 69: '10001101000', 70: '10001100010',
  71: '11010001000', 72: '11000101000', 73: '11000100010', 74: '10110111000',
  75: '10110001110', 76: '10001101110', 77: '10111011000', 78: '10111000110',
  79: '10001110110', 80: '11101110110', 81: '11010001110', 82: '11000101110',
  83: '11011101000', 84: '11011100010', 85: '11011101110', 86: '11101011000',
  87: '11101000110', 88: '11100010110', 89: '11101101000', 90: '11101100010',
  91: '11100011010', 92: '11101111010', 93: '11001000010', 94: '11110001010',
  95: '10100110000', 96: '10100001100', 97: '10010110000', 98: '10010000110',
  99: '10000101100', 100: '10000100110', 101: '10110010000', 102: '10110000100',
  103: '10011010000', 104: '11010000100', 105: '11000010100', 106: '11011011110',
};

/**
 * Generate Code 128B barcode SVG for a given text string.
 * Used by receipt printing and barcode label generation.
 */
export function generateBarcodeSVG(text: string, height: number = 40, showText: boolean = true): string {
  // Convert text to Code 128B values
  const values: number[] = [CODE128_START_B];
  let checksum = CODE128_START_B;

  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const value = charCode - 32; // Code 128B offset
    values.push(value);
    checksum += value * (i + 1);
  }

  // Add checksum and stop
  const checksumValue = checksum % 103;
  values.push(checksumValue);
  values.push(CODE128_STOP);

  // Build pattern string
  let pattern = '';
  for (const val of values) {
    pattern += CODE128B_PATTERNS[val] || CODE128B_PATTERNS[0];
  }
  // Add final bar
  pattern += '11';

  // Calculate dimensions
  const barWidth = 1.5;
  const totalWidth = pattern.length * barWidth;
  const totalHeight = showText ? height + 18 : height;

  // Build SVG
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth + 10} ${totalHeight}" width="${totalWidth + 10}" height="${totalHeight}">`;
  svg += '<rect width="100%" height="100%" fill="white"/>';

  let x = 5;
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '1') {
      svg += `<rect x="${x}" y="2" width="${barWidth}" height="${height}" fill="black"/>`;
    }
    x += barWidth;
  }

  // Add text below barcode
  if (showText) {
    svg += `<text x="${(totalWidth + 10) / 2}" y="${height + 14}" text-anchor="middle" font-family="monospace" font-size="10">${text}</text>`;
  }

  svg += '</svg>';
  return svg;
}

// ─── Internal Barcode Generation ──────────────────────────────────────────────

const INTERNAL_BARCODE_PREFIX = 'AH-';

/**
 * Check if a barcode is an internally generated one.
 */
export function isInternalBarcode(barcode: string): boolean {
  return barcode.startsWith(INTERNAL_BARCODE_PREFIX);
}

/**
 * Generate a unique internal barcode in the format AH-XXXXXX (e.g., AH-000001).
 * Scans existing barcodes to find the next available sequential number.
 */
export function generateInternalBarcode(existingBarcodes: string[]): string {
  let maxNumber = 0;
  for (const barcode of existingBarcodes) {
    if (barcode.startsWith(INTERNAL_BARCODE_PREFIX)) {
      const numPart = parseInt(barcode.slice(INTERNAL_BARCODE_PREFIX.length), 10);
      if (!isNaN(numPart) && numPart > maxNumber) {
        maxNumber = numPart;
      }
    }
  }
  const nextNumber = maxNumber + 1;
  return `${INTERNAL_BARCODE_PREFIX}${nextNumber.toString().padStart(6, '0')}`;
}

// ─── Label Printing ───────────────────────────────────────────────────────────

export interface LabelProduct {
  name: string;
  barcode: string;
  unitPrice: number;
  sku?: string;
}

export type PrinterMode = 'label' | 'letter';

export interface LabelPrintSettings {
  showPrice: boolean;
  showProductName: boolean;
  showSku: boolean;
  copies: number;
  printerMode: PrinterMode;
}

export interface BulkLabelItem {
  product: LabelProduct;
  copies: number;
}

/** Default print settings — letter paper, show name + price, 1 copy */
export function getDefaultLabelPrintSettings(): LabelPrintSettings {
  return {
    showPrice: true,
    showProductName: true,
    showSku: false,
    copies: 1,
    printerMode: 'letter',
  };
}

/** Grid constants for letter-size label sheets */
export const LETTER_GRID = {
  columns: 3,
  rowsPerPage: 8,
  get labelsPerPage() { return this.columns * this.rowsPerPage; }, // 24
};

/**
 * Format a number as Jamaican Dollar currency for labels.
 */
function formatPrice(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

/**
 * Build a single label div for label-printer mode (2.25" x 1.25").
 */
function buildSingleLabelDiv(product: LabelProduct, settings: LabelPrintSettings): string {
  // Increase barcode height when no text is shown below it
  const hasText = settings.showProductName || settings.showPrice || (settings.showSku && !!product.sku);
  const barcodeHeight = hasText ? 45 : 60;
  const barcodeSVG = generateBarcodeSVG(product.barcode, barcodeHeight, true);

  return `
    <div class="label">
      <div class="barcode">${barcodeSVG}</div>
      ${settings.showProductName ? `<div class="product-name">${product.name}</div>` : ''}
      ${settings.showSku && product.sku ? `<div class="sku">${product.sku}</div>` : ''}
      ${settings.showPrice ? `<div class="price">${formatPrice(product.unitPrice)}</div>` : ''}
    </div>
  `;
}

/**
 * Build a single grid cell div for letter-paper mode.
 */
function buildGridCellDiv(product: LabelProduct, settings: LabelPrintSettings): string {
  const hasText = settings.showProductName || settings.showPrice;
  const barcodeHeight = hasText ? 35 : 50;
  const barcodeSVG = generateBarcodeSVG(product.barcode, barcodeHeight, true);

  return `
    <div class="label-cell">
      <div class="barcode">${barcodeSVG}</div>
      ${settings.showProductName ? `<div class="product-name">${product.name}</div>` : ''}
      ${settings.showPrice ? `<div class="price">${formatPrice(product.unitPrice)}</div>` : ''}
    </div>
  `;
}

/**
 * Generate a single barcode label as a printable HTML document.
 * Designed for label printers (2.25" x 1.25") with configurable content.
 */
export function generateLabelHTML(
  product: LabelProduct,
  settings: LabelPrintSettings = getDefaultLabelPrintSettings()
): string {
  const labelContent = buildSingleLabelDiv(product, settings);

  // Repeat label for multiple copies with page breaks between them
  const labels = Array(settings.copies).fill(labelContent).join('<div class="page-break"></div>');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Barcode Label - ${product.name}</title>
  <style>
    @page {
      size: 2.25in 1.25in;
      margin: 0;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .label {
      width: 2.25in;
      height: 1.25in;
      padding: 0.06in 0.1in;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .barcode {
      text-align: center;
      max-width: 100%;
    }
    .barcode svg {
      max-width: 1.9in;
      height: auto;
    }
    .product-name {
      font-size: 8pt;
      font-weight: bold;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
      margin-top: 1px;
    }
    .sku {
      font-size: 6pt;
      color: #666;
      font-family: monospace;
    }
    .price {
      font-size: 10pt;
      font-weight: bold;
      margin-top: 1px;
    }
    .page-break { page-break-after: always; }
    @media screen {
      body { background: #f0f0f0; padding: 20px; }
      .label {
        background: white;
        border: 1px solid #ccc;
        margin: 10px auto;
      }
    }
  </style>
</head>
<body>${labels}</body>
</html>`;
}

/**
 * Generate barcode labels for one or more products with quantity support.
 * Supports two printer modes:
 *
 * - **label**: Continuous roll (2.25" x 1.25" per label, page-break between each)
 * - **letter**: Letter paper (8.5" x 11") with 3-column × 8-row grid (24 per page)
 *
 * Each item specifies a product and how many copies to print.
 */
export function generateBulkLabelsHTML(
  items: BulkLabelItem[],
  settings: LabelPrintSettings = getDefaultLabelPrintSettings()
): string {
  // ── Label Printer Mode: continuous roll ──────────────────────────────────
  if (settings.printerMode === 'label') {
    const allLabels: string[] = [];
    for (const item of items) {
      for (let i = 0; i < item.copies; i++) {
        allLabels.push(buildSingleLabelDiv(item.product, settings));
      }
    }

    const labelsHTML = allLabels.join('<div class="page-break"></div>');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Barcode Labels - Continuous</title>
  <style>
    @page {
      size: 2.25in 1.25in;
      margin: 0;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .label {
      width: 2.25in;
      height: 1.25in;
      padding: 0.06in 0.1in;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .barcode {
      text-align: center;
      max-width: 100%;
    }
    .barcode svg {
      max-width: 1.9in;
      height: auto;
    }
    .product-name {
      font-size: 8pt;
      font-weight: bold;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
      margin-top: 1px;
    }
    .sku {
      font-size: 6pt;
      color: #666;
      font-family: monospace;
    }
    .price {
      font-size: 10pt;
      font-weight: bold;
      margin-top: 1px;
    }
    .page-break { page-break-after: always; }
    @media screen {
      body { background: #f0f0f0; padding: 20px; }
      .label {
        background: white;
        border: 1px solid #ccc;
        margin: 10px auto;
      }
    }
  </style>
</head>
<body>${labelsHTML}</body>
</html>`;
  }

  // ── Letter Paper Mode: 3×8 grid (24 labels per page) ────────────────────
  const { columns, labelsPerPage } = LETTER_GRID;
  const colWidth = `${(100 / columns).toFixed(2)}%`;

  // Flatten all items × copies into a single array
  const allProducts: LabelProduct[] = [];
  for (const item of items) {
    for (let i = 0; i < item.copies; i++) {
      allProducts.push(item.product);
    }
  }

  // Split into pages of 24
  const pages: LabelProduct[][] = [];
  for (let i = 0; i < allProducts.length; i += labelsPerPage) {
    pages.push(allProducts.slice(i, i + labelsPerPage));
  }

  // Generate HTML for each page
  const pagesHTML = pages.map((pageLabels) => {
    const cells = pageLabels.map((product) => buildGridCellDiv(product, settings)).join('');
    return `<div class="label-grid">${cells}</div>`;
  }).join('<div class="page-break"></div>');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Barcode Labels - Sheet Print</title>
  <style>
    @page {
      size: letter;
      margin: 0.4in 0.3in;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .label-grid {
      display: flex;
      flex-wrap: wrap;
    }
    .label-cell {
      width: ${colWidth};
      height: 1.25in;
      border: 1px dashed #ccc;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 0.05in 0.08in;
      overflow: hidden;
    }
    .barcode {
      text-align: center;
      max-width: 100%;
    }
    .barcode svg {
      max-width: 2in;
      height: auto;
    }
    .product-name {
      font-size: 7pt;
      font-weight: bold;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
      margin-top: 1px;
    }
    .price {
      font-size: 9pt;
      font-weight: bold;
      margin-top: 1px;
    }
    .page-break { page-break-after: always; }
    @media screen {
      body { background: #f0f0f0; padding: 20px; }
      .label-grid {
        background: white;
        max-width: 8.5in;
        margin: 0 auto;
        padding: 0.4in 0.3in;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }
    }
  </style>
</head>
<body>${pagesHTML}</body>
</html>`;
}

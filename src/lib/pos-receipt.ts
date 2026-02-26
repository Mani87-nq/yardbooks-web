/**
 * POS Receipt Template Engine
 *
 * Generates professional thermal-printer-style receipts for POS transactions.
 * Supports 58mm and 80mm paper widths with proper formatting.
 * Includes company branding, GCT compliance, payment details, and configurable footer.
 */
import DOMPurify from 'dompurify';

function sanitize(value: string | number | null | undefined): string {
  const str = String(value ?? '');
  if (typeof window !== 'undefined' && DOMPurify) {
    return DOMPurify.sanitize(str, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  }
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-JM', {
    style: 'currency',
    currency: 'JMD',
    minimumFractionDigits: 2,
  }).format(num || 0);
}

// ── Types ──────────────────────────────────────────────────────────

export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number | string;
  lineTotal: number | string;
  isGctExempt?: boolean;
  discountAmount?: number | string;
}

export interface ReceiptPayment {
  method: string;
  amount: number | string;
  amountTendered?: number | string;
  changeGiven?: number | string;
}

export interface ReceiptData {
  // Business info
  businessName: string;
  businessAddress?: string;
  businessPhone?: string;
  businessTRN?: string;
  gctRegistrationNumber?: string;
  logoUrl?: string;
  showLogo?: boolean;

  // Order info
  orderNumber: string;
  date: string | Date;
  customerName?: string;
  terminalName?: string;
  cashierName?: string;

  // Line items
  items: ReceiptItem[];

  // Totals
  subtotal: number | string;
  discountAmount?: number | string;
  discountLabel?: string;
  taxableAmount?: number | string;
  exemptAmount?: number | string;
  gctRate?: number;
  gctAmount: number | string;
  total: number | string;

  // Payment
  payments: ReceiptPayment[];
  amountPaid?: number | string;
  changeGiven?: number | string;

  // Footer
  receiptFooter?: string;

  // Options
  paperWidth?: 58 | 80;
  showBarcode?: boolean;
  isReturn?: boolean;
  returnReason?: string;
}

// ── Receipt HTML Generator ────────────────────────────────────────

export function generateReceiptHTML(data: ReceiptData): string {
  const {
    businessName,
    businessAddress,
    businessPhone,
    businessTRN,
    gctRegistrationNumber,
    logoUrl,
    showLogo,
    orderNumber,
    date,
    customerName,
    terminalName,
    cashierName,
    items,
    subtotal,
    discountAmount,
    discountLabel,
    taxableAmount,
    exemptAmount,
    gctRate,
    gctAmount,
    total,
    payments,
    amountPaid,
    changeGiven,
    receiptFooter,
    paperWidth = 80,
    isReturn,
    returnReason,
  } = data;

  const dateStr =
    date instanceof Date
      ? date.toLocaleString('en-JM', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : new Date(date).toLocaleString('en-JM', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

  const width = paperWidth === 58 ? '220px' : '302px';
  const colChars = paperWidth === 58 ? 32 : 42;

  // Payment method label
  const methodLabel = (method: string) => {
    const map: Record<string, string> = {
      CASH: 'Cash',
      cash: 'Cash',
      JAM_DEX: 'JAM-DEX',
      jam_dex: 'JAM-DEX',
      LYNK_WALLET: 'Lynk',
      lynk_wallet: 'Lynk',
      WIPAY: 'WiPay',
      wipay: 'WiPay',
      CARD_VISA: 'Visa',
      card_visa: 'Visa',
      CARD_MASTERCARD: 'MC',
      card_mastercard: 'MC',
      CARD_OTHER: 'Card',
      card_other: 'Card',
      BANK_TRANSFER: 'Transfer',
      bank_transfer: 'Transfer',
      STORE_CREDIT: 'Credit',
      store_credit: 'Credit',
    };
    return map[method] || method;
  };

  // Build line items HTML
  const itemsHtml = items
    .map((item) => {
      const qty = item.quantity;
      const price = Number(item.unitPrice);
      const lineTotal = Number(item.lineTotal);
      const disc = Number(item.discountAmount || 0);

      return `
      <tr>
        <td colspan="4" style="padding:2px 0 0;font-size:12px;">${sanitize(item.name)}${item.isGctExempt ? ' <span style="font-size:10px;color:#666;">(E)</span>' : ''}</td>
      </tr>
      <tr>
        <td style="padding:0 0 2px;font-size:11px;color:#555;">&nbsp;&nbsp;${qty} × ${fmtCurrency(price)}</td>
        <td colspan="2"></td>
        <td style="padding:0 0 2px;font-size:12px;text-align:right;">${fmtCurrency(lineTotal)}</td>
      </tr>
      ${disc > 0 ? `<tr><td colspan="3" style="padding:0 0 2px;font-size:10px;color:#c00;">&nbsp;&nbsp;Discount</td><td style="text-align:right;font-size:10px;color:#c00;">-${fmtCurrency(disc)}</td></tr>` : ''}
    `;
    })
    .join('');

  // Build payments HTML
  const paymentsHtml = payments
    .map((p) => {
      let html = `<tr><td style="font-size:12px;">${sanitize(methodLabel(p.method))}</td><td style="text-align:right;font-size:12px;">${fmtCurrency(Number(p.amount))}</td></tr>`;
      if (Number(p.amountTendered || 0) > 0) {
        html += `<tr><td style="font-size:11px;color:#555;">Tendered</td><td style="text-align:right;font-size:11px;color:#555;">${fmtCurrency(Number(p.amountTendered))}</td></tr>`;
      }
      if (Number(p.changeGiven || 0) > 0) {
        html += `<tr><td style="font-size:11px;color:#555;">Change</td><td style="text-align:right;font-size:11px;color:#555;">${fmtCurrency(Number(p.changeGiven))}</td></tr>`;
      }
      return html;
    })
    .join('');

  // Aggregate change
  const totalChange = Number(changeGiven || 0);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${isReturn ? 'Return Receipt' : 'Receipt'} — ${sanitize(orderNumber)}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @page { size: ${width} auto; margin: 0; }
        body {
          font-family: 'Courier New', Courier, monospace;
          width: ${width};
          max-width: ${width};
          margin: 0 auto;
          padding: 8px;
          color: #000;
          background: #fff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .receipt-header { text-align: center; margin-bottom: 8px; }
        .receipt-header .biz-name { font-size: 16px; font-weight: bold; margin-bottom: 2px; }
        .receipt-header .biz-info { font-size: 10px; color: #444; line-height: 1.4; }
        .receipt-header .biz-logo { max-width: 80px; max-height: 50px; margin: 4px auto; display: block; }
        .divider { border-top: 1px dashed #000; margin: 6px 0; }
        .divider-double { border-top: 2px solid #000; margin: 6px 0; }
        .order-info { font-size: 11px; line-height: 1.5; }
        .order-info td { padding: 1px 0; }
        .order-info .label { color: #555; width: 80px; }
        .items-table { width: 100%; border-collapse: collapse; }
        .totals-table { width: 100%; border-collapse: collapse; }
        .totals-table td { padding: 2px 0; font-size: 12px; }
        .totals-table .total-row td { font-size: 14px; font-weight: bold; padding-top: 4px; }
        .payment-table { width: 100%; border-collapse: collapse; }
        .footer { text-align: center; font-size: 10px; color: #555; margin-top: 8px; line-height: 1.4; }
        .return-banner {
          text-align: center; padding: 4px; margin-bottom: 6px;
          border: 2px solid #000; font-weight: bold; font-size: 14px;
        }
        @media print {
          body { padding: 0; width: ${width}; }
          .no-print { display: none !important; }
        }
      </style>
    </head>
    <body>
      ${isReturn ? '<div class="return-banner">*** RETURN / REFUND ***</div>' : ''}

      <!-- Header -->
      <div class="receipt-header">
        ${showLogo && logoUrl ? `<img src="${sanitize(logoUrl)}" class="biz-logo" alt="Logo" />` : ''}
        <div class="biz-name">${sanitize(businessName)}</div>
        <div class="biz-info">
          ${businessAddress ? sanitize(businessAddress) + '<br/>' : ''}
          ${businessPhone ? 'Tel: ' + sanitize(businessPhone) + '<br/>' : ''}
          ${businessTRN ? 'TRN: ' + sanitize(businessTRN) + '<br/>' : ''}
          ${gctRegistrationNumber ? 'GCT Reg: ' + sanitize(gctRegistrationNumber) : ''}
        </div>
      </div>

      <div class="divider"></div>

      <!-- Order Info -->
      <table class="order-info" style="width:100%;">
        <tr><td class="label">Receipt #:</td><td>${sanitize(orderNumber)}</td></tr>
        <tr><td class="label">Date:</td><td>${sanitize(dateStr)}</td></tr>
        ${customerName && customerName !== 'Walk-in' ? `<tr><td class="label">Customer:</td><td>${sanitize(customerName)}</td></tr>` : ''}
        ${terminalName ? `<tr><td class="label">Terminal:</td><td>${sanitize(terminalName)}</td></tr>` : ''}
        ${cashierName ? `<tr><td class="label">Cashier:</td><td>${sanitize(cashierName)}</td></tr>` : ''}
        ${isReturn && returnReason ? `<tr><td class="label">Reason:</td><td>${sanitize(returnReason)}</td></tr>` : ''}
      </table>

      <div class="divider"></div>

      <!-- Items -->
      <table class="items-table">
        ${itemsHtml}
      </table>

      <div class="divider"></div>

      <!-- Totals -->
      <table class="totals-table">
        <tr><td>Subtotal</td><td style="text-align:right;">${fmtCurrency(Number(subtotal))}</td></tr>
        ${Number(discountAmount || 0) > 0 ? `<tr><td style="color:#c00;">${sanitize(discountLabel || 'Discount')}</td><td style="text-align:right;color:#c00;">-${fmtCurrency(Number(discountAmount))}</td></tr>` : ''}
        ${Number(taxableAmount || 0) > 0 ? `<tr><td style="font-size:11px;color:#555;">Taxable</td><td style="text-align:right;font-size:11px;color:#555;">${fmtCurrency(Number(taxableAmount))}</td></tr>` : ''}
        ${Number(exemptAmount || 0) > 0 ? `<tr><td style="font-size:11px;color:#555;">Exempt (E)</td><td style="text-align:right;font-size:11px;color:#555;">${fmtCurrency(Number(exemptAmount))}</td></tr>` : ''}
        <tr><td>GCT${gctRate ? ` (${Math.round(gctRate * 100)}%)` : ''}</td><td style="text-align:right;">${fmtCurrency(Number(gctAmount))}</td></tr>
        <tr class="total-row">
          <td style="border-top:1px solid #000;">${isReturn ? 'REFUND TOTAL' : 'TOTAL'}</td>
          <td style="border-top:1px solid #000;text-align:right;">${fmtCurrency(Number(total))}</td>
        </tr>
      </table>

      ${payments.length > 0 ? `
        <div class="divider"></div>
        <table class="payment-table">
          <tr><td colspan="2" style="font-size:11px;font-weight:bold;padding-bottom:2px;">Payment</td></tr>
          ${paymentsHtml}
        </table>
      ` : ''}

      ${totalChange > 0 ? `
        <div class="divider-double"></div>
        <table style="width:100%;">
          <tr>
            <td style="font-size:14px;font-weight:bold;">CHANGE</td>
            <td style="font-size:14px;font-weight:bold;text-align:right;">${fmtCurrency(totalChange)}</td>
          </tr>
        </table>
      ` : ''}

      <div class="divider-double"></div>

      <!-- Footer -->
      <div class="footer">
        ${receiptFooter ? sanitize(receiptFooter) + '<br/>' : ''}
        ${!receiptFooter ? 'Thank you for your purchase!<br/>' : ''}
        ${gctRegistrationNumber ? 'GCT included where applicable<br/>' : ''}
        <span style="font-size:9px;color:#999;">Powered by YaadBooks</span>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 200);
        };
      </script>
    </body>
    </html>
  `;
}

// ── Print Receipt ─────────────────────────────────────────────────

/**
 * Opens a print window with a POS receipt layout.
 * Designed for 58mm or 80mm thermal printers,
 * but also works well with standard printers.
 * @param copies Number of copies to print (default 1). Each copy is separated by a page break.
 */
export function printReceipt(data: ReceiptData, copies: number = 1): void {
  const singleHtml = generateReceiptHTML(data);

  if (copies <= 1) {
    const printWindow = window.open('', '_blank', 'width=360,height=600');
    if (!printWindow) {
      alert('Please allow popups to print receipts.');
      return;
    }
    printWindow.document.write(singleHtml);
    printWindow.document.close();
    return;
  }

  // For multiple copies, extract the <body> content and repeat it with page breaks
  const bodyMatch = singleHtml.match(/<body[^>]*>([\s\S]*)<script>/);
  const headMatch = singleHtml.match(/<head[^>]*>([\s\S]*)<\/head>/);

  if (!bodyMatch || !headMatch) {
    // Fallback: just print single copy
    const printWindow = window.open('', '_blank', 'width=360,height=600');
    if (!printWindow) {
      alert('Please allow popups to print receipts.');
      return;
    }
    printWindow.document.write(singleHtml);
    printWindow.document.close();
    return;
  }

  const headContent = headMatch[1];
  const bodyContent = bodyMatch[1];

  const copiesArray = Array.from({ length: copies }, (_, i) => {
    const isLast = i === copies - 1;
    return `<div${!isLast ? ' style="page-break-after: always;"' : ''}>${bodyContent}</div>`;
  });

  const multiHtml = `
    <!DOCTYPE html>
    <html>
    <head>${headContent}</head>
    <body>
      ${copiesArray.join('\n')}
      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 200);
        };
      </script>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank', 'width=360,height=600');
  if (!printWindow) {
    alert('Please allow popups to print receipts.');
    return;
  }
  printWindow.document.write(multiHtml);
  printWindow.document.close();
}

// ── Helper: Build ReceiptData from API order ──────────────────────

interface ApiOrderForReceipt {
  orderNumber: string;
  createdAt: string | Date;
  customerName?: string;
  status?: string;
  items: {
    name: string;
    quantity: number;
    unitPrice: string | number;
    lineSubtotal?: string | number;
    lineTotal?: string | number;
    discountAmount?: string | number;
    isGctExempt?: boolean;
    gctAmount?: string | number;
  }[];
  subtotal?: string | number;
  orderDiscountAmount?: string | number;
  orderDiscountReason?: string;
  taxableAmount?: string | number;
  exemptAmount?: string | number;
  gctRate?: string | number;
  gctAmount?: string | number;
  total: string | number;
  payments?: {
    method: string;
    amount: string | number;
    amountTendered?: string | number;
    changeGiven?: string | number;
    status?: string;
  }[];
  changeGiven?: string | number;
  terminalName?: string;
}

interface PosSettingsForReceipt {
  businessName?: string;
  businessAddress?: string;
  businessPhone?: string;
  businessTRN?: string;
  gctRegistrationNumber?: string;
  businessLogo?: string;
  showLogo?: boolean;
  receiptFooter?: string;
}

/**
 * Converts an API order + POS settings into ReceiptData for printing.
 */
export function buildReceiptFromOrder(
  order: ApiOrderForReceipt,
  settings?: PosSettingsForReceipt,
  companyName?: string,
): ReceiptData {
  const items: ReceiptItem[] = order.items.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: item.lineTotal ?? item.lineSubtotal ?? Number(item.unitPrice) * item.quantity,
    isGctExempt: item.isGctExempt,
    discountAmount: item.discountAmount,
  }));

  const completedPayments = (order.payments || [])
    .filter((p) => !p.status || p.status === 'COMPLETED' || p.status === 'completed')
    .map((p) => ({
      method: p.method,
      amount: p.amount,
      amountTendered: p.amountTendered,
      changeGiven: p.changeGiven,
    }));

  return {
    businessName: settings?.businessName || companyName || 'YaadBooks',
    businessAddress: settings?.businessAddress,
    businessPhone: settings?.businessPhone,
    businessTRN: settings?.businessTRN,
    gctRegistrationNumber: settings?.gctRegistrationNumber,
    logoUrl: settings?.businessLogo,
    showLogo: settings?.showLogo ?? false,
    orderNumber: order.orderNumber,
    date: order.createdAt,
    customerName: order.customerName,
    terminalName: order.terminalName,
    items,
    subtotal: order.subtotal ?? items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0),
    discountAmount: order.orderDiscountAmount,
    discountLabel: order.orderDiscountReason ? `Discount (${order.orderDiscountReason})` : 'Discount',
    taxableAmount: order.taxableAmount,
    exemptAmount: order.exemptAmount,
    gctRate: order.gctRate ? Number(order.gctRate) : undefined,
    gctAmount: order.gctAmount ?? 0,
    total: order.total,
    payments: completedPayments,
    changeGiven: order.changeGiven,
    receiptFooter: settings?.receiptFooter,
  };
}

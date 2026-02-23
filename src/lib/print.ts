// Print & PDF utilities for YaadBooks
import DOMPurify from 'dompurify';

/**
 * Sanitize user-provided values before interpolating into HTML.
 * Uses DOMPurify on the client; falls back to basic HTML entity escaping on the server.
 */
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

interface PrintOptions {
  title: string;
  subtitle?: string;
  companyName?: string;
  content: string;
  footer?: string;
}

/**
 * Opens a print dialog with formatted content
 */
export function printContent(options: PrintOptions): void {
  const { title, subtitle, companyName, content, footer } = options;

  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (!printWindow) {
    alert('Please allow popups to print');
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 40px;
          color: #1f2937;
          line-height: 1.5;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e5e7eb;
        }
        .company-name {
          font-size: 24px;
          font-weight: bold;
          color: #059669;
          margin-bottom: 5px;
        }
        .document-title {
          font-size: 20px;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 5px;
        }
        .subtitle {
          font-size: 14px;
          color: #6b7280;
        }
        .content {
          margin-bottom: 40px;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          font-size: 12px;
          color: #9ca3af;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        th, td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #e5e7eb;
        }
        th {
          background-color: #f9fafb;
          font-weight: 600;
          color: #374151;
        }
        .text-right {
          text-align: right;
        }
        .text-center {
          text-align: center;
        }
        .font-bold {
          font-weight: bold;
        }
        .text-emerald {
          color: #059669;
        }
        .text-red {
          color: #dc2626;
        }
        .summary-row {
          background-color: #f0fdf4;
          font-weight: bold;
        }
        .summary-row td {
          padding: 16px 12px;
        }
        .stat-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          margin: 20px 0;
        }
        .stat-card {
          padding: 20px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
        }
        .stat-label {
          font-size: 14px;
          color: #6b7280;
          margin-bottom: 5px;
        }
        .stat-value {
          font-size: 24px;
          font-weight: bold;
          color: #1f2937;
        }
        @media print {
          body {
            padding: 20px;
          }
          .no-print {
            display: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        ${companyName ? `<div class="company-name">${sanitize(companyName)}</div>` : ''}
        <div class="document-title">${sanitize(title)}</div>
        ${subtitle ? `<div class="subtitle">${sanitize(subtitle)}</div>` : ''}
      </div>
      <div class="content">
        ${content}
      </div>
      ${footer ? `<div class="footer">${sanitize(footer)}</div>` : `
        <div class="footer">
          Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()} | YaadBooks
        </div>
      `}
      <script>
        window.onload = function() {
          window.print();
        }
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * Downloads content as a text file
 */
export function downloadAsText(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Downloads content as CSV
 */
export function downloadAsCSV(data: Record<string, any>[], filename: string): void {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(h => {
        const val = row[h];
        // Escape commas and quotes in values
        if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val ?? '';
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Formats currency for printing (JMD)
 */
export function formatPrintCurrency(amount: number): string {
  return new Intl.NumberFormat('en-JM', {
    style: 'currency',
    currency: 'JMD',
  }).format(amount);
}

/**
 * Generates HTML table from data
 */
export function generateTable(
  headers: { key: string; label: string; align?: 'left' | 'right' | 'center' }[],
  data: Record<string, any>[],
  options?: {
    summaryRow?: Record<string, any>;
    formatters?: Record<string, (value: any) => string>;
  }
): string {
  const { summaryRow, formatters = {} } = options || {};

  const thead = `
    <thead>
      <tr>
        ${headers.map(h => `<th class="text-${h.align || 'left'}">${sanitize(h.label)}</th>`).join('')}
      </tr>
    </thead>
  `;

  const tbody = `
    <tbody>
      ${data.map(row => `
        <tr>
          ${headers.map(h => {
            const value = row[h.key];
            const formatted = formatters[h.key] ? formatters[h.key](value) : value;
            return `<td class="text-${h.align || 'left'}">${sanitize(formatted)}</td>`;
          }).join('')}
        </tr>
      `).join('')}
      ${summaryRow ? `
        <tr class="summary-row">
          ${headers.map(h => {
            const value = summaryRow[h.key];
            const formatted = value !== undefined
              ? (formatters[h.key] ? formatters[h.key](value) : value)
              : '';
            return `<td class="text-${h.align || 'left'}">${sanitize(formatted)}</td>`;
          }).join('')}
        </tr>
      ` : ''}
    </tbody>
  `;

  return `<table>${thead}${tbody}</table>`;
}

/**
 * Generates stat cards for reports
 */
export function generateStatCards(
  stats: { label: string; value: string; color?: string }[]
): string {
  return `
    <div class="stat-grid">
      ${stats.map(s => `
        <div class="stat-card">
          <div class="stat-label">${sanitize(s.label)}</div>
          <div class="stat-value" ${s.color ? `style="color: ${sanitize(s.color)}"` : ''}>${sanitize(s.value)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

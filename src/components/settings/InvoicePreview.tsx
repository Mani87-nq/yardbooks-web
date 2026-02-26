'use client';

import React from 'react';

// ============================================
// TYPES
// ============================================

interface InvoicePreviewProps {
  template: 'classic' | 'modern' | 'minimal' | 'professional';
  primaryColor: string;
  accentColor: string;
  showLogo: boolean;
  logoUrl?: string;
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyTrn?: string;
  companyGct?: string;
  prefix: string;
  nextNumber: number;
  termsAndConditions?: string;
  defaultNotes?: string;
  footerText?: string;
}

// ============================================
// SAMPLE DATA
// ============================================

const SAMPLE_CUSTOMER = {
  name: 'Island Fresh Foods Ltd',
  address: '12 Hope Road, Kingston 6, St. Andrew',
  phone: '(876) 555-0142',
  email: 'accounts@islandfreshfoods.com',
};

const SAMPLE_ITEMS = [
  {
    name: 'Accounting Software License',
    description: 'YaadBooks Pro - Annual subscription',
    qty: 1,
    rate: 45000,
    amount: 45000,
  },
  {
    name: 'Implementation & Training',
    description: 'On-site setup and staff training',
    qty: 8,
    unit: 'hrs',
    rate: 12500,
    amount: 100000,
  },
  {
    name: 'Annual Support Package',
    description: 'Priority email & phone support',
    qty: 1,
    rate: 25000,
    amount: 25000,
  },
];

const SUBTOTAL = 170000;
const GCT_RATE = 0.15;
const GCT_AMOUNT = 25500;
const TOTAL = 195500;

const INVOICE_DATE = formatSampleDate(0);
const DUE_DATE = formatSampleDate(30);

function formatSampleDate(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString('en-JM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Determines whether to use white or dark text on a given background color
 * for readable contrast.
 */
function contrastText(hex: string): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#1a1a1a' : '#ffffff';
}

/**
 * Mixes a hex color with white at a given opacity (0-1).
 */
function colorWithOpacity(hex: string, opacity: number): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const mixR = Math.round(r * opacity + 255 * (1 - opacity));
  const mixG = Math.round(g * opacity + 255 * (1 - opacity));
  const mixB = Math.round(b * opacity + 255 * (1 - opacity));
  return `rgb(${mixR}, ${mixG}, ${mixB})`;
}

// ============================================
// SHARED SUB-COMPONENTS
// ============================================

function LogoPlaceholder({ showLogo, logoUrl, size = 48 }: { showLogo: boolean; logoUrl?: string; size?: number }) {
  if (!showLogo) return null;
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt="Company logo"
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          borderRadius: 4,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundColor: '#e5e7eb',
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.25,
        color: '#9ca3af',
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      LOGO
    </div>
  );
}

// ============================================
// CLASSIC TEMPLATE
// ============================================

function ClassicTemplate(props: InvoicePreviewProps) {
  const { primaryColor, accentColor, showLogo, logoUrl, companyName, companyAddress, companyPhone, companyEmail, companyTrn, companyGct, prefix, nextNumber, termsAndConditions, defaultNotes, footerText } = props;

  return (
    <div style={{ fontFamily: "'Georgia', 'Times New Roman', serif", fontSize: 9, color: '#1f2937', lineHeight: 1.5 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 12, borderBottom: `2px solid ${primaryColor}` }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <LogoPlaceholder showLogo={showLogo} logoUrl={logoUrl} size={44} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: primaryColor, marginBottom: 2 }}>{companyName}</div>
            {companyAddress && <div style={{ color: '#6b7280', fontSize: 8 }}>{companyAddress}</div>}
            {companyPhone && <div style={{ color: '#6b7280', fontSize: 8 }}>{companyPhone}</div>}
            {companyEmail && <div style={{ color: '#6b7280', fontSize: 8 }}>{companyEmail}</div>}
            {companyTrn && <div style={{ color: '#6b7280', fontSize: 8 }}>TRN: {companyTrn}</div>}
            {companyGct && <div style={{ color: '#6b7280', fontSize: 8 }}>GCT: {companyGct}</div>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: primaryColor, letterSpacing: 2, marginBottom: 4 }}>INVOICE</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: accentColor }}>{prefix}{String(nextNumber).padStart(4, '0')}</div>
          <div style={{ fontSize: 8, color: '#6b7280', marginTop: 4 }}>Date: {INVOICE_DATE}</div>
          <div style={{ fontSize: 8, color: '#6b7280' }}>Due: {DUE_DATE}</div>
        </div>
      </div>

      {/* Bill To */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 8, fontWeight: 700, color: primaryColor, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Bill To</div>
        <div style={{ fontWeight: 600, fontSize: 10 }}>{SAMPLE_CUSTOMER.name}</div>
        <div style={{ color: '#6b7280', fontSize: 8 }}>{SAMPLE_CUSTOMER.address}</div>
        <div style={{ color: '#6b7280', fontSize: 8 }}>{SAMPLE_CUSTOMER.phone}</div>
        <div style={{ color: '#6b7280', fontSize: 8 }}>{SAMPLE_CUSTOMER.email}</div>
      </div>

      {/* Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
        <thead>
          <tr style={{ backgroundColor: primaryColor }}>
            <th style={{ padding: '6px 8px', textAlign: 'left', color: contrastText(primaryColor), fontSize: 8, fontWeight: 600 }}>Item</th>
            <th style={{ padding: '6px 8px', textAlign: 'left', color: contrastText(primaryColor), fontSize: 8, fontWeight: 600 }}>Description</th>
            <th style={{ padding: '6px 8px', textAlign: 'center', color: contrastText(primaryColor), fontSize: 8, fontWeight: 600 }}>Qty</th>
            <th style={{ padding: '6px 8px', textAlign: 'right', color: contrastText(primaryColor), fontSize: 8, fontWeight: 600 }}>Rate</th>
            <th style={{ padding: '6px 8px', textAlign: 'right', color: contrastText(primaryColor), fontSize: 8, fontWeight: 600 }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {SAMPLE_ITEMS.map((item, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '6px 8px', fontSize: 8, fontWeight: 500 }}>{item.name}</td>
              <td style={{ padding: '6px 8px', fontSize: 8, color: '#6b7280' }}>{item.description}</td>
              <td style={{ padding: '6px 8px', fontSize: 8, textAlign: 'center' }}>{item.qty}{item.unit ? ` ${item.unit}` : ''}</td>
              <td style={{ padding: '6px 8px', fontSize: 8, textAlign: 'right' }}>{formatCurrency(item.rate)}</td>
              <td style={{ padding: '6px 8px', fontSize: 8, textAlign: 'right', fontWeight: 500 }}>{formatCurrency(item.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <div style={{ width: '45%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 8, borderBottom: '1px solid #e5e7eb' }}>
            <span style={{ color: '#6b7280' }}>Subtotal</span>
            <span>{formatCurrency(SUBTOTAL)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 8, borderBottom: '1px solid #e5e7eb' }}>
            <span style={{ color: '#6b7280' }}>GCT ({GCT_RATE * 100}%)</span>
            <span>{formatCurrency(GCT_AMOUNT)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 11, fontWeight: 700, backgroundColor: colorWithOpacity(accentColor, 0.1), paddingLeft: 8, paddingRight: 8, borderRadius: 4, marginTop: 4 }}>
            <span style={{ color: primaryColor }}>Total (JMD)</span>
            <span style={{ color: primaryColor }}>{formatCurrency(TOTAL)}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: `1px solid ${colorWithOpacity(primaryColor, 0.2)}`, paddingTop: 10 }}>
        {termsAndConditions && (
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 7, fontWeight: 700, color: primaryColor, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Terms & Conditions</div>
            <div style={{ fontSize: 7, color: '#6b7280', lineHeight: 1.4 }}>{termsAndConditions}</div>
          </div>
        )}
        {defaultNotes && (
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 7, fontWeight: 700, color: primaryColor, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Notes</div>
            <div style={{ fontSize: 7, color: '#6b7280', lineHeight: 1.4 }}>{defaultNotes}</div>
          </div>
        )}
        {footerText && (
          <div style={{ textAlign: 'center', fontSize: 7, color: '#9ca3af', marginTop: 8 }}>{footerText}</div>
        )}
      </div>
    </div>
  );
}

// ============================================
// MODERN TEMPLATE
// ============================================

function ModernTemplate(props: InvoicePreviewProps) {
  const { primaryColor, accentColor, showLogo, logoUrl, companyName, companyAddress, companyPhone, companyEmail, companyTrn, companyGct, prefix, nextNumber, termsAndConditions, defaultNotes, footerText } = props;

  return (
    <div style={{ fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif", fontSize: 9, color: '#1f2937', lineHeight: 1.5, display: 'flex', minHeight: '100%' }}>
      {/* Left Sidebar Accent Bar */}
      <div style={{ width: 6, backgroundColor: primaryColor, borderRadius: '3px 0 0 3px', flexShrink: 0 }} />

      {/* Main Content */}
      <div style={{ flex: 1, paddingLeft: 16 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <LogoPlaceholder showLogo={showLogo} logoUrl={logoUrl} size={36} />
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{companyName}</div>
            </div>
            <div style={{ fontSize: 8, color: '#6b7280', lineHeight: 1.6 }}>
              {companyAddress && <div>{companyAddress}</div>}
              {companyPhone && <span>{companyPhone}</span>}
              {companyPhone && companyEmail && <span> | </span>}
              {companyEmail && <span>{companyEmail}</span>}
            </div>
            {companyTrn && <div style={{ fontSize: 7, color: '#9ca3af', marginTop: 2 }}>TRN: {companyTrn}{companyGct ? ` | GCT: ${companyGct}` : ''}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'inline-block', backgroundColor: primaryColor, color: contrastText(primaryColor), padding: '4px 12px', borderRadius: 20, fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>INVOICE</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: accentColor, marginBottom: 2 }}>{prefix}{String(nextNumber).padStart(4, '0')}</div>
            <div style={{ fontSize: 8, color: '#9ca3af' }}>Issued: {INVOICE_DATE}</div>
            <div style={{ fontSize: 8, color: '#9ca3af' }}>Due: {DUE_DATE}</div>
          </div>
        </div>

        {/* Bill To & Payment Info */}
        <div style={{ display: 'flex', gap: 20, marginBottom: 16, padding: '10px 12px', backgroundColor: '#f9fafb', borderRadius: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 7, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Billed To</div>
            <div style={{ fontWeight: 600, fontSize: 9 }}>{SAMPLE_CUSTOMER.name}</div>
            <div style={{ fontSize: 8, color: '#6b7280' }}>{SAMPLE_CUSTOMER.address}</div>
            <div style={{ fontSize: 8, color: '#6b7280' }}>{SAMPLE_CUSTOMER.email}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 7, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Payment Details</div>
            <div style={{ fontSize: 8, color: '#6b7280' }}>Bank: National Commercial Bank</div>
            <div style={{ fontSize: 8, color: '#6b7280' }}>Account: **** **** 4821</div>
            <div style={{ fontSize: 8, color: '#6b7280' }}>Branch: Half Way Tree</div>
          </div>
        </div>

        {/* Table */}
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, marginBottom: 16, borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
          <thead>
            <tr style={{ backgroundColor: colorWithOpacity(primaryColor, 0.08) }}>
              <th style={{ padding: '7px 8px', textAlign: 'left', fontSize: 7, fontWeight: 600, color: primaryColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>Item</th>
              <th style={{ padding: '7px 8px', textAlign: 'left', fontSize: 7, fontWeight: 600, color: primaryColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>Description</th>
              <th style={{ padding: '7px 8px', textAlign: 'center', fontSize: 7, fontWeight: 600, color: primaryColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>Qty</th>
              <th style={{ padding: '7px 8px', textAlign: 'right', fontSize: 7, fontWeight: 600, color: primaryColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>Rate</th>
              <th style={{ padding: '7px 8px', textAlign: 'right', fontSize: 7, fontWeight: 600, color: primaryColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE_ITEMS.map((item, i) => (
              <tr key={i} style={{ borderBottom: i < SAMPLE_ITEMS.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                <td style={{ padding: '7px 8px', fontSize: 8, fontWeight: 500 }}>{item.name}</td>
                <td style={{ padding: '7px 8px', fontSize: 8, color: '#6b7280' }}>{item.description}</td>
                <td style={{ padding: '7px 8px', fontSize: 8, textAlign: 'center' }}>{item.qty}{item.unit ? ` ${item.unit}` : ''}</td>
                <td style={{ padding: '7px 8px', fontSize: 8, textAlign: 'right' }}>{formatCurrency(item.rate)}</td>
                <td style={{ padding: '7px 8px', fontSize: 8, textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
          <div style={{ width: '45%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', fontSize: 8 }}>
              <span style={{ color: '#6b7280' }}>Subtotal</span>
              <span>{formatCurrency(SUBTOTAL)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', fontSize: 8 }}>
              <span style={{ color: '#6b7280' }}>GCT ({GCT_RATE * 100}%)</span>
              <span>{formatCurrency(GCT_AMOUNT)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', fontSize: 11, fontWeight: 700, backgroundColor: primaryColor, color: contrastText(primaryColor), borderRadius: 6, marginTop: 4 }}>
              <span>Total (JMD)</span>
              <span>{formatCurrency(TOTAL)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 10 }}>
          {termsAndConditions && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 7, fontWeight: 600, color: '#374151', marginBottom: 2 }}>Terms & Conditions</div>
              <div style={{ fontSize: 7, color: '#9ca3af', lineHeight: 1.4 }}>{termsAndConditions}</div>
            </div>
          )}
          {defaultNotes && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 7, fontWeight: 600, color: '#374151', marginBottom: 2 }}>Notes</div>
              <div style={{ fontSize: 7, color: '#9ca3af', lineHeight: 1.4 }}>{defaultNotes}</div>
            </div>
          )}
          {footerText && (
            <div style={{ textAlign: 'center', fontSize: 7, color: accentColor, marginTop: 8, fontWeight: 500 }}>{footerText}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// MINIMAL TEMPLATE
// ============================================

function MinimalTemplate(props: InvoicePreviewProps) {
  const { primaryColor, showLogo, logoUrl, companyName, companyAddress, companyPhone, companyEmail, companyTrn, companyGct, prefix, nextNumber, termsAndConditions, defaultNotes, footerText } = props;

  return (
    <div style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif", fontSize: 9, color: '#374151', lineHeight: 1.6 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <LogoPlaceholder showLogo={showLogo} logoUrl={logoUrl} size={32} />
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', letterSpacing: -0.3 }}>{companyName}</div>
          </div>
          <div style={{ fontSize: 8, color: '#9ca3af', lineHeight: 1.6 }}>
            {companyAddress && <div>{companyAddress}</div>}
            {companyPhone && <div>{companyPhone}</div>}
            {companyEmail && <div>{companyEmail}</div>}
            {(companyTrn || companyGct) && (
              <div style={{ marginTop: 2 }}>
                {companyTrn && <span>TRN: {companyTrn}</span>}
                {companyTrn && companyGct && <span> | </span>}
                {companyGct && <span>GCT: {companyGct}</span>}
              </div>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>Invoice</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: primaryColor, marginBottom: 8 }}>{prefix}{String(nextNumber).padStart(4, '0')}</div>
          <div style={{ fontSize: 8, color: '#9ca3af' }}>
            <div>Date: {INVOICE_DATE}</div>
            <div>Due: {DUE_DATE}</div>
          </div>
        </div>
      </div>

      {/* Bill To */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 7, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>Bill To</div>
        <div style={{ fontWeight: 600, fontSize: 10, color: '#111827' }}>{SAMPLE_CUSTOMER.name}</div>
        <div style={{ fontSize: 8, color: '#9ca3af' }}>{SAMPLE_CUSTOMER.address}</div>
      </div>

      {/* Table - Minimal style with bottom borders only */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
        <thead>
          <tr>
            <th style={{ padding: '8px 0', textAlign: 'left', fontSize: 7, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid #e5e7eb' }}>Item</th>
            <th style={{ padding: '8px 0', textAlign: 'center', fontSize: 7, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid #e5e7eb' }}>Qty</th>
            <th style={{ padding: '8px 0', textAlign: 'right', fontSize: 7, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid #e5e7eb' }}>Rate</th>
            <th style={{ padding: '8px 0', textAlign: 'right', fontSize: 7, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid #e5e7eb' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {SAMPLE_ITEMS.map((item, i) => (
            <tr key={i}>
              <td style={{ padding: '8px 0', fontSize: 8, borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ fontWeight: 500, color: '#111827' }}>{item.name}</div>
                <div style={{ color: '#9ca3af', fontSize: 7, marginTop: 1 }}>{item.description}</div>
              </td>
              <td style={{ padding: '8px 0', fontSize: 8, textAlign: 'center', borderBottom: '1px solid #f3f4f6', color: '#6b7280' }}>{item.qty}{item.unit ? ` ${item.unit}` : ''}</td>
              <td style={{ padding: '8px 0', fontSize: 8, textAlign: 'right', borderBottom: '1px solid #f3f4f6', color: '#6b7280' }}>{formatCurrency(item.rate)}</td>
              <td style={{ padding: '8px 0', fontSize: 8, textAlign: 'right', borderBottom: '1px solid #f3f4f6', fontWeight: 500, color: '#111827' }}>{formatCurrency(item.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
        <div style={{ width: '40%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 8, color: '#9ca3af' }}>
            <span>Subtotal</span>
            <span style={{ color: '#374151' }}>{formatCurrency(SUBTOTAL)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 8, color: '#9ca3af', borderBottom: '1px solid #e5e7eb' }}>
            <span>GCT ({GCT_RATE * 100}%)</span>
            <span style={{ color: '#374151' }}>{formatCurrency(GCT_AMOUNT)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13, fontWeight: 700 }}>
            <span style={{ color: primaryColor }}>Total</span>
            <span style={{ color: primaryColor }}>{formatCurrency(TOTAL)}</span>
          </div>
          <div style={{ textAlign: 'right', fontSize: 7, color: '#9ca3af', marginTop: -4 }}>JMD</div>
        </div>
      </div>

      {/* Footer */}
      {(termsAndConditions || defaultNotes || footerText) && (
        <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
          {termsAndConditions && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 7, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Terms</div>
              <div style={{ fontSize: 7, color: '#9ca3af', lineHeight: 1.4 }}>{termsAndConditions}</div>
            </div>
          )}
          {defaultNotes && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 7, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Notes</div>
              <div style={{ fontSize: 7, color: '#9ca3af', lineHeight: 1.4 }}>{defaultNotes}</div>
            </div>
          )}
          {footerText && (
            <div style={{ textAlign: 'center', fontSize: 7, color: '#d1d5db', marginTop: 10 }}>{footerText}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// PROFESSIONAL TEMPLATE
// ============================================

function ProfessionalTemplate(props: InvoicePreviewProps) {
  const { primaryColor, accentColor, showLogo, logoUrl, companyName, companyAddress, companyPhone, companyEmail, companyTrn, companyGct, prefix, nextNumber, termsAndConditions, defaultNotes, footerText } = props;

  return (
    <div style={{ fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif", fontSize: 9, color: '#1f2937', lineHeight: 1.5 }}>
      {/* Full-width colored header band */}
      <div style={{ backgroundColor: primaryColor, margin: '-20px -20px 16px -20px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {showLogo && logoUrl ? (
            <img src={logoUrl} alt="Company logo" style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.15)' }} />
          ) : showLogo ? (
            <div style={{ width: 36, height: 36, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>LOGO</div>
          ) : null}
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: contrastText(primaryColor) }}>{companyName}</div>
            {companyAddress && <div style={{ fontSize: 8, color: `${contrastText(primaryColor)}cc` }}>{companyAddress}</div>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: contrastText(primaryColor), letterSpacing: 3 }}>INVOICE</div>
        </div>
      </div>

      {/* Invoice Details Grid */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, padding: '10px 0', borderBottom: '2px solid #e5e7eb' }}>
        <div>
          <div style={{ fontSize: 7, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>From</div>
          <div style={{ fontSize: 8, color: '#6b7280' }}>
            {companyPhone && <div>{companyPhone}</div>}
            {companyEmail && <div>{companyEmail}</div>}
            {companyTrn && <div>TRN: {companyTrn}</div>}
            {companyGct && <div>GCT: {companyGct}</div>}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 7, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Bill To</div>
          <div style={{ fontWeight: 600, fontSize: 9 }}>{SAMPLE_CUSTOMER.name}</div>
          <div style={{ fontSize: 8, color: '#6b7280' }}>{SAMPLE_CUSTOMER.address}</div>
          <div style={{ fontSize: 8, color: '#6b7280' }}>{SAMPLE_CUSTOMER.email}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 7, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Invoice Details</div>
          <div style={{ fontSize: 8, color: '#6b7280' }}>
            <div><span style={{ fontWeight: 600, color: '#374151' }}>Number:</span> {prefix}{String(nextNumber).padStart(4, '0')}</div>
            <div><span style={{ fontWeight: 600, color: '#374151' }}>Date:</span> {INVOICE_DATE}</div>
            <div><span style={{ fontWeight: 600, color: '#374151' }}>Due:</span> {DUE_DATE}</div>
            <div><span style={{ fontWeight: 600, color: '#374151' }}>Status:</span> <span style={{ color: accentColor, fontWeight: 600 }}>Pending</span></div>
          </div>
        </div>
      </div>

      {/* Table with alternating rows */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
        <thead>
          <tr style={{ backgroundColor: '#1f2937' }}>
            <th style={{ padding: '6px 8px', textAlign: 'left', color: '#ffffff', fontSize: 7, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Item</th>
            <th style={{ padding: '6px 8px', textAlign: 'left', color: '#ffffff', fontSize: 7, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Description</th>
            <th style={{ padding: '6px 8px', textAlign: 'center', color: '#ffffff', fontSize: 7, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Qty</th>
            <th style={{ padding: '6px 8px', textAlign: 'right', color: '#ffffff', fontSize: 7, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Rate (JMD)</th>
            <th style={{ padding: '6px 8px', textAlign: 'right', color: '#ffffff', fontSize: 7, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Amount (JMD)</th>
          </tr>
        </thead>
        <tbody>
          {SAMPLE_ITEMS.map((item, i) => (
            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#f9fafb' : '#ffffff' }}>
              <td style={{ padding: '6px 8px', fontSize: 8, fontWeight: 500 }}>{item.name}</td>
              <td style={{ padding: '6px 8px', fontSize: 8, color: '#6b7280' }}>{item.description}</td>
              <td style={{ padding: '6px 8px', fontSize: 8, textAlign: 'center' }}>{item.qty}{item.unit ? ` ${item.unit}` : ''}</td>
              <td style={{ padding: '6px 8px', fontSize: 8, textAlign: 'right' }}>{formatCurrency(item.rate)}</td>
              <td style={{ padding: '6px 8px', fontSize: 8, textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals + Bank Details */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        {/* Bank Details */}
        <div style={{ padding: '10px 12px', backgroundColor: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb', width: '48%' }}>
          <div style={{ fontSize: 7, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Bank Details</div>
          <div style={{ fontSize: 8, color: '#6b7280', lineHeight: 1.6 }}>
            <div>Bank: National Commercial Bank Jamaica</div>
            <div>Branch: Half Way Tree</div>
            <div>Account Name: {companyName}</div>
            <div>Account No: **** **** 4821</div>
            <div>Swift: JABORJKX</div>
          </div>
        </div>

        {/* Totals */}
        <div style={{ width: '45%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', fontSize: 8, borderBottom: '1px solid #e5e7eb' }}>
            <span style={{ color: '#6b7280' }}>Subtotal</span>
            <span style={{ fontWeight: 500 }}>{formatCurrency(SUBTOTAL)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', fontSize: 8, borderBottom: '1px solid #e5e7eb' }}>
            <span style={{ color: '#6b7280' }}>GCT ({GCT_RATE * 100}%)</span>
            <span style={{ fontWeight: 500 }}>{formatCurrency(GCT_AMOUNT)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', fontSize: 12, fontWeight: 800, backgroundColor: primaryColor, color: contrastText(primaryColor), borderRadius: 4, marginTop: 6 }}>
            <span>TOTAL (JMD)</span>
            <span>{formatCurrency(TOTAL)}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: 10 }}>
        {termsAndConditions && (
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 7, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Terms & Conditions</div>
            <div style={{ fontSize: 7, color: '#6b7280', lineHeight: 1.4 }}>{termsAndConditions}</div>
          </div>
        )}
        {defaultNotes && (
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 7, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Notes</div>
            <div style={{ fontSize: 7, color: '#6b7280', lineHeight: 1.4 }}>{defaultNotes}</div>
          </div>
        )}
        {footerText && (
          <div style={{ textAlign: 'center', fontSize: 8, color: primaryColor, marginTop: 10, fontWeight: 600, padding: '6px 0', borderTop: `1px solid ${colorWithOpacity(primaryColor, 0.2)}` }}>{footerText}</div>
        )}
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function InvoicePreview(props: InvoicePreviewProps) {
  const { template } = props;

  const renderTemplate = () => {
    switch (template) {
      case 'classic':
        return <ClassicTemplate {...props} />;
      case 'modern':
        return <ModernTemplate {...props} />;
      case 'minimal':
        return <MinimalTemplate {...props} />;
      case 'professional':
        return <ProfessionalTemplate {...props} />;
      default:
        return <ClassicTemplate {...props} />;
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
      }}
    >
      {/* Template Label */}
      <div
        style={{
          marginBottom: 8,
          fontSize: 12,
          fontWeight: 600,
          color: '#6b7280',
          textTransform: 'capitalize',
        }}
      >
        {template} Template Preview
      </div>

      {/* Paper container - scaled A4 */}
      <div
        className="dark:shadow-[0_2px_20px_rgba(0,0,0,0.4)]"
        style={{
          width: '100%',
          maxWidth: 480,
          aspectRatio: '210 / 297',
          backgroundColor: '#ffffff',
          borderRadius: 4,
          boxShadow: '0 1px 15px rgba(0, 0, 0, 0.1), 0 0 1px rgba(0, 0, 0, 0.15)',
          padding: 20,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {renderTemplate()}
      </div>

      {/* Size hint */}
      <div
        style={{
          marginTop: 6,
          fontSize: 11,
          color: '#9ca3af',
        }}
      >
        Scaled preview (A4 paper size)
      </div>
    </div>
  );
}

export type { InvoicePreviewProps };

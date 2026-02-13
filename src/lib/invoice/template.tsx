import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from '@react-pdf/renderer';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface InvoicePdfProps {
  invoiceNumber: string;
  invoiceDate: string; // DD/MM/YYYY
  dueDate: string; // DD/MM/YYYY
  supplyDate?: string; // DD/MM/YYYY (booking date, if linked)

  // Seller (organisation)
  orgName: string;
  companyName?: string;
  companyAddress?: string;
  vatNumber?: string;
  companyRegistrationNumber?: string;
  contactEmail: string;
  logoUrl?: string;
  primaryColour: string;
  accentColour: string;

  // Buyer (client)
  clientName: string;
  clientEmail: string;

  // Line items
  lineItems: {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];

  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  currency: string;
  paymentStatus: string;

  // Footer
  notes?: string;
  terms?: string;
  bookingReference?: string;
}

// ---------------------------------------------------------------------------
// Currency formatting
// ---------------------------------------------------------------------------

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: '\u00a3',
  EUR: '\u20ac',
  USD: '$',
};

function formatCurrency(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency.toUpperCase()] ?? currency + ' ';
  return `${symbol}${amount.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Payment status badge colours
// ---------------------------------------------------------------------------

interface BadgeColours {
  background: string;
  text: string;
}

function getStatusBadgeColours(status: string): BadgeColours {
  switch (status.toLowerCase()) {
    case 'paid':
      return { background: '#dcfce7', text: '#166534' };
    case 'pending':
      return { background: '#fef3c7', text: '#92400e' };
    case 'refunded':
      return { background: '#f3f4f6', text: '#374151' };
    case 'cancelled':
      return { background: '#fee2e2', text: '#991b1b' };
    default:
      return { background: '#f3f4f6', text: '#374151' };
  }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1a1a1a',
    lineHeight: 1.4,
  },

  // Top colour bar
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: 'column',
    maxWidth: '50%',
  },
  logo: {
    width: 60,
    marginBottom: 6,
  },
  orgNameText: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
  },
  headerRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  invoiceTitle: {
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
  },
  headerDetail: {
    fontSize: 9,
    color: '#4b5563',
    marginBottom: 2,
  },
  headerDetailValue: {
    fontFamily: 'Helvetica-Bold',
    color: '#1a1a1a',
  },

  // From / To
  fromToRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  fromToColumn: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  fromToText: {
    fontSize: 10,
    marginBottom: 2,
  },

  // Line items table
  table: {
    marginBottom: 24,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  tableHeaderCell: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
    borderBottomStyle: 'solid',
  },
  tableRowAlt: {
    backgroundColor: '#fafafa',
  },
  tableCell: {
    fontSize: 10,
  },
  colDescription: {
    flex: 3,
  },
  colQty: {
    flex: 0.7,
    textAlign: 'right',
  },
  colUnitPrice: {
    flex: 1.3,
    textAlign: 'right',
  },
  colTotal: {
    flex: 1.3,
    textAlign: 'right',
  },

  // Totals
  totalsContainer: {
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  totalsBox: {
    width: 220,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  totalsLabel: {
    fontSize: 10,
    color: '#4b5563',
  },
  totalsValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },
  totalHighlight: {
    borderRadius: 3,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 4,
  },
  totalHighlightLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
  },
  totalHighlightValue: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
  },
  statusBadge: {
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  // Footer
  footer: {
    marginTop: 'auto' as unknown as number,
  },
  footerSection: {
    marginBottom: 10,
  },
  footerLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  footerText: {
    fontSize: 9,
    color: '#4b5563',
    lineHeight: 1.5,
  },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InvoiceTemplate(props: InvoicePdfProps) {
  const {
    invoiceNumber,
    invoiceDate,
    dueDate,
    supplyDate,
    orgName,
    companyName,
    companyAddress,
    vatNumber,
    companyRegistrationNumber,
    contactEmail,
    logoUrl,
    primaryColour,
    accentColour,
    clientName,
    clientEmail,
    lineItems,
    subtotal,
    vatRate,
    vatAmount,
    total,
    currency,
    paymentStatus,
    notes,
    terms,
    bookingReference,
  } = props;

  const badge = getStatusBadgeColours(paymentStatus);

  return (
    <Document
      title={`Invoice ${invoiceNumber}`}
      author={companyName ?? orgName}
      subject={`Invoice ${invoiceNumber} for ${clientName}`}
    >
      <Page size="A4" style={styles.page}>
        {/* Coloured top border bar */}
        <View
          style={[styles.topBar, { backgroundColor: primaryColour }]}
          fixed
        />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {logoUrl ? (
              <Image src={logoUrl} style={styles.logo} />
            ) : null}
            <Text style={styles.orgNameText}>{orgName}</Text>
          </View>

          <View style={styles.headerRight}>
            <Text style={[styles.invoiceTitle, { color: primaryColour }]}>
              INVOICE
            </Text>
            <Text style={styles.headerDetail}>
              Invoice No:{' '}
              <Text style={styles.headerDetailValue}>{invoiceNumber}</Text>
            </Text>
            <Text style={styles.headerDetail}>
              Date:{' '}
              <Text style={styles.headerDetailValue}>{invoiceDate}</Text>
            </Text>
            <Text style={styles.headerDetail}>
              Due:{' '}
              <Text style={styles.headerDetailValue}>{dueDate}</Text>
            </Text>
            {supplyDate ? (
              <Text style={styles.headerDetail}>
                Supply Date:{' '}
                <Text style={styles.headerDetailValue}>{supplyDate}</Text>
              </Text>
            ) : null}
          </View>
        </View>

        {/* From / To */}
        <View style={styles.fromToRow}>
          <View style={styles.fromToColumn}>
            <Text style={styles.sectionLabel}>From</Text>
            <Text style={[styles.fromToText, { fontFamily: 'Helvetica-Bold' }]}>
              {companyName ?? orgName}
            </Text>
            {companyAddress
              ? companyAddress.split('\n').map((line, i) => (
                  <Text key={i} style={styles.fromToText}>
                    {line}
                  </Text>
                ))
              : null}
            {vatNumber ? (
              <Text style={styles.fromToText}>VAT: {vatNumber}</Text>
            ) : null}
            {companyRegistrationNumber ? (
              <Text style={styles.fromToText}>
                Co. Reg: {companyRegistrationNumber}
              </Text>
            ) : null}
            <Text style={styles.fromToText}>{contactEmail}</Text>
          </View>

          <View style={styles.fromToColumn}>
            <Text style={styles.sectionLabel}>To</Text>
            <Text style={[styles.fromToText, { fontFamily: 'Helvetica-Bold' }]}>
              {clientName}
            </Text>
            <Text style={styles.fromToText}>{clientEmail}</Text>
          </View>
        </View>

        {/* Line items table */}
        <View style={styles.table}>
          {/* Table header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colDescription]}>
              Description
            </Text>
            <Text style={[styles.tableHeaderCell, styles.colQty]}>Qty</Text>
            <Text style={[styles.tableHeaderCell, styles.colUnitPrice]}>
              Unit Price
            </Text>
            <Text style={[styles.tableHeaderCell, styles.colTotal]}>Total</Text>
          </View>

          {/* Table rows */}
          {lineItems.map((item, index) => (
            <View
              key={index}
              style={[
                styles.tableRow,
                index % 2 === 1 ? styles.tableRowAlt : {},
              ]}
            >
              <Text style={[styles.tableCell, styles.colDescription]}>
                {item.description}
              </Text>
              <Text style={[styles.tableCell, styles.colQty]}>
                {item.quantity}
              </Text>
              <Text style={[styles.tableCell, styles.colUnitPrice]}>
                {formatCurrency(item.unitPrice, currency)}
              </Text>
              <Text style={[styles.tableCell, styles.colTotal]}>
                {formatCurrency(item.total, currency)}
              </Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsContainer}>
          <View style={styles.totalsBox}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsValue}>
                {formatCurrency(subtotal, currency)}
              </Text>
            </View>

            {vatRate > 0 ? (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>VAT at {vatRate}%</Text>
                <Text style={styles.totalsValue}>
                  {formatCurrency(vatAmount, currency)}
                </Text>
              </View>
            ) : null}

            <View
              style={[
                styles.totalsRow,
                styles.totalHighlight,
                { backgroundColor: accentColour },
              ]}
            >
              <Text style={styles.totalHighlightLabel}>Total</Text>
              <Text style={styles.totalHighlightValue}>
                {formatCurrency(total, currency)}
              </Text>
            </View>

            {/* Payment status badge */}
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: badge.background },
              ]}
            >
              <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                {paymentStatus.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          {bookingReference ? (
            <View style={styles.footerSection}>
              <Text style={styles.footerLabel}>Booking Reference</Text>
              <Text style={styles.footerText}>{bookingReference}</Text>
            </View>
          ) : null}

          {notes ? (
            <View style={styles.footerSection}>
              <Text style={styles.footerLabel}>Notes</Text>
              <Text style={styles.footerText}>{notes}</Text>
            </View>
          ) : null}

          {terms ? (
            <View style={styles.footerSection}>
              <Text style={styles.footerLabel}>Terms / Payment Instructions</Text>
              {terms.split('\n').map((line, i) => (
                <Text key={i} style={styles.footerText}>
                  {line}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      </Page>
    </Document>
  );
}

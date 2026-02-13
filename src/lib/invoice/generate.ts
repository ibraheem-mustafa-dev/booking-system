import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import { createElement, type ReactElement } from 'react';
import { InvoiceTemplate } from './template';
import type { InvoicePdfProps } from './template';

/**
 * Generate an invoice PDF as a Buffer.
 * Used for email attachments and API responses.
 */
export async function generateInvoicePdf(
  props: InvoicePdfProps,
): Promise<Buffer> {
  // InvoiceTemplate returns a <Document> element. The cast is needed because
  // renderToBuffer's type signature expects ReactElement<DocumentProps> but
  // createElement produces ReactElement<InvoicePdfProps> (the wrapper's own props).
  const element = createElement(
    InvoiceTemplate,
    props,
  ) as unknown as ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(element);
  // renderToBuffer declares Promise<Buffer> but the runtime value may be
  // a Uint8Array in some environments. Buffer.from() handles both safely.
  return Buffer.from(buffer);
}

export type { InvoicePdfProps } from './template';

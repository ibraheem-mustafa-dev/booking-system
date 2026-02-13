import { describe, it, expect } from 'vitest';
import { generateIcsFile, type IcsEventParams } from './ics';

// ---------------------------------------------------------------------------
// Helper: default event params for tests
// ---------------------------------------------------------------------------

function defaultParams(overrides?: Partial<IcsEventParams>): IcsEventParams {
  return {
    summary: 'Discovery Call',
    description: 'Initial consultation to discuss project requirements.',
    startAt: new Date('2026-03-15T10:00:00Z'),
    endAt: new Date('2026-03-15T10:30:00Z'),
    location: '123 High Street, London',
    organiserName: 'Bean',
    organiserEmail: 'bean@smallgiantsstudio.co.uk',
    attendeeName: 'Jane Smith',
    attendeeEmail: 'jane@example.com',
    uid: 'test-event-uid-001',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateIcsFile', () => {
  it('returns a valid iCalendar string with BEGIN/END markers', () => {
    const ics = generateIcsFile(defaultParams());

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('END:VEVENT');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('PRODID:-//Small Giants Studio//Booking System//EN');
    expect(ics).toContain('METHOD:REQUEST');
  });

  it('contains correct event details', () => {
    const ics = generateIcsFile(defaultParams());

    expect(ics).toContain('SUMMARY:Discovery Call');
    expect(ics).toContain('DTSTART:20260315T100000Z');
    expect(ics).toContain('DTEND:20260315T103000Z');
    expect(ics).toContain('LOCATION:123 High Street\\, London');
    expect(ics).toContain('UID:test-event-uid-001');
    expect(ics).toContain('STATUS:CONFIRMED');
  });

  it('includes organiser and attendee', () => {
    const ics = generateIcsFile(defaultParams());

    expect(ics).toContain('ORGANIZER;CN=Bean:mailto:bean@smallgiantsstudio.co.uk');
    expect(ics).toContain('ATTENDEE;CN=Jane Smith;RSVP=TRUE:mailto:jane@example.com');
  });

  it('handles missing optional location', () => {
    const ics = generateIcsFile(defaultParams({ location: undefined }));

    expect(ics).not.toContain('LOCATION:');
    // Should still be valid
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('SUMMARY:Discovery Call');
  });

  it('handles missing optional description', () => {
    const ics = generateIcsFile(defaultParams({ description: undefined }));

    expect(ics).not.toContain('DESCRIPTION:');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('SUMMARY:Discovery Call');
  });

  it('escapes special characters in text fields', () => {
    const ics = generateIcsFile(
      defaultParams({
        summary: 'Call; with, special\\chars',
        description: 'Line one\nLine two\nLine three',
        location: 'Room A, Floor 2; Building B',
      }),
    );

    // Commas escaped
    expect(ics).toContain('SUMMARY:Call\\; with\\, special\\\\chars');
    // Newlines escaped
    expect(ics).toContain('DESCRIPTION:Line one\\nLine two\\nLine three');
    // Location escaping
    expect(ics).toContain('LOCATION:Room A\\, Floor 2\\; Building B');
  });

  it('uses CRLF line endings as required by RFC 5545', () => {
    const ics = generateIcsFile(defaultParams());

    // Every line should end with \r\n
    const lines = ics.split('\r\n');
    // Last element is empty string after trailing \r\n
    expect(lines[lines.length - 1]).toBe('');
    // First line should be BEGIN:VCALENDAR
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
  });
});

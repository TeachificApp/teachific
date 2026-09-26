/**
 * Escape an untrusted value for a CSV cell without allowing spreadsheet formulas
 * to execute when the CSV is opened in Excel, Sheets, or similar software.
 */
export function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  const raw = String(value ?? "");
  // Formula engines can ignore leading whitespace/control characters, so preserve
  // the raw value after a literal apostrophe whenever it begins with a formula sigil.
  const safe = /^\s*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

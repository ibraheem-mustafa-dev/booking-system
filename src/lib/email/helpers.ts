// ---------------------------------------------------------------------------
// Email template helpers
// ---------------------------------------------------------------------------

/**
 * Replace `{{key}}` placeholders in a template string with values from a
 * record. Unknown placeholders (keys not present in `values`) are left
 * untouched so the host can see which tokens they still need to fill in.
 */
export function replacePlaceholders(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      return values[key];
    }
    return match;
  });
}

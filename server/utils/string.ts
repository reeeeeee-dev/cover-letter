/**
 * String utility functions
 */

/**
 * Sanitize a string for use in filenames
 * Replaces non-alphanumeric characters with hyphens
 */
export function sanitizeFilename(input: string): string {
  return input.replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

/**
 * Replace all occurrences of a placeholder in a string
 */
export function replacePlaceholders(
  template: string,
  placeholders: Record<string, string>
): string {
  let result = template
  for (const [key, value] of Object.entries(placeholders)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    result = result.replace(regex, value)
  }
  return result
}

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
  console.log('replacePlaceholders called with:', {
    templateLength: template.length,
    placeholderKeys: Object.keys(placeholders),
    placeholderValues: Object.values(placeholders)
  })
  
  for (const [key, value] of Object.entries(placeholders)) {
    const pattern = `{{${key}}}`
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    const matches = result.match(regex)
    console.log(`Replacing ${pattern}:`, {
      foundMatches: matches?.length || 0,
      replacementValue: value,
      regexPattern: regex.toString()
    })
    result = result.replace(regex, value)
    
    // Verify replacement worked
    if (result.includes(pattern)) {
      console.warn(`Warning: Placeholder ${pattern} still exists after replacement!`)
    }
  }
  
  console.log('replacePlaceholders result length:', result.length)
  return result
}

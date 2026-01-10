/**
 * File utility functions
 */

import { sanitizeFilename } from './string'

/**
 * Generate a filename for cover letter download
 */
export function generateCoverLetterFilename(companyName: string, extension: string): string {
  const sanitized = sanitizeFilename(companyName)
  return `cover-letter-${sanitized}.${extension}`
}

/**
 * Get content type for a file extension
 */
export function getContentType(extension: string): string {
  const contentTypes: Record<string, string> = {
    pdf: 'application/pdf',
    html: 'text/html',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  }
  return contentTypes[extension.toLowerCase()] || 'application/octet-stream'
}

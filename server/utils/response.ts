/**
 * Response utility functions
 */

import type { H3Event } from 'h3'
import { getContentType, generateCoverLetterFilename } from './file'

/**
 * Set appropriate headers for file download response
 */
export function setFileDownloadHeaders(
  event: H3Event,
  filename: string,
  extension: string,
  contentType?: string
): void {
  const finalContentType = contentType || getContentType(extension)
  setHeader(event, 'Content-Type', finalContentType)
  setHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)
}

/**
 * Return a file download response with proper headers
 */
export function sendFileResponse(
  event: H3Event,
  content: string | ArrayBuffer,
  companyName: string,
  extension: string,
  contentType?: string
): string | ArrayBuffer {
  const filename = generateCoverLetterFilename(companyName, extension)
  setFileDownloadHeaders(event, filename, extension, contentType)
  return content
}

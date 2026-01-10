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
 * For Cloudflare Workers, we need to return a Response object for binary data
 */
export function sendFileResponse(
  event: H3Event,
  content: string | ArrayBuffer | Uint8Array,
  companyName: string,
  extension: string,
  contentType?: string
): string | Response {
  const filename = generateCoverLetterFilename(companyName, extension)
  const finalContentType = contentType || getContentType(extension)
  
  // For binary data (ArrayBuffer/Uint8Array), return a Response object
  // This is required for proper binary handling in Cloudflare Workers
  if (content instanceof ArrayBuffer || content instanceof Uint8Array) {
    // Convert to Uint8Array for validation and Response creation
    const uint8Array = content instanceof ArrayBuffer 
      ? new Uint8Array(content)
      : content
    
    // Validate that the buffer is not empty
    if (uint8Array.length === 0) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Generated PDF is empty. PDF conversion may have failed. Please check Cloudflare Workers logs for errors.',
      })
    }
    
    // Return a Response object for binary data
    // Response constructor accepts ArrayBuffer, Uint8Array, or other TypedArray
    // This ensures proper handling in Cloudflare Workers
    return new Response(content instanceof ArrayBuffer ? content : uint8Array, {
      headers: {
        'Content-Type': finalContentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(uint8Array.length),
      },
    })
  }
  
  // For string content (HTML), use standard header setting
  setFileDownloadHeaders(event, filename, extension, contentType)
  return content
}

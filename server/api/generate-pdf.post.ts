/**
 * Generate PDF API endpoint
 * Handles cover letter generation and PDF conversion using Puppeteer
 */

import type { GeneratePdfRequest } from '~/server/types'
import { TemplateService } from '~/server/services/template'
import { createPuppeteerPdfService } from '~/server/services/pdf-conversion-puppeteer'
import { getBrowserBinding } from '~/server/utils/cloudflare'
import { sendFileResponse } from '~/server/utils/response'

export default defineEventHandler(async (event) => {
  try {
    // Validate request body
    const body = await readBody<GeneratePdfRequest>(event)
    const companyName = body?.company?.trim()

    if (!companyName) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Company name is required',
      })
    }

    // Initialize services
    const templateService = new TemplateService()

    // Load and process template
    // Uses ASSETS binding in Cloudflare Workers, falls back to HTTP fetch
    let htmlContent: string
    try {
      htmlContent = await templateService.loadTemplate(event, 'base.html')
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw createError({
        statusCode: 500,
        statusMessage:
          `Failed to load template file. Make sure base.html is in the public directory. ${errorMessage}`,
      })
    }

    // Replace placeholders
    const processedHtml = templateService.replacePlaceholders(htmlContent, {
      COMPANY: companyName,
    })

    // Get browser binding from Cloudflare environment
    // The binding name 'MYBROWSER' should match what's in wrangler.toml
    // Works in both Cloudflare Workers (production) and wrangler dev (local development)
    const browserBinding = getBrowserBinding(event, 'MYBROWSER')
    
    console.log('Browser binding check:', {
      hasBinding: !!browserBinding,
      bindingType: browserBinding ? typeof browserBinding : 'null',
    })

    // Create Puppeteer PDF service
    // Requires browser binding (available in Workers or when using wrangler dev)
    const pdfService = createPuppeteerPdfService(browserBinding)

    // If no browser binding, return HTML as fallback
    if (!pdfService) {
      console.warn('Browser binding (MYBROWSER) not available, returning HTML')
      console.warn('For local development, use: wrangler dev (instead of yarn dev)')
      console.warn('For production: Ensure browser binding is configured in Cloudflare Dashboard:')
      console.warn('  1. Go to Workers & Pages > Your Worker > Settings > Bindings')
      console.warn('  2. Add a Browser binding named "MYBROWSER"')
      console.warn('  3. Ensure Browser Rendering API is enabled on your account')
      return sendFileResponse(event, processedHtml, companyName, 'html')
    }

    // Convert to PDF using Puppeteer
    try {
      console.log('Starting PDF conversion...')
      const pdfArrayBuffer = await pdfService.convertHtmlToPdf(processedHtml)
      
      // Validate PDF buffer
      if (!pdfArrayBuffer || pdfArrayBuffer.byteLength === 0) {
        console.error('PDF conversion returned empty buffer')
        throw new Error('PDF conversion returned empty buffer')
      }
      
      console.log(`PDF conversion successful. Buffer size: ${pdfArrayBuffer.byteLength} bytes`)
      return sendFileResponse(event, pdfArrayBuffer, companyName, 'pdf')
    } catch (conversionError: unknown) {
      console.error('PDF conversion error:', conversionError)
      const errorMessage = conversionError instanceof Error 
        ? conversionError.message 
        : 'Unknown conversion error'
      console.error('Error details:', errorMessage)

      // Fallback: return HTML if PDF conversion fails
      console.warn('Falling back to HTML format due to conversion error')
      return sendFileResponse(event, processedHtml, companyName, 'html')
    }
  } catch (error: unknown) {
    // Re-throw H3 errors (they already have statusCode)
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    // Handle unexpected errors
    console.error('Error generating PDF:', error)
    const errorMessage = error instanceof Error ? error.message : 'Error generating PDF'
    throw createError({
      statusCode: 500,
      statusMessage: errorMessage,
    })
  }
})

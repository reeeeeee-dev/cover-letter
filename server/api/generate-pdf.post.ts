/**
 * Generate PDF API endpoint
 * Handles cover letter generation from PPTX template with placeholder replacement
 * Converts PPTX directly to PDF using external API (ConvertHub - 50 free calls)
 */

import type { GeneratePdfRequest } from '~/server/types'
import { PptxProcessingService } from '~/server/services/pptx-processing'
import { PptxToPdfDirectService } from '~/server/services/pptx-to-pdf-direct'
import { sendFileResponse } from '~/server/utils/response'
import { getSecret } from '~/server/utils/cloudflare'
import { getCachedPdf, cachePdf } from '~/server/services/r2-cache'

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

    // Check R2 cache first
    console.log(`Checking cache for company: ${companyName}`)
    const cachedPdf = await getCachedPdf(event, companyName)

    if (cachedPdf && cachedPdf.byteLength > 0) {
      console.log(`Serving cached PDF for company: ${companyName} (${cachedPdf.byteLength} bytes)`)
      return sendFileResponse(event, cachedPdf, companyName, 'pdf')
    }

    console.log(`Cache miss for company: ${companyName}. Generating new PDF...`)

    // Get API key from Cloudflare Workers secrets/environment
    // ConvertHub: Get free API key (50 free calls) from https://converthub.com
    // Set via: wrangler secret put CONVERSION_API_KEY
    // Secrets set via "wrangler secret put" are securely stored and accessible via event.context.cloudflare.env
    let conversionApiKey = getSecret(event, 'CONVERSION_API_KEY')
    
    if (conversionApiKey) {
      console.log('Found CONVERSION_API_KEY in Cloudflare environment')
    } else {
      // Fallback for local development
      try {
        const runtimeConfig = useRuntimeConfig(event)
        if (runtimeConfig.conversionApiKey) {
          conversionApiKey = runtimeConfig.conversionApiKey
          console.log('Using CONVERSION_API_KEY from runtime config (local dev)')
        }
      } catch {
        // Runtime config might not be available
      }
      
      if (!conversionApiKey && process.env.CONVERSION_API_KEY) {
        conversionApiKey = process.env.CONVERSION_API_KEY
        console.log('Using CONVERSION_API_KEY from process.env (local dev)')
      }
    }

    if (!conversionApiKey) {
      throw createError({
        statusCode: 500,
        statusMessage:
          'Conversion API key not configured. Please set the CONVERSION_API_KEY secret in Cloudflare. ' +
          'Run: wrangler secret put CONVERSION_API_KEY\n' +
          'Get a free API key (50 free calls) from https://converthub.com',
      })
    }

    // Initialize PPTX processing service
    const pptxService = new PptxProcessingService()

    // Load and process PPTX template (replace placeholders)
    let processedPptxBuffer: ArrayBuffer
    try {
      console.log('Loading PPTX template and replacing placeholders...')
      processedPptxBuffer = await pptxService.processTemplate(
        event,
        'base.pptx',
        {
          COMPANY: companyName,
        }
      )
      console.log(`PPTX template processed. Buffer size: ${processedPptxBuffer.byteLength} bytes`)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Error processing PPTX template:', errorMessage)
      throw createError({
        statusCode: 500,
        statusMessage:
          `Failed to load or process template file. Make sure base.pptx is in the public directory. ${errorMessage}`,
      })
    }

    // Validate processed PPTX buffer
    if (!processedPptxBuffer || processedPptxBuffer.byteLength === 0) {
      console.error('PPTX processing returned empty buffer')
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to process PPTX template',
      })
    }

    // Initialize direct PPTX to PDF conversion service using ConvertHub (manual API calls)
    const conversionService = new PptxToPdfDirectService({
      apiKey: conversionApiKey,
    })

    // Convert processed PPTX directly to PDF using external API
    try {
      console.log('Starting direct PPTX to PDF conversion via ConvertHub...')
      const pdfArrayBuffer = await conversionService.convertPptxToPdf(processedPptxBuffer)
      
      // Validate PDF buffer
      if (!pdfArrayBuffer || pdfArrayBuffer.byteLength === 0) {
        console.error('PDF conversion returned empty buffer')
        throw new Error('PDF conversion returned empty buffer')
      }
      
      console.log(`PDF conversion successful. Buffer size: ${pdfArrayBuffer.byteLength} bytes`)
      
      // Cache the generated PDF in R2 storage for future requests
      await cachePdf(event, companyName, pdfArrayBuffer)
      
      return sendFileResponse(event, pdfArrayBuffer, companyName, 'pdf')
    } catch (conversionError: unknown) {
      console.error('PDF conversion error:', conversionError)
      const errorMessage = conversionError instanceof Error 
        ? conversionError.message 
        : 'Unknown conversion error'
      console.error('Error details:', errorMessage)

      // If conversion fails, provide helpful error message
      throw createError({
        statusCode: 500,
        statusMessage: `PDF conversion failed: ${errorMessage}. ` +
          'Please check your ConvertHub API key and ensure you have available API calls. ' +
          'Get a free API key (50 free calls) from https://converthub.com',
      })
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

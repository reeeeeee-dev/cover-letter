/**
 * Type definitions for the application
 */

export interface GeneratePdfRequest {
  company: string
}

export interface PdfConversionResult {
  pdf?: string // base64 encoded PDF
  fileUrl?: string // URL to the PDF file
  error?: string
}

export interface PdfConversionService {
  convertHtmlToPdf(html: string): Promise<ArrayBuffer>
}

import type { H3Event } from 'h3'

export interface TemplateService {
  loadTemplate(event: H3Event, templateName?: string): Promise<string>
  replacePlaceholders(template: string, data: Record<string, string>): string
}

// Re-export Cloudflare types
export * from './cloudflare'

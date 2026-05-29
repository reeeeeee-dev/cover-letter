/**
 * Generate Text API endpoint
 * Processes the PPTX template with placeholder replacement and extracts plain text
 * for copy-to-clipboard usage. Skips PDF conversion entirely.
 */

import PizZip from 'pizzip'
import type { GeneratePdfRequest } from '~/server/types'
import { PptxProcessingService } from '~/server/services/pptx-processing'

/**
 * Extract plain text from a processed PPTX buffer.
 * Reads each slide XML, concatenates <a:t> text runs, and inserts newlines
 * at paragraph (<a:p>) boundaries.
 */
function extractTextFromPptx(pptxBuffer: ArrayBuffer): string {
  const zip = new PizZip(pptxBuffer)

  // Collect slide files and sort by slide number (slide1.xml, slide2.xml, ...)
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = Number(a.match(/slide(\d+)\.xml$/)?.[1] ?? 0)
      const numB = Number(b.match(/slide(\d+)\.xml$/)?.[1] ?? 0)
      return numA - numB
    })

  const slideTexts: string[] = []

  for (const slideFile of slideFiles) {
    const file = zip.file(slideFile)
    if (!file) continue

    const xml = file.asText()

    // Split on paragraph boundaries to preserve line breaks between paragraphs
    const paragraphs = xml.split(/<a:p[\s>]/)
    const lines: string[] = []

    for (const paragraph of paragraphs) {
      // Extract all <a:t>...</a:t> text runs within this paragraph
      const matches = paragraph.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)
      const parts: string[] = []
      for (const match of matches) {
        parts.push(decodeXmlEntities(match[1] ?? ''))
      }
      const line = parts.join('').trim()
      if (line) lines.push(line)
    }

    if (lines.length) slideTexts.push(lines.join('\n'))
  }

  return slideTexts.join('\n\n').trim()
}

/**
 * Extract the letter body plus signature from the full slide text.
 * The template surrounds the letter with a contact-info header at the top
 * and a name-banner slide (ALL CAPS) at the bottom, with a "----" divider
 * separating the closing from the typed signature. Output keeps the
 * salutation through the typed signature (including the divider) and drops
 * only the trailing ALL-CAPS name banner.
 */
function extractLetterBody(fullText: string): string {
  const lines = fullText.split('\n')

  const startIdx = lines.findIndex((line) => /^\s*Dear\b/i.test(line))
  if (startIdx === -1) {
    return fullText.trim()
  }

  const kept: string[] = []
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (isAllCapsBanner(line)) continue
    kept.push(line)
  }

  return kept
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function isAllCapsBanner(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  const letters = trimmed.replace(/[^A-Za-z]/g, '')
  if (letters.length < 2) return false
  return letters === letters.toUpperCase()
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, '&')
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<GeneratePdfRequest>(event)
    const companyName = body?.company?.trim()

    if (!companyName) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Company name is required',
      })
    }

    const pptxService = new PptxProcessingService()

    let processedPptxBuffer: ArrayBuffer
    try {
      processedPptxBuffer = await pptxService.processTemplate(
        event,
        'base.pptx',
        {
          COMPANY: companyName,
        }
      )
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Error processing PPTX template:', errorMessage)
      throw createError({
        statusCode: 500,
        statusMessage:
          `Failed to load or process template file. Make sure base.pptx is in the public directory. ${errorMessage}`,
      })
    }

    if (!processedPptxBuffer || processedPptxBuffer.byteLength === 0) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to process PPTX template',
      })
    }

    const fullText = extractTextFromPptx(processedPptxBuffer)
    const text = extractLetterBody(fullText)

    if (!text) {
      throw createError({
        statusCode: 500,
        statusMessage: 'No letter body could be extracted from the template',
      })
    }

    return { text }
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('Error generating cover letter text:', error)
    const errorMessage = error instanceof Error ? error.message : 'Error generating text'
    throw createError({
      statusCode: 500,
      statusMessage: errorMessage,
    })
  }
})

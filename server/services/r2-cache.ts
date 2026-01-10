/**
 * R2 Cache Service
 * Handles caching of generated PDFs in Cloudflare R2 storage
 */

import type { H3Event } from "h3";
import type { R2Binding } from "~/server/types/cloudflare";
import { getR2Binding } from "~/server/utils/cloudflare";

/**
 * Generate a normalized cache key from a company name
 * Converts to lowercase, removes special characters, and replaces spaces with hyphens
 */
export function generateCacheKey(companyName: string): string {
  return companyName
    .toLowerCase()
    .trim()
    // Replace spaces and common separators with hyphens
    .replace(/[\s_]+/g, "-")
    // Remove special characters except hyphens
    .replace(/[^a-z0-9-]/g, "")
    // Replace multiple hyphens with single hyphen
    .replace(/-+/g, "-")
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, "")
    || "unknown";
}

/**
 * Get cached PDF from R2 storage
 */
export async function getCachedPdf(
  event: H3Event,
  companyName: string
): Promise<ArrayBuffer | null> {
  const r2 = getR2Binding(event, "PDF_CACHE");
  if (!r2) {
    console.warn(
      "R2 binding not available, cache check skipped. " +
      "Make sure the R2 bucket 'cover-letter-pdfs' exists. " +
      "Create it with: wrangler r2 bucket create cover-letter-pdfs"
    );
    return null;
  }

  try {
    const cacheKey = generateCacheKey(companyName);
    const key = `pdfs/${cacheKey}.pdf`;

    console.log(`Checking R2 cache for key: ${key}`);

    const object = await r2.get(key);

    if (!object) {
      console.log(`Cache miss for company: ${companyName} (key: ${key})`);
      return null;
    }

    console.log(`Cache hit for company: ${companyName} (key: ${key}, size: ${object.size} bytes)`);

    // Convert R2 object body to ArrayBuffer
    const arrayBuffer = await object.arrayBuffer();
    return arrayBuffer;
  } catch (error) {
    console.error(`Error reading from R2 cache: ${error instanceof Error ? error.message : "Unknown error"}`);
    // Don't throw - if cache read fails, continue with generation
    return null;
  }
}

/**
 * Store PDF in R2 cache
 */
export async function cachePdf(
  event: H3Event,
  companyName: string,
  pdfBuffer: ArrayBuffer
): Promise<void> {
  const r2 = getR2Binding(event, "PDF_CACHE");
  if (!r2) {
    console.warn(
      "R2 binding not available, caching skipped. " +
      "Make sure the R2 bucket 'cover-letter-pdfs' exists. " +
      "Create it with: wrangler r2 bucket create cover-letter-pdfs"
    );
    return;
  }

  try {
    const cacheKey = generateCacheKey(companyName);
    const key = `pdfs/${cacheKey}.pdf`;

    console.log(`Storing PDF in R2 cache with key: ${key} (size: ${pdfBuffer.byteLength} bytes)`);

    await r2.put(key, pdfBuffer, {
      httpMetadata: {
        contentType: "application/pdf",
        cacheControl: "public, max-age=31536000", // Cache for 1 year
      },
      customMetadata: {
        companyName: companyName,
        generatedAt: new Date().toISOString(),
      },
    });

    console.log(`Successfully cached PDF for company: ${companyName}`);
  } catch (error) {
    console.error(
      `Error storing PDF in R2 cache: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    // Don't throw - if cache write fails, the PDF was still generated successfully
  }
}

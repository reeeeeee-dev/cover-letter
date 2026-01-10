/**
 * PDF Conversion Service using Cloudflare Puppeteer
 * Works with Cloudflare Workers Browser Rendering API
 * Also works locally when using `wrangler dev` (provides browser binding)
 */

import type { BrowserBinding } from "~/server/types/cloudflare";

export interface PuppeteerPdfOptions {
  format?: "A4" | "Letter" | "Legal" | "Tabloid" | "Ledger";
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  printBackground?: boolean;
  scale?: number;
}

/**
 * PDF Conversion Service using Cloudflare Puppeteer
 * Works in both Cloudflare Workers and local `wrangler dev` environment
 */
export class PuppeteerPdfService {
  private browserBinding: BrowserBinding;
  private options: PuppeteerPdfOptions;

  constructor(browserBinding: BrowserBinding, options?: PuppeteerPdfOptions) {
    this.browserBinding = browserBinding;
    this.options = {
      format: "A4",
      margin: {
        top: "0.5in",
        right: "0.5in",
        bottom: "0.5in",
        left: "0.5in",
      },
      printBackground: true,
      scale: 1,
      ...options,
    };
  }

  async convertHtmlToPdf(html: string): Promise<ArrayBuffer> {
    // Dynamic import for Cloudflare Puppeteer
    const puppeteer = (await import("@cloudflare/puppeteer")).default;

    let browser;
    try {
      // Launch browser using Cloudflare Browser Rendering API
      // Works in both Workers (production) and wrangler dev (local development)
      browser = await puppeteer.launch(
        this.browserBinding as Parameters<typeof puppeteer.launch>[0]
      );

      const page = await browser.newPage();

      // Set content with HTML string
      await page.setContent(html, {
        waitUntil: "networkidle0",
      });

      // Generate PDF with options
      const pdfBuffer = await page.pdf({
        format: this.options.format,
        margin: this.options.margin,
        printBackground: this.options.printBackground,
        scale: this.options.scale,
      });

      return this.convertToArrayBuffer(pdfBuffer);
    } catch (error: unknown) {
      console.error("Puppeteer PDF conversion error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`PDF conversion failed: ${errorMessage}`);
    } finally {
      // Clean up browser instance
      if (browser) {
        await browser.close();
      }
    }
  }

  private convertToArrayBuffer(pdfBuffer: unknown): ArrayBuffer {
    // Convert Buffer/Uint8Array to ArrayBuffer
    // Handle different buffer types that puppeteer might return
    if (pdfBuffer instanceof Uint8Array) {
      // Create a new ArrayBuffer to avoid SharedArrayBuffer issues
      return new Uint8Array(pdfBuffer).buffer;
    }

    // Check for Node.js Buffer (available in some environments)
    if (typeof Buffer !== "undefined" && Buffer.isBuffer(pdfBuffer)) {
      return new Uint8Array(pdfBuffer).buffer;
    }

    // If it's already an ArrayBuffer, return it directly
    if (pdfBuffer instanceof ArrayBuffer) {
      return pdfBuffer;
    }

    // Fallback: convert to ArrayBuffer via Uint8Array
    const uint8Array = new Uint8Array(pdfBuffer as ArrayLike<number>);
    return uint8Array.buffer;
  }
}

/**
 * Factory function to create a Puppeteer PDF conversion service
 * Requires browser binding from Cloudflare Workers environment or wrangler dev
 */
export function createPuppeteerPdfService(
  browserBinding: BrowserBinding | null | undefined,
  options?: PuppeteerPdfOptions
): PuppeteerPdfService | null {
  if (!browserBinding) {
    return null;
  }
  return new PuppeteerPdfService(browserBinding, options);
}

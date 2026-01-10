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
    let page;
    let pdfBuffer: unknown = null;

    try {
      console.log("Launching browser via Cloudflare Browser Rendering API...");
      console.log("Browser binding type:", typeof this.browserBinding);
      console.log("Browser binding keys:", this.browserBinding && typeof this.browserBinding === 'object' ? Object.keys(this.browserBinding) : 'N/A');
      
      // Validate browser binding before attempting to launch
      if (!this.browserBinding) {
        throw new Error("Browser binding is null or undefined. Please configure MYBROWSER binding in Cloudflare Dashboard.");
      }
      
      // Launch browser using Cloudflare Browser Rendering API
      // Works in both Workers (production) and wrangler dev (local development)
      browser = await puppeteer.launch(
        this.browserBinding as Parameters<typeof puppeteer.launch>[0]
      );
      
      if (!browser) {
        throw new Error("Failed to launch browser: puppeteer.launch returned null/undefined");
      }

      console.log("Browser launched successfully. Creating new page...");
      page = await browser.newPage();

      // Set content with HTML string
      // For static HTML content, 'load' or 'domcontentloaded' is more reliable than networkidle
      // networkidle can fail if there are persistent connections or timeouts
      console.log("Setting HTML content...");
      try {
        await page.setContent(html, {
          waitUntil: "load", // Wait for page load event - more reliable for static content
          timeout: 30000, // 30 second timeout
        });
      } catch (timeoutError) {
        console.warn("Page load timeout, trying with domcontentloaded...");
        // Fallback to domcontentloaded if load times out
        await page.setContent(html, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
      }

      // Give the page a moment to fully render, especially for CSS and fonts
      console.log("Waiting for page to render...");
      try {
        await page.evaluate(() => {
          return new Promise<void>((resolve) => {
            // Wait for fonts to load if Font Loading API is available
            if (document.fonts && document.fonts.ready) {
              document.fonts.ready
                .then(() => {
                  // Small delay to ensure all styles are applied
                  setTimeout(resolve, 100);
                })
                .catch(() => {
                  // If fonts fail to load, continue anyway
                  setTimeout(resolve, 300);
                });
            } else {
              // Fallback: wait for stylesheets and rendering
              if (document.readyState === 'complete') {
                setTimeout(resolve, 300);
              } else {
                window.addEventListener('load', () => {
                  setTimeout(resolve, 300);
                }, { once: true });
              }
            }
          });
        });
      } catch (evalError) {
        console.warn("Page evaluation warning (continuing anyway):", evalError);
        // If evaluation fails, wait a short time and continue
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log("Generating PDF...");
      // Generate PDF with options
      // IMPORTANT: Generate PDF BEFORE closing browser/page
      // The page must remain open during PDF generation or the execution context will be destroyed
      pdfBuffer = await page.pdf({
        format: this.options.format,
        margin: this.options.margin,
        printBackground: this.options.printBackground,
        scale: this.options.scale,
        preferCSSPageSize: false, // Use format size instead of CSS @page size
      });

      console.log(`PDF generated. Type: ${typeof pdfBuffer}, Length: ${pdfBuffer ? (pdfBuffer as any).length || (pdfBuffer as any).byteLength || 'unknown' : 'null'}`);
      
      // Convert to ArrayBuffer BEFORE closing browser
      const arrayBuffer = this.convertToArrayBuffer(pdfBuffer);
      
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error("PDF conversion returned empty buffer");
      }
      
      console.log(`Converted to ArrayBuffer. Size: ${arrayBuffer.byteLength} bytes`);
      
      // Clean up page before returning
      if (page) {
        try {
          await page.close();
          console.log("Page closed successfully");
        } catch (closeError) {
          console.warn("Error closing page:", closeError);
          // Don't throw - we already have the PDF
        }
        page = null;
      }

      // Clean up browser
      if (browser) {
        try {
          await browser.close();
          console.log("Browser closed successfully");
        } catch (closeError) {
          console.warn("Error closing browser:", closeError);
          // Don't throw - we already have the PDF
        }
        browser = null;
      }

      return arrayBuffer;
    } catch (error: unknown) {
      console.error("Puppeteer PDF conversion error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      
      // Log additional error details if available
      if (error && typeof error === 'object') {
        console.error("Error object:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
      }
      
      // Clean up on error
      if (page) {
        try {
          await page.close().catch(() => {});
        } catch {
          // Ignore cleanup errors
        }
      }
      if (browser) {
        try {
          await browser.close().catch(() => {});
        } catch {
          // Ignore cleanup errors
        }
      }
      
      throw new Error(`PDF conversion failed: ${errorMessage}`);
    }
  }

  private convertToArrayBuffer(pdfBuffer: unknown): ArrayBuffer {
    console.log(`Converting PDF buffer. Type: ${typeof pdfBuffer}, Constructor: ${pdfBuffer?.constructor?.name || 'unknown'}`);
    
    // Handle null or undefined
    if (pdfBuffer == null) {
      throw new Error("PDF buffer is null or undefined");
    }

    // If it's already an ArrayBuffer, return it directly
    if (pdfBuffer instanceof ArrayBuffer) {
      console.log(`PDF buffer is already an ArrayBuffer. Size: ${pdfBuffer.byteLength} bytes`);
      return pdfBuffer;
    }

    // Handle Uint8Array
    if (pdfBuffer instanceof Uint8Array) {
      console.log(`PDF buffer is Uint8Array. Size: ${pdfBuffer.length} bytes`);
      // Create a new ArrayBuffer to avoid SharedArrayBuffer issues
      const newBuffer = new Uint8Array(pdfBuffer).buffer;
      return newBuffer;
    }

    // Check for other TypedArrays
    if (pdfBuffer instanceof Int8Array || 
        pdfBuffer instanceof Uint16Array ||
        pdfBuffer instanceof Int16Array ||
        pdfBuffer instanceof Uint32Array ||
        pdfBuffer instanceof Int32Array ||
        pdfBuffer instanceof Float32Array ||
        pdfBuffer instanceof Float64Array) {
      console.log(`PDF buffer is TypedArray (${pdfBuffer.constructor.name}). Converting to Uint8Array`);
      const uint8Array = new Uint8Array(pdfBuffer.buffer, pdfBuffer.byteOffset, pdfBuffer.byteLength);
      return uint8Array.buffer;
    }

    // Check for Node.js Buffer (available in some environments with nodejs_compat)
    if (typeof Buffer !== "undefined" && Buffer.isBuffer && Buffer.isBuffer(pdfBuffer)) {
      console.log(`PDF buffer is Node.js Buffer. Size: ${(pdfBuffer as Buffer).length} bytes`);
      const uint8Array = new Uint8Array((pdfBuffer as Buffer).length);
      for (let i = 0; i < (pdfBuffer as Buffer).length; i++) {
        uint8Array[i] = (pdfBuffer as Buffer)[i];
      }
      return uint8Array.buffer;
    }

    // Check if it's an array-like object
    if (Array.isArray(pdfBuffer)) {
      console.log(`PDF buffer is Array. Length: ${pdfBuffer.length}`);
      const uint8Array = new Uint8Array(pdfBuffer.length);
      for (let i = 0; i < pdfBuffer.length; i++) {
        const value = pdfBuffer[i];
        if (typeof value !== 'number' || value < 0 || value > 255) {
          throw new Error(`Invalid array value at index ${i}: ${value}`);
        }
        uint8Array[i] = value;
      }
      return uint8Array.buffer;
    }

    // Check if it has a length property and numeric indices (array-like)
    if (typeof pdfBuffer === 'object' && 'length' in pdfBuffer && typeof (pdfBuffer as any).length === 'number') {
      console.log(`PDF buffer is array-like object. Length: ${(pdfBuffer as any).length}`);
      const length = (pdfBuffer as any).length;
      const uint8Array = new Uint8Array(length);
      for (let i = 0; i < length; i++) {
        const value = (pdfBuffer as any)[i];
        if (typeof value !== 'number' || value < 0 || value > 255) {
          throw new Error(`Invalid array-like value at index ${i}: ${value}`);
        }
        uint8Array[i] = value;
      }
      return uint8Array.buffer;
    }

    // Last resort: try to convert via ArrayLike interface
    try {
      console.log('Attempting fallback conversion via ArrayLike');
      const uint8Array = new Uint8Array(pdfBuffer as ArrayLike<number>);
      if (uint8Array.length === 0) {
        throw new Error("Converted buffer is empty");
      }
      return uint8Array.buffer;
    } catch (error) {
      console.error('Fallback conversion failed:', error);
      throw new Error(
        `Cannot convert PDF buffer to ArrayBuffer. ` +
        `Type: ${typeof pdfBuffer}, ` +
        `Constructor: ${pdfBuffer?.constructor?.name || 'unknown'}, ` +
        `Value: ${JSON.stringify(pdfBuffer).substring(0, 100)}`
      );
    }
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

/**
 * PPTX Processing Service
 * Handles loading and processing PPTX template files using docxtemplater
 */

import type { H3Event } from "h3";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { getAssetsBinding } from "~/server/utils/cloudflare";

export class PptxProcessingService {
  private templateCache: ArrayBuffer | null = null;

  /**
   * Load a PPTX template file using multiple strategies:
   * 1. Try Cloudflare ASSETS binding (for Workers)
   * 2. Try Nitro storage API
   * 3. Fallback to HTTP fetch
   */
  async loadTemplate(
    event: H3Event,
    templateName: string = "base.pptx"
  ): Promise<ArrayBuffer> {
    // Use cached template if available (for subsequent requests)
    if (this.templateCache) {
      return this.templateCache;
    }

    // Strategy 1: Try Cloudflare ASSETS binding (for Workers)
    const assets = getAssetsBinding(event, "ASSETS");
    if (assets) {
      try {
        const url = new URL(`/${templateName}`, "https://fake-origin/");
        let response = await assets.fetch(url.toString());

        if (!response.ok) {
          // Try with just the filename
          response = await assets.fetch(
            new URL(templateName, "https://fake-origin/").toString()
          );
        }

        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          this.templateCache = arrayBuffer;
          return arrayBuffer;
        } else {
          console.warn(
            `ASSETS binding returned ${response.status} for ${templateName}`
          );
        }
      } catch (error) {
        console.warn("Failed to load template via ASSETS binding:", error);
      }
    } else {
      console.warn("ASSETS binding not available");
    }

    // Strategy 2: Try Nitro storage API (works across platforms)
    try {
      const storage = useStorage("public");
      const content = await storage.getItem(templateName, {
        type: "binary",
      });
      if (content instanceof ArrayBuffer) {
        this.templateCache = content;
        return content;
      }
    } catch (error) {
      console.warn("Failed to load template via Nitro storage:", error);
    }

    // Strategy 3: Fallback to HTTP fetch (last resort)
    try {
      const requestUrl = getRequestURL(event);
      const url = `${requestUrl.protocol}//${requestUrl.host}/${templateName}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Failed to load template from ${url}: ${response.status} ${response.statusText}`
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      this.templateCache = arrayBuffer;
      return arrayBuffer;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(
        `Failed to load template file '${templateName}'. Make sure it's in the public directory. Tried ASSETS binding, Nitro storage, and HTTP fetch. ${errorMessage}`
      );
    }
  }

  /**
   * Replace placeholders in a PPTX template with actual values
   * Uses docxtemplater to handle the PPTX format (which is a ZIP archive containing XML)
   */
  replacePlaceholders(
    templateBuffer: ArrayBuffer,
    data: Record<string, string>
  ): ArrayBuffer {
    try {
      // Load the PPTX file as a ZIP archive using PizZip
      const zip = new PizZip(templateBuffer);

      // Create a docxtemplater instance with the ZIP content
      // Configure delimiters to use {{}} syntax instead of {} (to match HTML template format)
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: {
          start: "{{",
          end: "}}",
        },
      });

      // Replace placeholders
      // docxtemplater will now recognize {{KEY}} format
      doc.render(data);

      // Get the modified document as a ZIP buffer
      const buf = doc.getZip().generate({
        type: "arraybuffer",
        compression: "DEFLATE",
      });

      return buf as ArrayBuffer;
    } catch (error) {
      console.error("Error processing PPTX template:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      // If error has properties property, it might be a docxtemplater error
      if (
        error &&
        typeof error === "object" &&
        "properties" in error &&
        error.properties &&
        typeof error.properties === "object"
      ) {
        const properties = error.properties;
        if ("explanation" in properties) {
          throw new Error(
            `PPTX template error: ${String(properties.explanation)}`
          );
        }
      }

      throw new Error(`Failed to process PPTX template: ${errorMessage}`);
    }
  }

  /**
   * Process a PPTX template: load it, replace placeholders, and return the modified file
   */
  async processTemplate(
    event: H3Event,
    templateName: string,
    data: Record<string, string>
  ): Promise<ArrayBuffer> {
    const templateBuffer = await this.loadTemplate(event, templateName);
    return this.replacePlaceholders(templateBuffer, data);
  }
}

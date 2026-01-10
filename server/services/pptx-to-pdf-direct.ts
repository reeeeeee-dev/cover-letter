/**
 * Direct PPTX to PDF Conversion Service using ConvertHub API
 * ConvertHub: 50 free API calls, no credit card required
 * https://converthub.com/api/pptx-to-pdf
 *
 * Uses manual API calls (not the SDK) for Cloudflare Workers compatibility
 */

export interface ConversionApiConfig {
  apiKey: string;
  apiUrl?: string;
}

export class PptxToPdfDirectService {
  private config: ConversionApiConfig;

  constructor(config: ConversionApiConfig) {
    if (!config.apiKey) {
      throw new Error("API key is required for PPTX to PDF conversion");
    }

    this.config = {
      apiUrl: config.apiUrl || "https://api.converthub.com",
      apiKey: config.apiKey,
    };
  }

  /**
   * Convert PPTX buffer directly to PDF using ConvertHub API
   */
  async convertPptxToPdf(pptxBuffer: ArrayBuffer): Promise<ArrayBuffer> {
    return this.convertViaConvertHub(pptxBuffer);
  }

  /**
   * Convert via ConvertHub service (50 free API calls, no credit card)
   * https://converthub.com/api/pptx-to-pdf
   */
  private async convertViaConvertHub(
    pptxBuffer: ArrayBuffer
  ): Promise<ArrayBuffer> {
    // ConvertHub uses multipart/form-data - construct it properly for Cloudflare Workers
    const boundary = `----WebKitFormBoundary${Date.now()}${Math.random()
      .toString(36)
      .substring(2)}`;
    const uint8Array = new Uint8Array(pptxBuffer);

    // Build multipart form data as binary (UTF-8 encoded)
    const encoder = new TextEncoder();
    const parts: Uint8Array[] = [];

    // File part header
    const fileHeader = encoder.encode(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="document.pptx"\r\n` +
        `Content-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation\r\n\r\n`
    );
    parts.push(fileHeader);

    // File content (binary)
    parts.push(uint8Array);

    // Target format part
    const formatPart = encoder.encode(
      `\r\n--${boundary}\r\n` +
        `Content-Disposition: form-data; name="target_format"\r\n\r\n` +
        `pdf\r\n` +
        `--${boundary}--\r\n`
    );
    parts.push(formatPart);

    // Combine all parts
    const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
    const body = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of parts) {
      body.set(part, offset);
      offset += part.length;
    }

    console.log("Submitting file to ConvertHub for conversion...");
    const submitResponse = await fetch(`${this.config.apiUrl}/v2/convert`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body: body,
    });

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      throw new Error(
        `ConvertHub conversion failed: ${submitResponse.status} ${errorText}`
      );
    }

    const result = await submitResponse.json();
    console.log("ConvertHub response:", JSON.stringify(result));

    if (!result.success || !result.job_id) {
      throw new Error(
        `ConvertHub conversion failed. Response: ${JSON.stringify(result)}`
      );
    }

    const jobId = result.job_id;
    console.log(
      `ConvertHub job submitted. Job ID: ${jobId}, Status: ${
        result.status || "unknown"
      }`
    );

    // ConvertHub can return immediately with download_url OR with status "processing" requiring polling
    // Check if conversion is complete immediately (has download_url)
    if (result.status === "completed" && result.download_url) {
      console.log(
        `Conversion completed immediately. Downloading from: ${result.download_url}`
      );
      return await this.downloadPdfFromUrl(result.download_url, result);
    }

    // If status is "processing", we need to poll for completion
    if (result.status === "processing" || !result.download_url) {
      console.log(`Conversion is processing. Polling for completion...`);
      console.log(`Estimated time: ${result.estimated_time || "Unknown"}`);

      // Poll for job completion
      return await this.pollAndDownloadConvertHub(jobId, result);
    }

    // If we have download_url but no status, try downloading directly
    if (result.download_url) {
      console.log(`Using download_url directly: ${result.download_url}`);
      return await this.downloadPdfFromUrl(result.download_url, result);
    }

    throw new Error(
      `Unexpected ConvertHub response format. Response: ${JSON.stringify(
        result
      )}`
    );
  }

  /**
   * Poll ConvertHub job until completion, then download the PDF
   */
  private async pollAndDownloadConvertHub(
    jobId: string,
    initialResult: any
  ): Promise<ArrayBuffer> {
    let attempts = 0;
    const maxAttempts = 30; // 30 attempts * 2 seconds = 60 seconds max
    const pollInterval = 2000; // 2 seconds

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      attempts++;

      console.log(
        `Polling ConvertHub job ${jobId}... (attempt ${attempts}/${maxAttempts})`
      );

      const statusResponse = await fetch(
        `${this.config.apiUrl}/v2/jobs/${jobId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
          },
        }
      );

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        throw new Error(
          `Failed to check ConvertHub job status: ${statusResponse.status} ${errorText}`
        );
      }

      const status = await statusResponse.json();
      console.log(`Job status: ${status.status || "unknown"}`);
      console.log(`Full status response: ${JSON.stringify(status, null, 2)}`);

      // Check if job is completed
      if (status.status === "completed" || status.status === "success") {
        console.log(`Job completed! Checking for download URL...`);

        // Check for download_url in different possible locations (ConvertHub API structure)
        const downloadUrl =
          status.result?.download_url ||
          status.download_url ||
          status.links?.download ||
          status.result?.url;

        if (downloadUrl) {
          console.log(`Found download URL in status response: ${downloadUrl}`);
          return await this.downloadPdfFromUrl(downloadUrl, status);
        }

        console.log(
          `No download_url found in status response. Trying download endpoint...`
        );

        // Use the download endpoint - this might return JSON with download info or redirect
        const downloadEndpoint = `${this.config.apiUrl}/v2/jobs/${jobId}/download`;
        console.log(`Downloading from endpoint: ${downloadEndpoint}`);

        // First, try without following redirects to see what we get
        let downloadResponse = await fetch(downloadEndpoint, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          redirect: "manual", // Don't follow redirects automatically
        });

        // Handle redirects manually (3xx status codes)
        if (downloadResponse.status >= 300 && downloadResponse.status < 400) {
          const redirectUrl = downloadResponse.headers.get("location");
          if (redirectUrl) {
            console.log(`Download endpoint redirected to: ${redirectUrl}`);
            // Follow the redirect
            downloadResponse = await fetch(redirectUrl, {
              method: "GET",
              headers: {
                Authorization: `Bearer ${this.config.apiKey}`,
              },
              redirect: "follow",
            });
          }
        }

        if (!downloadResponse.ok) {
          const errorText = await downloadResponse.text();
          throw new Error(
            `Failed to download PDF from ConvertHub: ${downloadResponse.status} ${errorText}`
          );
        }

        // Check content type - if it's JSON, it might contain the download URL
        const contentType = downloadResponse.headers.get("content-type") || "";
        console.log(
          `Download response content-type: ${contentType}, status: ${downloadResponse.status}`
        );

        // Try to peek at the response to see if it's JSON
        const responseClone = downloadResponse.clone();
        const textPreview = await responseClone.text().catch(() => "");

        if (
          contentType.includes("application/json") ||
          textPreview.trim().startsWith("{") ||
          textPreview.trim().startsWith("[")
        ) {
          // It's JSON, try to extract download URL
          try {
            const downloadInfo = JSON.parse(textPreview);
            console.log(
              `Download endpoint returned JSON: ${JSON.stringify(downloadInfo)}`
            );

            const actualDownloadUrl =
              downloadInfo.download_url ||
              downloadInfo.url ||
              downloadInfo.result?.download_url ||
              downloadInfo.data?.download_url;
            if (actualDownloadUrl) {
              console.log(
                `Found download URL in JSON response: ${actualDownloadUrl}`
              );
              return await this.downloadPdfFromUrl(
                actualDownloadUrl,
                downloadInfo
              );
            }

            throw new Error(
              `Download endpoint returned JSON but no download_url found: ${JSON.stringify(
                downloadInfo
              )}`
            );
          } catch (parseError) {
            // If JSON parsing fails, try downloading as binary anyway
            console.warn(
              `Failed to parse as JSON, trying as binary: ${parseError}`
            );
          }
        }

        // It should be binary PDF data - use the original response
        const pdfBuffer = await downloadResponse.arrayBuffer();
        console.log(
          `Downloaded ${pdfBuffer.byteLength} bytes from download endpoint`
        );

        if (!this.validatePdfBuffer(pdfBuffer)) {
          // Try to see if it's actually JSON or error message
          const text = new TextDecoder().decode(pdfBuffer.slice(0, 1000));
          console.log(`First 500 chars of response: ${text.substring(0, 500)}`);

          if (text.trim().startsWith("{") || text.trim().startsWith("[")) {
            try {
              const jsonResponse = JSON.parse(text);
              throw new Error(
                `Download endpoint returned JSON instead of PDF: ${JSON.stringify(
                  jsonResponse
                )}`
              );
            } catch {
              // Not valid JSON, continue with error
            }
          }

          throw new Error(
            `Downloaded file is not a valid PDF. First 500 chars: ${text.substring(
              0,
              500
            )}`
          );
        }

        console.log(
          `PDF downloaded successfully. Size: ${pdfBuffer.byteLength} bytes`
        );
        return pdfBuffer;
      }

      // Check if job failed
      if (
        status.status === "failed" ||
        status.status === "error" ||
        status.status === "cancelled"
      ) {
        const errorMsg =
          status.error?.message || status.message || "Unknown error";
        throw new Error(`ConvertHub conversion failed: ${errorMsg}`);
      }

      // Continue polling if still processing
      if (status.status === "processing" || status.status === "queued") {
        console.log(
          `Job still processing... (${
            status.estimated_time || "unknown time remaining"
          })`
        );
        continue;
      }

      // Unexpected status
      console.warn(
        `Unexpected job status: ${status.status}. Response: ${JSON.stringify(
          status
        )}`
      );
    }

    throw new Error(
      `ConvertHub conversion timed out after ${
        maxAttempts * 2
      } seconds. Job ID: ${jobId}`
    );
  }

  /**
   * Download PDF from a URL (either download_url or endpoint)
   */
  private async downloadPdfFromUrl(
    downloadUrl: string,
    result: any
  ): Promise<ArrayBuffer> {
    console.log(`Downloading PDF from URL: ${downloadUrl}`);

    // Try with auth first
    let downloadResponse = await fetch(downloadUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      redirect: "follow",
    });

    // If that fails or returns JSON, try without auth (public URL)
    if (
      !downloadResponse.ok ||
      downloadResponse.headers.get("content-type")?.includes("application/json")
    ) {
      console.log(
        "Download with auth failed or returned JSON, trying without auth..."
      );
      downloadResponse = await fetch(downloadUrl, {
        method: "GET",
        redirect: "follow",
      });
    }

    if (!downloadResponse.ok) {
      const errorText = await downloadResponse.text();
      throw new Error(
        `Failed to download PDF from URL: ${downloadResponse.status} ${errorText}`
      );
    }

    const pdfBuffer = await downloadResponse.arrayBuffer();

    if (!this.validatePdfBuffer(pdfBuffer)) {
      // If it's JSON, log the error
      try {
        const jsonResponse = JSON.parse(new TextDecoder().decode(pdfBuffer));
        throw new Error(
          `Download URL returned JSON instead of PDF: ${JSON.stringify(
            jsonResponse
          )}`
        );
      } catch {
        throw new Error("Downloaded file is not a valid PDF");
      }
    }

    console.log(
      `PDF downloaded successfully from URL. Size: ${pdfBuffer.byteLength} bytes`
    );
    return pdfBuffer;
  }

  /**
   * Validate that a buffer is a valid PDF file
   */
  private validatePdfBuffer(buffer: ArrayBuffer): boolean {
    if (!buffer || buffer.byteLength === 0) {
      return false;
    }

    // Check PDF magic bytes (%PDF)
    const pdfHeader = new Uint8Array(buffer.slice(0, 4));
    const pdfMagicBytes = new TextDecoder().decode(pdfHeader);
    return pdfMagicBytes === "%PDF";
  }
}

/**
 * Template Service
 * Handles loading and processing HTML templates
 */

import type { H3Event } from 'h3'
import { replacePlaceholders } from '~/server/utils/string'
import { getAssetsBinding } from '~/server/utils/cloudflare'

export class TemplateService {
  private templateCache: string | null = null

  /**
   * Load a template file using multiple strategies:
   * 1. Try Cloudflare ASSETS binding (for Workers)
   * 2. Try Nitro storage API
   * 3. Try file system read (for local dev/build)
   * 4. Fallback to HTTP fetch
   */
  async loadTemplate(
    event: H3Event,
    templateName: string = 'base.html'
  ): Promise<string> {
    // Use cached template if available (for subsequent requests)
    if (this.templateCache) {
      return this.templateCache
    }

    // Strategy 1: Try Cloudflare ASSETS binding (for Workers)
    const assets = getAssetsBinding(event, 'ASSETS')
    if (assets) {
      try {
        // Create a proper Request object with absolute URL
        // Assets binding expects the path relative to the assets directory
        const url = new URL(`/${templateName}`, 'https://fake-origin/')
        let response = await assets.fetch(url.toString())
        
        if (!response.ok) {
          // Try with just the filename
          response = await assets.fetch(new URL(templateName, 'https://fake-origin/').toString())
        }
        
        if (response.ok) {
          const content = await response.text()
          this.templateCache = content
          return content
        } else {
          console.warn(`ASSETS binding returned ${response.status} for ${templateName}`)
        }
      } catch (error) {
        console.warn('Failed to load template via ASSETS binding:', error)
      }
    } else {
      console.warn('ASSETS binding not available')
    }

    // Strategy 2: Try Nitro storage API (works across platforms)
    try {
      const storage = useStorage('public')
      const content = await storage.getItem(templateName)
      if (typeof content === 'string') {
        this.templateCache = content
        return content
      }
    } catch (error) {
      console.warn('Failed to load template via Nitro storage:', error)
    }

    // Strategy 3: Fallback to HTTP fetch (last resort)
    try {
      const requestUrl = getRequestURL(event)
      const url = `${requestUrl.protocol}//${requestUrl.host}/${templateName}`
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(
          `Failed to load template from ${url}: ${response.status} ${response.statusText}`
        )
      }

      const content = await response.text()
      this.templateCache = content
      return content
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(
        `Failed to load template file '${templateName}'. Make sure it's in the public directory. Tried ASSETS binding, Nitro storage, file system, and HTTP fetch. ${errorMessage}`
      )
    }
  }

  /**
   * Replace placeholders in a template with actual values
   */
  replacePlaceholders(template: string, data: Record<string, string>): string {
    return replacePlaceholders(template, data)
  }
}

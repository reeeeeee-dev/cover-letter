/**
 * Template Service
 * Handles loading and processing HTML templates
 */

import type { H3Event } from 'h3'
import { replacePlaceholders } from '~/server/utils/string'
import { getAssetsBinding } from '~/server/utils/cloudflare'

export class TemplateService {
  /**
   * Load a template file using Cloudflare ASSETS binding or fallback to fetch
   */
  async loadTemplate(
    event: H3Event,
    templateName: string = 'base.html'
  ): Promise<string> {
    // First, try to use Cloudflare ASSETS binding (recommended for Workers)
    const assets = getAssetsBinding(event, 'ASSETS')
    
    if (assets) {
      try {
        // Assets binding is a Fetcher-like object that can fetch from the assets directory
        const response = await assets.fetch(new Request(`/${templateName}`, {
          method: 'GET',
        }))
        
        if (response.ok) {
          return await response.text()
        }
        
        // If assets binding fails, fall through to HTTP fetch fallback
      } catch (error) {
        console.warn('Failed to load template via ASSETS binding, trying HTTP fetch:', error)
      }
    }
    
    // Fallback: Try HTTP fetch (works in local dev or if assets are served publicly)
    try {
      const requestUrl = getRequestURL(event)
      const url = `${requestUrl.protocol}//${requestUrl.host}/${templateName}`
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(
          `Failed to load template from ${url}: ${response.status} ${response.statusText}`
        )
      }

      return await response.text()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(
        `Failed to load template file '${templateName}'. Make sure it's in the public directory. ${errorMessage}`
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

/**
 * Cloudflare Workers utilities
 * Helper functions for accessing Cloudflare-specific features
 */

import type { H3Event } from 'h3'
import type { BrowserBinding, CloudflareEnv, AssetsBinding } from '~/server/types/cloudflare'

/**
 * Get the Cloudflare environment from an event
 */
function getCloudflareEnv(
  event: H3Event | { context?: { cloudflare?: { env?: CloudflareEnv } }; cloudflare?: { env?: CloudflareEnv } }
): CloudflareEnv | null {
  // Method 1: Via event.context.cloudflare.env (standard way in Nuxt/Nitro)
  if (event?.context?.cloudflare?.env) {
    return event.context.cloudflare.env
  }

  // Method 2: Direct access via cloudflare property (alternative)
  if (event?.cloudflare?.env) {
    return event.cloudflare.env
  }

  return null
}

/**
 * Get the browser binding from the Cloudflare Workers environment
 * In Nuxt/Nitro, bindings are accessed via event.context.cloudflare.env
 * The binding name should match what's configured in wrangler.toml (e.g., MYBROWSER)
 */
export function getBrowserBinding(
  event: H3Event | { context?: { cloudflare?: { env?: CloudflareEnv } }; cloudflare?: { env?: CloudflareEnv } },
  bindingName: string = 'MYBROWSER'
): BrowserBinding | null {
  const env = getCloudflareEnv(event)
  if (!env) {
    return null
  }
  
  // Try the specified binding name first
  if (env[bindingName]) {
    return env[bindingName]
  }
  
  // Try common browser binding names
  if (env.BROWSER) {
    return env.BROWSER
  }
  
  if (env.MYBROWSER) {
    return env.MYBROWSER
  }

  // Fallback via runtime config (for development)
  try {
    const config = useRuntimeConfig()
    if (config.cloudflare?.browser) {
      return config.cloudflare.browser
    }
  } catch {
    // Runtime config may not be available in all contexts
  }

  return null
}

/**
 * Get the assets binding from the Cloudflare Workers environment
 * Assets are served via the ASSETS binding configured in wrangler.toml
 */
export function getAssetsBinding(
  event: H3Event | { context?: { cloudflare?: { env?: CloudflareEnv } }; cloudflare?: { env?: CloudflareEnv } },
  bindingName: string = 'ASSETS'
): AssetsBinding | null {
  const env = getCloudflareEnv(event)
  if (!env) {
    return null
  }
  
  // Try the specified binding name first
  if (env[bindingName]) {
    return env[bindingName] as AssetsBinding
  }
  
  // Try common assets binding names
  if (env.ASSETS) {
    return env.ASSETS
  }

  return null
}

/**
 * Cloudflare Workers utilities
 * Helper functions for accessing Cloudflare-specific features
 */

import type { H3Event } from 'h3'
import type { CloudflareEnv, AssetsBinding } from '~/server/types/cloudflare'

/**
 * Get the Cloudflare environment from an event
 */
export function getCloudflareEnv(
  event: H3Event | { context?: { cloudflare?: { env?: CloudflareEnv } }; cloudflare?: { env?: CloudflareEnv } }
): CloudflareEnv | null {
  // Method 1: Via event.context.cloudflare.env (standard way in Nuxt/Nitro with cloudflare_module preset)
  if (event?.context?.cloudflare?.env) {
    return event.context.cloudflare.env
  }

  // Method 2: Direct access via cloudflare property (alternative)
  if (event?.cloudflare?.env) {
    return event.cloudflare.env
  }

  // Method 3: Try accessing via event.node.req (for Cloudflare Workers runtime)
  // In some cases, the env might be available on the request object
  try {
    const req = (event as any)?.node?.req
    if (req && typeof req === 'object' && 'env' in req) {
      return req.env as CloudflareEnv
    }
  } catch {
    // Ignore errors
  }

  // Method 4: Try globalThis (for Cloudflare Workers)
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).env) {
      return (globalThis as any).env as CloudflareEnv
    }
  } catch {
    // Ignore errors
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

/**
 * Get a secret or environment variable from Cloudflare Workers environment
 * Secrets set via "wrangler secret put" are available in event.context.cloudflare.env
 */
export function getSecret(
  event: H3Event | { context?: { cloudflare?: { env?: CloudflareEnv } }; cloudflare?: { env?: CloudflareEnv } },
  secretName: string
): string | null {
  const env = getCloudflareEnv(event)
  
  if (env && typeof env === 'object' && secretName in env) {
    const value = env[secretName]
    if (value && typeof value === 'string') {
      return value
    }
  }
  
  return null
}

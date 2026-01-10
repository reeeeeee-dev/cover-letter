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
    console.warn('Cloudflare environment not found. Available keys:', 
      event && typeof event === 'object' ? Object.keys(event) : 'unknown')
    return null
  }
  
  console.log('Cloudflare env keys:', Object.keys(env))
  
  // Try the specified binding name first
  if (env[bindingName]) {
    console.log(`Found browser binding: ${bindingName}`)
    return env[bindingName] as BrowserBinding
  }
  
  // Try common browser binding names
  if (env.BROWSER) {
    console.log('Found browser binding: BROWSER')
    return env.BROWSER as BrowserBinding
  }
  
  if (env.MYBROWSER) {
    console.log('Found browser binding: MYBROWSER')
    return env.MYBROWSER as BrowserBinding
  }

  // Fallback via runtime config (for development)
  try {
    const config = useRuntimeConfig()
    if (config.cloudflare?.browser) {
      console.log('Found browser binding via runtime config')
      return config.cloudflare.browser as BrowserBinding
    }
  } catch {
    // Runtime config may not be available in all contexts
  }

  console.warn(`Browser binding '${bindingName}' not found in environment`)
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

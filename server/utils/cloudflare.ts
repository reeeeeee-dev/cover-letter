/**
 * Cloudflare Workers utilities
 * Helper functions for accessing Cloudflare-specific features
 */

import type { H3Event } from 'h3'
import type { CloudflareEnv, AssetsBinding, R2Binding } from '~/server/types/cloudflare'

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
 * Get the R2 bucket binding from the Cloudflare Workers environment
 * R2 buckets are configured via r2_buckets in wrangler.toml
 * In Nuxt 4 with Cloudflare Workers, bindings are accessed via event.context.cloudflare.env
 */
export function getR2Binding(
  event: H3Event | { context?: { cloudflare?: { env?: CloudflareEnv } }; cloudflare?: { env?: CloudflareEnv } },
  bindingName: string = 'PDF_CACHE'
): R2Binding | null {
  // Try multiple ways to access the environment
  let env: CloudflareEnv | null = null

  // Method 1: Via event.context.cloudflare.env (Nuxt/Nitro standard)
  if (event?.context?.cloudflare?.env) {
    env = event.context.cloudflare.env
  }
  // Method 2: Direct cloudflare property
  else if ((event as any)?.cloudflare?.env) {
    env = (event as any).cloudflare.env
  }
  // Method 3: Direct access (if env is directly on context)
  else if ((event as any)?.context?.env) {
    env = (event as any).context.env
  }
  // Method 4: Use getCloudflareEnv helper as fallback
  else {
    env = getCloudflareEnv(event)
  }

  if (!env) {
    console.warn('Cloudflare environment not found when looking for R2 binding')
    return null
  }
  
  // Debug: Log available keys in env (but be careful not to log secrets)
  const envKeys = Object.keys(env).filter(
    key => !key.toLowerCase().includes('key') && 
           !key.toLowerCase().includes('secret') && 
           !key.toLowerCase().includes('token') &&
           !key.toLowerCase().includes('password')
  )
  console.log(`Available environment keys: ${envKeys.join(', ')}`)
  
  // Try the specified binding name first
  if (bindingName in env && env[bindingName]) {
    const binding = env[bindingName]
    // Verify it has R2-like methods
    if (binding && typeof binding === 'object' && 'get' in binding && 'put' in binding) {
      console.log(`Found R2 binding: ${bindingName}`)
      return binding as R2Binding
    }
  }
  
  // Try common R2 binding names
  if ('PDF_CACHE' in env && env.PDF_CACHE) {
    const binding = env.PDF_CACHE
    if (binding && typeof binding === 'object' && 'get' in binding && 'put' in binding) {
      console.log('Found R2 binding: PDF_CACHE')
      return binding as R2Binding
    }
  }

  console.warn(
    `R2 binding '${bindingName}' not found in environment. ` +
    `Available keys (filtered): ${envKeys.join(', ')}. ` +
    `Make sure the R2 bucket exists and is configured in wrangler.toml`
  )
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

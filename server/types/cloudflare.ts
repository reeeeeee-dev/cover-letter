/**
 * Cloudflare Workers type definitions
 */

/**
 * Cloudflare Assets Binding (Fetcher-like interface)
 */
export interface AssetsBinding {
  fetch: (request: Request | string, init?: RequestInit) => Promise<Response>
}

/**
 * Cloudflare Environment interface
 * Represents the environment object in Cloudflare Workers
 */
export interface CloudflareEnv {
  [key: string]: unknown
  BROWSER?: BrowserBinding
  MYBROWSER?: BrowserBinding
  ASSETS?: AssetsBinding
}

/**
 * Browser Binding type
 * Represents the browser binding from Cloudflare Browser Rendering API
 */
export type BrowserBinding = unknown

/**
 * Cloudflare context interface
 */
export interface CloudflareContext {
  env?: CloudflareEnv
}

/**
 * Event with Cloudflare context
 * Extends H3Event to include Cloudflare-specific context
 */
import type { H3Event } from 'h3'

export interface CloudflareEvent extends Partial<H3Event> {
  context?: {
    cloudflare?: CloudflareContext
    [key: string]: unknown
  }
  cloudflare?: {
    env?: CloudflareEnv
  }
}

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
 * Cloudflare R2 Bucket Binding interface
 * R2 buckets support standard S3-compatible operations
 */
export interface R2Binding {
  get(key: string, options?: R2GetOptions): Promise<R2ObjectBody | null>
  put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob, options?: R2PutOptions): Promise<R2Object>
  delete(keys: string | string[]): Promise<void>
  head(key: string): Promise<R2Object | null>
  list(options?: R2ListOptions): Promise<R2Objects>
}

/**
 * R2 Object metadata
 */
export interface R2Object {
  key: string
  version: string
  size: number
  etag: string
  httpEtag: string
  checksums: R2Checksums
  uploaded: Date
  httpMetadata?: R2HTTPMetadata
  customMetadata?: Record<string, string>
}

/**
 * R2 Object body (includes the data)
 */
export interface R2ObjectBody extends R2Object {
  body: ReadableStream
  bodyUsed: boolean
  arrayBuffer(): Promise<ArrayBuffer>
  text(): Promise<string>
  json<T = unknown>(): Promise<T>
  blob(): Promise<Blob>
}

/**
 * R2 Options interfaces
 */
export interface R2GetOptions {
  onlyIf?: R2Conditional
  range?: R2Range
}

export interface R2PutOptions {
  httpMetadata?: R2HTTPMetadata
  customMetadata?: Record<string, string>
  onlyIf?: R2Conditional
}

export interface R2ListOptions {
  limit?: number
  prefix?: string
  cursor?: string
  delimiter?: string
  startAfter?: string
  include?: ('httpMetadata' | 'customMetadata')[]
}

export interface R2Objects {
  objects: R2Object[]
  truncated: boolean
  cursor?: string
  delimitedPrefixes: string[]
}

export interface R2HTTPMetadata {
  contentType?: string
  contentLanguage?: string
  contentDisposition?: string
  contentEncoding?: string
  cacheControl?: string
  cacheExpiry?: Date
}

export interface R2Checksums {
  md5?: ArrayBuffer
  sha1?: ArrayBuffer
  sha256?: ArrayBuffer
  sha384?: ArrayBuffer
  sha512?: ArrayBuffer
}

export interface R2Conditional {
  etagMatches?: string
  etagDoesNotMatch?: string
  uploadedBefore?: Date
  uploadedAfter?: Date
}

export interface R2Range {
  offset?: number
  length?: number
  suffix?: number
}

/**
 * Cloudflare Environment interface
 * Represents the environment object in Cloudflare Workers
 */
export interface CloudflareEnv {
  [key: string]: unknown
  ASSETS?: AssetsBinding
  PDF_CACHE?: R2Binding
}

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

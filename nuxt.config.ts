// https://nuxt.com/docs/api/configuration/nuxt-config
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  
  // Cloudflare Workers deployment configuration
  nitro: {
    preset: 'cloudflare_module',
    cloudflare: {
      deployConfig: true,
    },
    // Configure TypeScript for server code
    typescript: {
      tsConfig: {
        compilerOptions: {
          baseUrl: '.',
          paths: {
            '~/*': ['./*', '../*'],
          },
        },
      },
    },
    // Exclude Node.js modules that won't work in Workers
    esbuild: {
      options: {
        target: 'es2022'
      }
    }
  },
  
  // TypeScript path aliases - use absolute paths to avoid module duplication
  alias: {
    '~': resolve(rootDir),
    '~/server': resolve(rootDir, 'server'),
  },
  
  // TypeScript configuration
  typescript: {
    tsConfig: {
      compilerOptions: {
        baseUrl: '.',
        paths: {
          '~/*': ['./*', '../*'],
        },
      },
    },
  },
  
  // Runtime config for environment variables
  runtimeConfig: {
    // Cloudflare bindings are accessed via event.context.cloudflare.env
    // No need to configure here as they come from wrangler.toml
    public: {
      // Add any public config here if needed
    }
  }
})

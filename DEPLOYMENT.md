# Cloudflare Workers Deployment Guide

This app is configured to deploy to Cloudflare Workers. Follow these steps to deploy:

## Prerequisites

1. **Cloudflare Account**: Sign up at [cloudflare.com](https://www.cloudflare.com)
2. **Wrangler CLI**: Install the Cloudflare Workers CLI
   ```bash
   npm install -g wrangler
   # or
   yarn global add wrangler
   ```
3. **Cloudflare Browser Rendering API**: The app uses Puppeteer with Cloudflare's Browser Rendering API
   - No external API keys needed - uses Cloudflare's built-in browser service
   - Requires Browser Rendering API to be enabled on your Cloudflare account

## Setup

1. **Build the project**:
   ```bash
   yarn build
   ```

2. **Login to Cloudflare**:
   ```bash
   wrangler login
   ```

3. **Configure Browser Rendering API binding**:
   Create a `wrangler.toml` file based on `wrangler.toml.example`:
   
   ```toml
   [browser]
   binding = "MYBROWSER"
   ```

   This binds the Browser Rendering API to your Worker. No API keys needed!

## Deployment

### Option 1: Using Wrangler

```bash
wrangler deploy
```

### Option 2: Using Cloudflare Dashboard

1. Go to Cloudflare Dashboard → Workers & Pages
2. Create a new Worker
3. Upload the `.output` directory after running `yarn build`
4. Add Browser Rendering API binding in Worker settings:
   - Go to Settings → Bindings
   - Add a Browser binding named `MYBROWSER`

## Configuration

### PDF Conversion with Puppeteer

The app uses **@cloudflare/puppeteer** for HTML to PDF conversion via Cloudflare's Browser Rendering API. This provides:
- **No external dependencies**: Uses Cloudflare's built-in browser service
- **No API keys required**: Authentication handled by Cloudflare
- **High quality PDFs**: Full browser rendering with CSS support
- **Fast and reliable**: Runs on Cloudflare's infrastructure

### Fallback Behavior

If the browser binding is not available, the app will:
- Return the modified HTML file instead of PDF
- Log a warning message
- Users can manually convert HTML to PDF if needed

## File Structure

- `base.html` should be in the `public/` directory
- The app fetches it from `/base.html` at runtime
- The template should contain `{{COMPANY}}` placeholders that will be replaced with the user's input
- Make sure it's included in your deployment

## Troubleshooting

### Error: "Failed to load base HTML file"
- Ensure `base.html` is in the `public/` directory
- Check that the file is accessible via `/base.html` URL

### Error: "PDF conversion failed"
- Ensure Browser Rendering API is enabled on your Cloudflare account
- Verify the browser binding is configured in `wrangler.toml` as `MYBROWSER`
- Check Cloudflare Workers logs for detailed error messages
- Make sure your account has Browser Rendering API access (may require paid plan)

### Error: "Browser binding not available"
- Check that `[browser]` section exists in `wrangler.toml`
- Verify the binding name matches `MYBROWSER` (or update code if using different name)
- In Cloudflare Dashboard, ensure Browser binding is added in Worker settings

### Libraries not working in Workers
- The app uses `@cloudflare/puppeteer` which is specifically designed for Workers
- All operations use standard Web APIs compatible with Workers runtime
- Browser Rendering API handles all browser automation

## Cost Considerations

- **Cloudflare Workers**: Free tier available (100k requests/day)
- **Browser Rendering API**: Check Cloudflare pricing - may require paid plan
- File size limits may apply (check Workers and Browser Rendering API limits)
- No additional third-party API costs - everything runs on Cloudflare

## Testing Locally

### Using `wrangler dev` (Recommended)

For local development that matches the production Cloudflare Workers environment:

1. **Build the project first**:
   ```bash
   yarn build
   ```

2. **Run with Wrangler**:
   ```bash
   wrangler dev
   ```

This command:
- Starts a local development server that mimics Cloudflare Workers
- Provides the browser binding (MYBROWSER) locally - no need for separate Puppeteer setup!
- Spins up a browser directly on your machine for testing
- Allows you to test PDF generation locally just like in production

**Important**: Use `wrangler dev` instead of `yarn dev` when you need to test PDF generation, as it provides the browser binding required for Puppeteer.

### Using `yarn dev` (Limited)

The regular Nuxt dev server (`yarn dev`) does NOT provide the browser binding, so PDF conversion will not work and will fall back to returning HTML files. Use `wrangler dev` for full functionality.

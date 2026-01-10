# Cover Letter Generator

Generate personalized cover letters from PPTX templates with placeholder replacement and direct PPTX to PDF conversion.

## Features

- Replace placeholders in PPTX templates (e.g., `{{COMPANY}}`)
- Direct PPTX to PDF conversion using ConvertHub API (50 free API calls, no credit card required)
- Preserves all formatting, fonts, colors, hyperlinks, and layout from the original PPTX
- Runs on Cloudflare Workers (serverless edge computing)

## Setup

### 1. Create Cloudflare R2 Bucket (for PDF caching)

**⚠️ IMPORTANT: The R2 bucket must be created BEFORE running `wrangler dev` or the binding won't be available.**

The same bucket is used for both production and local development.

**Option 1: Using Wrangler CLI (Recommended)**

```bash
# Make sure you're logged in to Cloudflare
wrangler login

# Create the R2 bucket (required before running wrangler dev)
wrangler r2 bucket create cover-letter-pdfs

# Verify the bucket was created
wrangler r2 bucket list
```

**Option 2: Using Cloudflare Dashboard**

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **R2** in the sidebar
3. Click **Create bucket**
4. Name it `cover-letter-pdfs` (must match `bucket_name` in `wrangler.toml`)
5. Click **Create bucket**

**Important Notes:**
- The bucket **must exist** before running `wrangler dev` or the R2 binding won't be available
- The binding name (`PDF_CACHE`) is configured in `wrangler.toml` under `[[r2_buckets]]`
- The same bucket is shared between production and local development, so cached PDFs will be available in both environments
- If you see "R2 binding not available" warnings, make sure the bucket exists: `wrangler r2 bucket list`

### 2. Get a Free ConvertHub API Key

1. Visit [https://converthub.com](https://converthub.com)
2. Sign up for a free account (50 free API calls, no credit card required)
3. Get your API key from the dashboard

### 3. Set the API Key as a Cloudflare Secret

**For Production (Recommended):**

```bash
# Make sure you're logged in
wrangler login

# Set the secret (you'll be prompted to enter your API key)
wrangler secret put CONVERSION_API_KEY

# Verify it was set
wrangler secret list
```

**For Local Development:**

When using `wrangler dev`, secrets are automatically pulled from Cloudflare. For faster iteration, you can also set a local environment variable:

```bash
# Option 1: Create .env file (make sure it's in .gitignore)
echo "CONVERSION_API_KEY=your-api-key-here" > .env

# Option 2: Set as environment variable
export CONVERSION_API_KEY="your-api-key-here"
```

### 4. Place Your PPTX Template

1. Create a PPTX template with placeholders like `{{COMPANY}}`
2. Place it in the `public/` directory as `base.pptx`
3. Format it with all your desired styling (fonts, colors, hyperlinks, etc.)

### 5. Install Dependencies

```bash
yarn install
```

### 6. Run Locally

```bash
yarn dev
# or
wrangler dev
```

### 7. Deploy

```bash
yarn build
wrangler deploy
```

Don't forget to set the secret in production:

```bash
wrangler secret put CONVERSION_API_KEY
```

## Usage

1. Open the app in your browser
2. Enter a company name
3. Click "Generate & Download PDF"
4. The app will:
   - Check R2 cache for previously generated PDF (by company name)
   - If cached, download the cached PDF immediately
   - If not cached:
     - Load `base.pptx` template
     - Replace `{{COMPANY}}` with the entered company name
     - Convert the processed PPTX directly to PDF using ConvertHub API
     - Cache the generated PDF in R2 storage for future requests
     - Download the PDF with all formatting preserved

## API

### POST `/api/generate-pdf`

Generate a PDF from the PPTX template.

**Request Body:**
```json
{
  "company": "Company Name"
}
```

**Response:**
- Success: PDF file (binary)
- Error: JSON error message

## Technical Details

- **PDF Caching**: Generated PDFs are cached in Cloudflare R2 storage using company name as the key
  - Cache keys are normalized (lowercase, special chars removed)
  - Cached files are stored with 1-year cache headers
  - Subsequent requests for the same company return instantly from cache
- Uses manual ConvertHub API calls (compatible with Cloudflare Workers)
- Handles async conversions with automatic polling
- Direct ArrayBuffer handling (no Node.js Buffer dependencies)

## Development

Built with:
- Nuxt 4 (Vue 3 framework)
- Cloudflare Workers (serverless runtime)
- docxtemplater (PPTX placeholder replacement)
- ConvertHub API (PPTX to PDF conversion)

## License

MIT

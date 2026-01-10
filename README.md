# Cover Letter Generator

Generate personalized cover letters from PPTX templates with placeholder replacement and direct PPTX to PDF conversion.

## Features

- Replace placeholders in PPTX templates (e.g., `{{COMPANY}}`)
- Direct PPTX to PDF conversion using ConvertHub API (50 free API calls, no credit card required)
- Preserves all formatting, fonts, colors, hyperlinks, and layout from the original PPTX
- Runs on Cloudflare Workers (serverless edge computing)

## Setup

### 1. Get a Free ConvertHub API Key

1. Visit [https://converthub.com](https://converthub.com)
2. Sign up for a free account (50 free API calls, no credit card required)
3. Get your API key from the dashboard

### 2. Set the API Key as a Cloudflare Secret

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

See [SETUP_SECRETS.md](./SETUP_SECRETS.md) for detailed instructions on managing Cloudflare secrets.

### 3. Place Your PPTX Template

1. Create a PPTX template with placeholders like `{{COMPANY}}`
2. Place it in the `public/` directory as `base.pptx`
3. Format it with all your desired styling (fonts, colors, hyperlinks, etc.)

### 4. Install Dependencies

```bash
yarn install
```

### 5. Run Locally

```bash
yarn dev
# or
wrangler dev
```

### 6. Deploy

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
   - Load `base.pptx` template
   - Replace `{{COMPANY}}` with the entered company name
   - Convert the processed PPTX directly to PDF using ConvertHub API
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

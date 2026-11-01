# Just Insure — Odometer OCR API

A REST API built with Node.js, Express and TypeScript that extracts odometer readings from vehicle dashboard images using OpenAI.

The application also includes a mock OCR provider, allowing it to run and be tested without an OpenAI API key.

## Features

- Extracts odometer readings from JPEG and PNG images.
- Accepts multipart file uploads and Base64-encoded JSON.
- Returns the reading, unit (`miles` or `km`) and confidence level.
- Validates image formats, file sizes and corrupted images.
- Supports deterministic mock responses without an API key.
- Includes automated unit, API and real OpenAI end-to-end tests.

## Getting Started

### Prerequisites

- Node.js 22 or later
- npm

### Installation

Clone the repository and install the dependencies:

```bash
git clone https://github.com/georgipavlov96/backend-exercise-odometer.git
cd backend-exercise-odometer
npm ci
```

### Running the application

**Mock mode (no API key required)**

The simplest way to try the API is with the mock provider:

```bash
OCR_PROVIDER=mock npm start
```

The server starts at `http://localhost:3000`.

The mock provider returns predefined results for the supplied test images. It does not perform actual image recognition.

Try it with one of the included images:

```bash
curl -X POST http://localhost:3000/odometer/reading \
  -F "image=@images/odometer-blurry.png"
```

Expected response:

```json
{
  "reading": 48253,
  "unit": "miles",
  "confidence": "med"
}
```

**OpenAI mode (real OCR)**

To extract readings from other images, you'll need an OpenAI API key.

1. Sign in to the [OpenAI Platform](https://platform.openai.com/).
2. Create a key under [API keys](https://platform.openai.com/api-keys).
3. Set up API billing or credits if required.

OpenAI API usage is billed separately from ChatGPT subscriptions.

Set the `OPENAI_API_KEY` environment variable and start the server:

```bash
export OPENAI_API_KEY="your-api-key"
OCR_PROVIDER=openai npm start
```

The API now uses OpenAI's `gpt-4.1-mini` model to extract odometer readings from uploaded images.

Keep your API key private and never commit it to the repository.

For development, use `npm run dev` to restart the server automatically when source files change.

## API

### POST /odometer/reading

Accepts a single JPEG or PNG image and returns the extracted odometer reading.

There are two supported request formats.

**Multipart upload**

```bash
curl -X POST http://localhost:3000/odometer/reading \
  -F "image=@images/odometer-blurry.png"
```

The file must be submitted using the `image` field.

**Base64 JSON**

```json
{
  "image": "<base64-encoded-image>"
}
```

Send the JSON body with `Content-Type: application/json`.

Base64 requests are supported by the real OCR provider. Mock mode relies on filenames and therefore cannot identify Base64 images.

### Successful response

```json
{
  "reading": 62690.5,
  "unit": "miles",
  "confidence": "high"
}
```

| Field | Description |
|---|---|
| `reading` | Extracted odometer value, or `null` if no reading is returned |
| `unit` | `miles` or `km` |
| `confidence` | `high`, `med` or `low` |

### Error responses

The API validates requests before sending images to the OCR provider.

| HTTP status | Error | Description |
|---|---|---|
| 400 | `MISSING_IMAGE`, `EMPTY_IMAGE` | No image supplied or the file is empty |
| 400 | `INVALID_UPLOAD`, `INVALID_IMAGE` | Malformed request or invalid image data |
| 413 | `FILE_TOO_LARGE` | Image exceeds the allowed size |
| 415 | `UNSUPPORTED_FILE_TYPE` | Unsupported image format |
| 422 | `UNREADABLE_IMAGE` | OCR could not extract a valid reading |
| 500 | `INTERNAL_ERROR` | Unexpected application error |

Example unreadable-image response:

```json
{
  "error": "UNREADABLE_IMAGE",
  "message": "Could not extract a mileage reading from the provided image"
}
```

Images are limited to **5 MiB**, and only one image is accepted per request. Additional images are rejected rather than silently ignored.

### GET /health

A simple health-check endpoint:

```bash
curl http://localhost:3000/health
```

Returns:

```json
{
  "status": "ok"
}
```

## Testing

The project uses Jest and Supertest. Tests are organised by what they exercise:

| Directory | Purpose |
|---|---|
| `tests/unit/` | OCR providers, factory selection and component behaviour |
| `tests/api/` | HTTP endpoints, uploads, validation and responses |
| `tests/e2e/` | Full HTTP requests using the real OpenAI API |
| `tests/fixtures/` | Shared test data and expected results |

### Unit and API tests

Run the standard test suite:

```bash
npm test
```

These tests use mocked external dependencies and **do not make paid OpenAI API requests**.

You can also run the suites individually:

```bash
npm test -- tests/unit
npm test -- tests/api
```

Additional checks:

```bash
npm run typecheck
npm run build
```

### Real OpenAI E2E tests

The E2E suite makes actual requests to OpenAI and requires a valid `OPENAI_API_KEY`.

```bash
export OPENAI_API_KEY="your-api-key"
npm run test:e2e
```

These tests exercise the complete request flow, from HTTP upload through to the OpenAI response.

They cover the four supplied JPEG images and an additional deliberately blurred PNG. The tests verify the expected readings and units while allowing confidence levels to vary between runs.

**Running E2E tests may incur OpenAI API charges.**

## Design Decisions

**OCR providers**

The OCR implementation is separated from the Express application behind a provider interface. This keeps HTTP handling independent of the recognition service and allows the application to switch between mock and real OCR.

The mock provider uses predefined results based on the supplied filenames. OpenAI handles actual image recognition using `gpt-4.1-mini` and structured JSON responses.

If no API key is configured, the application uses the mock provider automatically. Setting `OCR_PROVIDER=mock` explicitly forces mock mode.

**Image validation**

Uploads are limited to JPEG and PNG files, with a maximum decoded size of 5 MiB. Images are checked for valid content rather than relying solely on their file extension or MIME type.

Both multipart and Base64 requests follow the same validation rules.

**Single-image requests**

The endpoint accepts one image at a time. Multiple uploads are rejected explicitly to keep the API contract predictable.

**Units and confidence**

The provider returns a reading with its unit and a confidence level. When the image does not clearly indicate a unit, the implementation defaults to miles.

Confidence is reported by the OCR provider rather than calculated independently by the API.

## GitHub Actions

Two workflows provide automated checks:

- **CI:** Runs typechecking, unit/API tests and the build on pushes and pull requests, using Node.js 22 and 24.
- **OCR E2E:** Runs the real OpenAI test suite on pushes to `main` and can also be triggered manually.

The E2E workflow requires an `OPENAI_API_KEY` repository secret, configured under:

**Settings → Secrets and variables → Actions → New repository secret**

Since these tests use the real OpenAI API, they may incur usage costs when triggered.

## AI-Assisted Development

OpenAI Codex was used to assist with test-driven development, implementation, refactoring and documentation.

The AI conversation transcript is included separately with the assessment submission.
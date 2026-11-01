# Just Insure odometer OCR API

This take-home service reads a vehicle's total mileage from a dashboard photo. It uses Node.js, Express and strict TypeScript. You can try it locally with the supplied photos and no credentials, or send images to OpenAI for recognition.

## Getting started

1. **Install prerequisites.** Node.js 22 or later and npm are required. Git is recommended for cloning the repository. The examples below use Bash (macOS, Linux or Git Bash on Windows) and curl, but you can use any HTTP client, such as Postman or Bruno, to test the API.

2. **Clone and install** the assessment implementation.

   ```bash
   git clone https://github.com/georgipavlov96/backend-exercise-odometer.git
   cd backend-exercise-odometer
   npm ci
   ```

3. **Start in mock mode.** Run this from the project directory. It works without an API key, even if you already have a key configured. The application reads environment variables from the process. Its start script does not load a `.env` file.

   ```bash
   OCR_PROVIDER=mock npm start
   ```

4. **Try a photo.** Leave the server running and open a second terminal in the project directory. The default URL is `http://localhost:3000`. To use another port, set `PORT` in the server environment and adjust the URL below.

   ```bash
   curl http://localhost:3000/health
   curl -F 'image=@images/odometer-blurry.png;type=image/png' http://localhost:3000/odometer/reading
   ```

   The health check returns `{"status":"ok"}`. The upload returns `{"reading":48253,"unit":"miles","confidence":"med"}` in mock mode.

5. **Stop or switch providers.** Press **Ctrl+C** in the server terminal to stop it. For real recognition, obtain a key as described below, then run these commands in that terminal. Paste the key at the hidden prompt. The exported variable also works for local E2E tests in the same shell.

   ```bash
   read -rsp 'OpenAI API key: ' OPENAI_API_KEY; echo
   export OPENAI_API_KEY
   OCR_PROVIDER=openai npm start
   ```

For development, `npm run dev` restarts the server on source changes. `npm run typecheck` checks source and tests, and `npm run build` compiles the application to `dist/`. A build is optional for `npm start`.

## Obtaining an OpenAI API key

1. Sign in or create an account on the [OpenAI Platform](https://platform.openai.com/).
2. Create a new secret key on the [API keys page](https://platform.openai.com/api-keys).
3. Configure API billing or ensure your API organization has available credits. ChatGPT subscriptions and API billing are separate.
4. Set the key as the server-side `OPENAI_API_KEY` environment variable using the prompt above. Never commit it to Git or expose it in client-side code.

## HTTP API

**`POST /odometer/reading`** accepts one JPEG or PNG per request. For multipart uploads, use the `image` file field as in the quick start. Extra files or an unexpected file field return HTTP 400.

For JSON, send a single `image` string containing standard Base64 with canonical padding and no whitespace or data URL prefix.

This example encodes an existing JPEG and streams the JSON body to curl. Use the real provider to get a reading from this request. JSON carries no filename for the mock to look up.

```bash
node -e "const fs = require('node:fs'); const image = fs.readFileSync('images/33c24909-e9dd-46d3-8e7f-c44fd9896537.jpeg', 'base64'); process.stdout.write(JSON.stringify({ image }))" |
  curl -H 'Content-Type: application/json' --data-binary @- http://localhost:3000/odometer/reading
```

Both formats share the same **5 MiB (5,242,880 bytes)** limit on image bytes after Base64 decoding. Uploads are buffered in memory, so the limit prevents excessively large uploads and unnecessary memory usage. The JSON parser also caps the encoded body.

Multipart checks the declared MIME type, then both paths check the file signature and decode the image with `jpeg-js` or `pngjs` to catch corruption.

### Successful response

HTTP 200 returns a numeric reading (including decimals) or a valid provider result with `reading: null`.

Units are `miles` or `km`. Confidence is `high`, `med` or `low`.

```json
{
  "reading": 62690.5,
  "unit": "miles",
  "confidence": "high"
}
```

| Field | Description |
| --- | --- |
| `reading` | Extracted odometer value, or `null` if no reliable reading is available |
| `unit` | `miles` or `km` |
| `confidence` | `high`, `med` or `low` |

### Error responses

Errors contain an `error` code and a `message`.

For example, HTTP 422 returns:

```json
{
  "error": "UNREADABLE_IMAGE",
  "message": "Could not extract a mileage reading from the provided image"
}
```

| HTTP | Error code | When it occurs |
| --- | --- | --- |
| 400 | `MISSING_IMAGE` / `EMPTY_IMAGE` | The image is missing or contains zero bytes. |
| 400 | `INVALID_UPLOAD` / `INVALID_IMAGE` | The request or Base64 is malformed, or the JPEG/PNG data is corrupt. |
| 413 | `FILE_TOO_LARGE` | The image or encoded request exceeds its limit. |
| 415 | `UNSUPPORTED_FILE_TYPE` | The file type is unsupported. |
| 422 | `UNREADABLE_IMAGE` | The OCR result is invalid or cannot be interpreted as a valid odometer reading. |
| 500 | `INTERNAL_ERROR` | An unexpected application or external API error occurs. The client receives a generic message. |

### Health check

**`GET /health`** returns a simple status response:

```bash
curl http://localhost:3000/health
```

```json
{
  "status": "ok"
}
```

## OCR design and trade-offs

- **OCR approach:** I chose a vision model rather than a traditional OCR library because dashboard images often contain multiple numbers, labels and gauges. A vision model can use this context to identify the total odometer reading rather than simply extracting every visible number. The trade-offs are additional latency, API cost and reliance on an external service. Results can also vary depending on image quality, so the model is instructed not to guess unreadable digits.

- **Provider abstraction:** OCR is separated from the HTTP layer behind a provider interface. This allows the recognition implementation to be replaced or mocked without changing the API.

- **Mock:** Selected when `OCR_PROVIDER=mock` or `OPENAI_API_KEY` is absent. It maps the five supplied filenames to fixed results and performs no actual recognition. Unknown, renamed or missing filenames produce HTTP 422, including valid Base64 uploads. This allows the service to be evaluated without credentials, but it cannot recognise arbitrary images.

- **OpenAI:** Selected when an API key is present and mock mode is not forced. The provider sends validated image bytes to `gpt-4.1-mini` through the Responses API, requests structured JSON and validates the result.

- **Image validation:** JPEG and PNG uploads are limited to 5 MiB. Both multipart and Base64 requests undergo format and content validation. Images are buffered in memory for simplicity, which is reasonable for this small exercise but would need reconsideration for larger files or higher request volumes.

- **Units:** The implementation defaults to miles when no unit is visible because the exercise uses miles in its example and does not specify a fallback. This is an explicit assumption rather than a guaranteed interpretation. Explicit kilometres produce `km`.

- **Confidence:** Confidence is reported by the vision model rather than calculated independently. It is a qualitative indication of certainty, not a calibrated probability. When digits cannot be read reliably, the model is instructed to return `null` instead of guessing.

## Testing

Jest and Supertest start the Express app for HTTP tests. You do not need a separately running server.

| Directory | Coverage | Command |
| --- | --- | --- |
| `tests/unit/` | OCR providers, factory selection and component behaviour | `npm test -- tests/unit` |
| `tests/api/` | Express health, uploads, validation and OCR responses via Supertest, with OCR mocked | `npm test -- tests/api` |
| `tests/e2e/` | Complete HTTP requests through the real OpenAI provider | `npm run test:e2e` |
| `tests/fixtures/` | Shared test inputs and expected results | Used by the suites above |

**`npm test` runs the unit and API suites without contacting OpenAI.**

The separate E2E command requires a valid `OPENAI_API_KEY` and configured API billing or available credits. It forces the real provider and may incur charges.

```bash
npm test
npm run typecheck
npm run build
```

To run the real OCR tests:

```bash
npm run test:e2e
```

The E2E suite checks four JPEG fixtures across multipart and Base64 requests, plus the deliberately blurry synthetic PNG (48,253 miles). It checks the expected readings and accepts any supported confidence level.

## GitHub Actions

- **CI:** Runs on pushes and pull requests. It installs dependencies using `npm ci`, type-checks, runs the normal tests and builds on Node.js 22 and 24.

- **OCR E2E:** Runs on pushes to `main` or manually via **Actions → OCR E2E → Run workflow**. It runs the real, potentially billable suite on Node.js 24. Runs are queued to avoid overlap, and the job has a ten-minute timeout.

For OCR E2E, go to:

**Repository Settings → Secrets and variables → Actions → New repository secret**

Name the secret `OPENAI_API_KEY`, paste the API key as its value and select **Add secret**.

The workflow fails before running the tests if the secret is missing or blank.

## AI-assisted development

OpenAI Codex assisted with test-driven development, implementation, refactoring and documentation.
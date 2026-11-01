# Just Insure odometer OCR API

This take-home service reads a vehicle's total mileage from a dashboard photo. It uses Node.js, Express and strict TypeScript. You can try it locally with the supplied photos and no credentials, or send images to OpenAI for recognition.

## Getting started

1. **Install prerequisites.** Use Node.js 22 or later with npm, Git and curl. The examples below use Bash (macOS, Linux or Git Bash on Windows).
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
3. Configure API billing or ensure your API organization has available credits. ChatGPT Plus/Pro subscriptions and API billing are separate. Eligible subscription credits must be claimed for your API organization. [OpenAI credit guidance](https://developers.openai.com/api/docs/guides/chatgpt-api-credits)
4. Set the key as the server-side `OPENAI_API_KEY` environment variable using the prompt above. Never commit it to Git or expose it in client-side code. [OpenAI authentication guidance](https://developers.openai.com/api/reference/overview#authentication)

## HTTP API

**`POST /odometer/reading`** accepts one JPEG or PNG per request. For multipart uploads, use the `image` file field as in the quick start. Extra files or an unexpected file field return HTTP 400. For JSON, send a single `image` string containing standard Base64 with canonical padding and no whitespace or data URL prefix.

This example encodes an existing JPEG and streams the JSON body to curl. Use the real provider to get a reading from this request. JSON carries no filename for the mock to look up.

```bash
node -e "const fs = require('node:fs'); const image = fs.readFileSync('images/33c24909-e9dd-46d3-8e7f-c44fd9896537.jpeg', 'base64'); process.stdout.write(JSON.stringify({ image }))" |
  curl -H 'Content-Type: application/json' --data-binary @- http://localhost:3000/odometer/reading
```

Both formats share the same **5 MiB (5,242,880 byte)** limit on image bytes after Base64 decoding. Uploads are buffered in memory, so the limit prevents excessively large uploads and unnecessary memory usage. The JSON parser also caps the encoded body. Multipart checks the declared MIME type, then both paths check the file signature and decode the image with `jpeg-js` or `pngjs` to catch corruption.

**HTTP 200** returns a numeric reading (including decimals) or a valid provider result with `reading: null`. Units are `miles` or `km`. Confidence is `high`, `med` or `low`.

```json
{"reading":62690.5,"unit":"miles","confidence":"high"}
```

Errors have an `error` code and a `message`. For example, HTTP 422 returns:

```json
{"error":"UNREADABLE_IMAGE","message":"Could not extract a mileage reading from the provided image"}
```

| HTTP | Error code | When it occurs |
| --- | --- | --- |
| 400 | `MISSING_IMAGE` / `EMPTY_IMAGE` | The image is missing or contains zero bytes. |
| 400 | `INVALID_UPLOAD` / `INVALID_IMAGE` | The request or Base64 is malformed, or the JPEG/PNG data is corrupt. |
| 413 | `FILE_TOO_LARGE` | The image or encoded request exceeds its limit. |
| 415 | `UNSUPPORTED_FILE_TYPE` | The file type is unsupported. |
| 422 | `UNREADABLE_IMAGE` | The provider returns an error, including when the OpenAI SDK call fails or its output fails validation. |
| 500 | `INTERNAL_ERROR` | An unexpected exception escapes the OCR handler. The client receives a generic message. |

## OCR design and trade-offs

- **Mock** is selected when `OCR_PROVIDER=mock` or `OPENAI_API_KEY` is absent. It maps the five supplied filenames to fixed results and performs no recognition. Unknown, renamed or missing filenames produce HTTP 422, including valid Base64 uploads.
- **OpenAI** is selected when a key is present and mock mode is not forced. The provider sends validated image bytes to `gpt-4.1-mini` through the Responses API, requests structured JSON and validates the result. This supports new photos but requires network access and incurs API usage. Blurred digits can affect the reading and confidence.
- **Units** default to miles when no unit is visible because the exercise gives a miles example and leaves the fallback unspecified. This default is an assessment assumption. Explicit kilometres produce `km`.

## Testing

Jest and Supertest start the Express app for HTTP tests. You do not need a separately running server.

| Directory | Coverage | Command |
| --- | --- | --- |
| `tests/unit/` | OCR providers, factory selection and component behaviour | `npm test -- tests/unit` |
| `tests/api/` | Express health, uploads, validation and OCR responses via Supertest, with OCR mocked | `npm test -- tests/api` |
| `tests/e2e/` | Complete HTTP requests through the real OpenAI provider | `npm run test:e2e` |
| `tests/fixtures/` | Shared test inputs and expected results | Used by the suites above |

**`npm test` runs the unit and API suites without contacting OpenAI.** The separate E2E command requires a valid `OPENAI_API_KEY` and configured API billing or available credits. It forces the real provider and may incur charges. It checks four JPEG fixtures across multipart and Base64 requests, plus the deliberately blurry synthetic PNG (48,253 miles). It checks the expected readings and accepts any supported confidence level.

## GitHub Actions

- **CI** runs on pushes and pull requests. It installs with `npm ci`, type-checks, runs the normal tests and builds on Node.js 22 and 24.
- **OCR E2E** runs on pushes to `main` or manually via **Actions → OCR E2E → Run workflow**. It runs the real, potentially billable suite on Node.js 24. Runs are queued to avoid overlap and the job has a ten-minute timeout.
- For OCR E2E, go to **repository Settings → Secrets and variables → Actions → New repository secret**. Name it `OPENAI_API_KEY`, paste the secret key as its value and select **Add secret**. The workflow fails before running the tests if the secret is missing or blank.

## AI-assisted development

OpenAI Codex assisted with test-driven development, implementation, refactoring and documentation. The conversation transcript is provided separately with the assessment submission.

# Exercise: Odometer Reading Service

## Local development

Requires Node.js 18 or later and npm.

```
npm ci
npm run typecheck
npm test
npm run build
npm start
```

TypeScript strict mode is enabled. Jest runs TypeScript tests through ts-jest.
Source files live in src/, tests in tests/, and compiled output goes to dist/. 
The Express application and routes are defined in src/app.ts, 
while src/index.ts starts the server on port 3000 (or the PORT environment variable).

`GET /health` returns HTTP 200 with `{ "status": "ok" }`. The Jest test starts
the app on a temporary port and checks the HTTP response independently of the
server entry point.

## Image uploads

`POST /odometer/reading` accepts one JPEG or PNG file in the `image` field of a
`multipart/form-data` request. After checking the MIME type and file signature,
the server decodes the full image using `jpeg-js` or `pngjs` to validate its
contents. JPEG decoding is strict, and PNG checks include chunk CRCs. These are
the same decoders used by Jimp, without adding the full image-processing package.
The maximum file size is **5 MiB (5,242,880 bytes)**. Uploads are buffered
in memory, so this limit prevents excessively large uploads and unnecessary
memory usage while allowing typical odometer photos.

The endpoint currently validates uploads only; the separate OCR service is not
yet connected to the route.

| Upload | HTTP status |
| --- | --- |
| Valid JPEG or PNG | 200, with `{ "status": "accepted" }` |
| Missing or empty image | 400 |
| Corrupted JPEG or PNG data | 400 |
| Malformed upload, unexpected file field, or multiple files | 400 |
| Unsupported file type or non-image content disguised as JPEG/PNG | 415 |
| File exceeds 5 MiB | 413 |

Errors return JSON with `error` and `message` fields.

## OCR

`src/ocr/` uses Tesseract.js as its only OCR engine. It runs locally on Node.js
18+ without credentials, using `Tesseract.recognize(image, 'eng')` with default
settings. Tesseract may download and cache English model data on first use.
We chose it for its straightforward Node.js
integration. There is no image preprocessing or EXIF rotation handling. Blurry
images, digital displays and rotated photos can produce missing or incorrect
readings, so the supplied-image acceptance tests may remain failing.

The service accepts a Buffer independently of Express and recognises it once.
A separate text parser looks for one distinct number with at least four integer
digits, allowing decimals and comma-separated thousands. This simple heuristic
ignores small dashboard values but cannot reliably distinguish mileage from other
large numbers. Missing or conflicting readings and OCR errors return `UNREADABLE_IMAGE`.
Confidence is a heuristic: `high` requires an explicit unit and a Tesseract
score of at least 85; otherwise an unambiguous reading is `medium`. Low scores
alone do not reject a reading, and confidence never resolves conflicting values.
These scores are not calibrated probabilities of an accurate mileage reading.

### Unit assumption

For OCR results, we will default to `"miles"` when the odometer unit is not
visible: the exercise uses miles in its example response and does not specify
how to handle missing units. This is an exercise-specific assumption, not a
unit confirmed by OCR. When kilometres are explicitly visible, we will return
`"km"` instead.

## Overview

**Estimated time:** 3–4 hours

Please don't spend more than that. We respect your time and will evaluate accordingly.

At Just Insure, we offer pay-per-mile car insurance. One of the ways we verify a customer's mileage is by asking them to submit a photo of their odometer. To process these at scale, we need a service that can automatically extract the mileage reading from an image.

This is a real problem we've solved at Just. Your task is to build a small service that does the same thing.

---

## The Task

Build a Node.js HTTP service in TypeScript with a single endpoint:

```
POST /odometer/reading
```

The endpoint should:

- Accept an image (JPEG or PNG) of a car odometer
- Return the mileage reading extracted from the image
- Handle cases where the reading cannot be determined

### Success Response

```json
{
  "reading": 48253,
  "unit": "miles",
  "confidence": "high"
}
```

### Unreadable Image Response

```json
{
  "error": "UNREADABLE_IMAGE",
  "message": "Could not extract a mileage reading from the provided image"
}
```

---

## Requirements

### Functional Requirements

- Accept image uploads via:
    - `multipart/form-data`, or
    - Base64-encoded image in a JSON payload
- Extract the numeric odometer reading from the image
- Return a structured JSON response
- Handle error cases gracefully:
    - Missing image
    - Unsupported file type
    - Unreadable image
    - Other invalid inputs

### Non-Functional Requirements

- Written in TypeScript with strict mode enabled
- Include tests
- Include a README with setup instructions

### OCR Approach

Use any OCR solution you think is appropriate.

If your chosen approach requires credentials:

- Include clear setup instructions
- Provide a mock/stub mode so we can evaluate the service without creating an account

---

## Test Images

A set of odometer images is included in the `/images` folder of the base repository.

Clone the repository to get started:

```bash
git clone https://github.com/just-insure/backend-exercise-odometer.git
```

---

## What to Submit

Provide a folder or repository link containing:

- Service source code
- Tests
- README with setup instructions
- A copy of your chat with Claude (or a similar AI assistant)

Using AI such as Claude for this task is completely fine, and we ask that you include a copy of your chat/conversation with the AI assistant as part of your submission.

To be clear about why: we want to see how you think about a problem, and how you work with an agent. We're interested in how you use AI to help *yourself* think through a problem.

---

## How We'll Evaluate Your Submission

We are not looking for a production-ready system.

We are evaluating:

- How you think through problems
- How you structure code
- How you communicate technical decisions

---

## Questions?

If anything is unclear, please contact:

[**vitalij@just.insure**](mailto:vitalij@just.insure)

We'd rather you ask than make assumptions.

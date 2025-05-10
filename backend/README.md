# CalendarSnap Backend (MVP)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Set up Google Cloud Vision API credentials:
   - Create a Google Cloud project and enable the Vision API.
   - Download your service account JSON key.
   - Place the key at `./config/serviceAccount.json` (or your preferred location).
   - Create a `.env` file in the backend root with:
     ```
     GOOGLE_APPLICATION_CREDENTIALS=./config/serviceAccount.json
     ```
   - The backend uses [dotenv](https://www.npmjs.com/package/dotenv) to load environment variables from `.env` automatically.

## Running the Server

```bash
npm start
```

## API Endpoints

### POST /api/upload

- Upload an image and receive extracted text (OCR).
- Form field: `image` (file)
- Response: `{ text: string }`

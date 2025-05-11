const express = require('express');
const multer = require('multer');
const { ImageAnnotatorClient } = require('@google-cloud/vision');
const { LanguageServiceClient } = require('@google-cloud/language');
const chrono = require('chrono-node');
const nlp = require('compromise');
const path = require('path');
const fs = require('fs');
const { VertexAI } = require('@google-cloud/vertexai');
const { google } = require('googleapis');
const { OpenAI } = require('openai');
const { DateTime } = require('luxon');
require('dotenv').config();
const router = express.Router();

// Set up multer for file uploads (store in memory for MVP)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Load Google service account credentials from env variable
let serviceAccount = undefined;
if (process.env.NLP_SERVICE_ACCOUNT_JSON) {
  try {
    serviceAccount = JSON.parse(process.env.NLP_SERVICE_ACCOUNT_JSON);
  } catch (e) {
    console.error('Failed to parse NLP_SERVICE_ACCOUNT_JSON:', e);
  }
}

// Google Cloud Vision and NLP clients
const visionClient = serviceAccount
  ? new ImageAnnotatorClient({ credentials: serviceAccount })
  : new ImageAnnotatorClient();
const languageClient = serviceAccount
  ? new LanguageServiceClient({ credentials: serviceAccount })
  : new LanguageServiceClient();

// Set up Vertex AI client for LLM extraction (Gemini/PaLM 2)
let vertexAiClient;
let projectId;
if (serviceAccount) {
  projectId = serviceAccount.project_id;
  vertexAiClient = new VertexAI({
    project: projectId,
    location: 'us-central1',
    googleAuthOptions: { credentials: serviceAccount },
  });
}

// OpenAI for Vision OCR and event extraction
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Refactored: LLM event extraction as a function
async function extractEventInfoWithLLM(imageBuffer) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Missing OpenAI API key.');
  }
  // Convert image buffer to base64
  const base64Image = imageBuffer.toString('base64');
  // Prepare prompt for event extraction
  const prompt = `You are an assistant that extracts event information from images of flyers or emails. First, perform OCR to extract all text from the image. Then, extract the following event fields from the text: title, date, time, location, description, attendees. Return a JSON object with these keys. If a field is missing, use an empty string. Only return the JSON object.`;
  // Call OpenAI Vision API (GPT-4-vision-preview)
  const response = await openai.chat.completions.create({

    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: prompt,
      },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/png;base64,${base64Image}` } }
        ],
      },
    ],
    max_tokens: 512,
    temperature: 0.2,
  });
  // Parse the model's response robustly
  let fields = {};
  let content = response.choices?.[0]?.message?.content || '';
  // Remove Markdown code block if present
  content = content.replace(/^```json\s*|```$/g, '').trim();
  fields = JSON.parse(content);
  // --- Normalize date ---
  if (fields.date) {
    const chronoDate = chrono.parse(fields.date);
    if (chronoDate.length > 0 && chronoDate[0].start) {
      const d = chronoDate[0].start.date();
      fields.date = d.toISOString().slice(0, 10);
    }
  }
  // --- Normalize time ---
  if (fields.time) {
    const chronoTime = chrono.parse(fields.time);
    if (chronoTime.length > 0 && chronoTime[0].start) {
      const opts = { hour: '2-digit', minute: '2-digit', hour12: false };
      const start = chronoTime[0].start.date();
      let timeStr = start.toLocaleTimeString('en-US', opts).slice(0,5);
      if (chronoTime[0].end) {
        const end = chronoTime[0].end.date();
        timeStr += '–' + end.toLocaleTimeString('en-US', opts).slice(0,5);
      }
      fields.time = timeStr;
    }
  }
  return fields;
}

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

// POST /api/upload - upload image and extract text
router.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded.' });
    }
    // Use OpenAI Vision API for OCR and event extraction
    const eventInfo = await extractEventInfoWithLLM(req.file.buffer);
    res.json(eventInfo);
  } catch (error) {
    console.error('OCR/LLM error:', error);
    res.status(500).json({ error: 'Failed to process image with ChatGPT Vision.', details: error.message });
  }
});

// POST /api/add-to-calendar - add event to user's Google Calendar
router.post('/api/add-to-calendar', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Missing access token.' });
    }
    const { title, date, time, location, description, attendees } = req.body;
    if (!title || !date || !time) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }
    // Parse date and time to RFC3339 in America/Los_Angeles timezone
    const parseDateTime = (dateStr, timeStr) => {
      if (!dateStr || !timeStr) return null;
      // Try to parse with chrono-node first
      const chronoResult = chrono.parse(dateStr + ' ' + timeStr);
      if (chronoResult.length > 0 && chronoResult[0].start) {
        // Use luxon to force PST
        const d = chronoResult[0].start.date();
        const dt = DateTime.fromJSDate(d, { zone: 'America/Los_Angeles' });
        return dt.toISO();
      }
      // fallback: try to parse with luxon directly
      const dt = DateTime.fromFormat(`${dateStr} ${timeStr}`, 'MM/dd/yyyy HH:mm', { zone: 'America/Los_Angeles' });
      if (dt.isValid) return dt.toISO();
      // fallback to naive Date (not recommended)
      return new Date(`${dateStr} ${timeStr}`).toISOString();
    };
    const [startTime, endTime] = time.split(/[–-]/);
    const startDateTime = parseDateTime(date, startTime);
    const endDateTime = parseDateTime(date, endTime);
    // Prepare event object
    const event = {
      summary: title,
      start: { dateTime: startDateTime, timeZone: 'America/Los_Angeles' },
      end: { dateTime: endDateTime, timeZone: 'America/Los_Angeles' },
      location: location || undefined,
      description: description || undefined,
      // attendees: attendees
      //   ? attendees.split(/,|;/).map(emailOrName => ({ email: emailOrName.trim() }))
      //   : undefined,
    };
    // Set up Google API client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    // Insert event
    await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Add to calendar error:', error);
    res.status(500).json({ error: 'Failed to add event to Google Calendar.' });
  }
});

module.exports = router;

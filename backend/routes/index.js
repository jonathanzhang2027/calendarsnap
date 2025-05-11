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

// Refactored: LLM event extraction as a function
async function extractEventInfoWithLLM(text) {
  if (!vertexAiClient) {
    throw new Error('Vertex AI client not configured.');
  }
  const prompt = `Extract the following event fields from the text below. Return a JSON object with keys: title, date, time, location, description, attendees. If a field is missing, use an empty string. Text: """
${text}
"""`;
  const generativeModel = vertexAiClient.getGenerativeModel({
    model: 'gemini-2.0-flash',
  });
  const result = await generativeModel.generateContent({
    contents: [
      { role: 'user', parts: [{ text: prompt }] }
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 512,
    },
  });
  let fields = {};
  const response = result.response || result;
  let content = response.candidates?.[0]?.content?.parts?.[0]?.text || response.candidates?.[0]?.content || response.candidates?.[0]?.output || response.candidates?.[0]?.text || '';
  // Remove Markdown code block if present
  content = content.replace(/^```json\s*|```$/g, '').trim();
  fields = JSON.parse(content);

  // --- Normalize date ---
  if (fields.date) {
    const chronoDate = chrono.parse(fields.date);
    if (chronoDate.length > 0 && chronoDate[0].start) {
      const d = chronoDate[0].start.date();
      // Format as YYYY-MM-DD
      fields.date = d.toISOString().slice(0, 10);
    }
  }
  // --- Normalize time ---
  if (fields.time) {
    // Try to parse as a range (e.g., "8:00 to 7:00 PM" or "7–8PM")
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
    // Use Google Vision API to extract text from the image buffer
    const [result] = await visionClient.textDetection({ image: { content: req.file.buffer } });
    const detections = result.textAnnotations;
    const text = detections && detections.length > 0 ? detections[0].description : '';
    // Extract event info using LLM
    const eventInfo = await extractEventInfoWithLLM(text);
    res.json({ text, ...eventInfo });
  } catch (error) {
    console.error('OCR error:', error);
    res.status(500).json({ error: 'Failed to process image.' });
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
    // Parse date and time to RFC3339 using chrono-node for robust parsing
    const parseDateTime = (dateStr, timeStr) => {
      const chronoResult = chrono.parse(dateStr + ' ' + timeStr);
      if (chronoResult.length > 0 && chronoResult[0].start) {
        return chronoResult[0].start.date().toISOString();
      }
      // fallback to naive Date
      const d = new Date(`${dateStr} ${timeStr}`);
      return d.toISOString();
    };
    const startDateTime = parseDateTime(date, time);
    const endDateTime = parseDateTime(date, time.split(/[–-]/)[1]);
    // Prepare event object
    const event = {
      summary: title,
      start: { dateTime: startDateTime },
      end: { dateTime: endDateTime },
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

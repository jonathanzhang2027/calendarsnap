const express = require('express');
const multer = require('multer');
const { ImageAnnotatorClient } = require('@google-cloud/vision');
const { LanguageServiceClient } = require('@google-cloud/language');
const chrono = require('chrono-node');
const nlp = require('compromise');
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');

const router = express.Router();

// Set up multer for file uploads (store in memory for MVP)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Google Cloud Vision and NLP clients
const visionClient = new ImageAnnotatorClient();
const languageClient = new LanguageServiceClient();

function extractEventInfoFromOcr(text) {
  // --- 1. Split into clean lines up-front ---
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  // --- 2. Parse all chrono results ---
  const chronoResults = chrono.parse(text);

  // --- 3. Date & Time extraction ---
  let date = '', time = '';

  // 3a) Look for a chrono result with both start & end (a true range)
  const rangeResult = chronoResults.find(r =>
    r.start.isCertain('hour') && r.end && r.start.isCertain('day')
  );

  if (rangeResult) {
    // format date
    date = rangeResult.start.date().toLocaleDateString('en-US');
    // format time as "7:00 PM – 8:00 PM"
    const opts = { hour: 'numeric', minute: '2-digit' };
    const s = rangeResult.start.date().toLocaleTimeString('en-US', opts);
    const e = rangeResult.end.date().toLocaleTimeString('en-US', opts);
    time = `${s} – ${e}`;
  } else {
    // 3b) Fallback: look for a strict time-range regex (e.g. "7-8PM", "7:15–8:30 pm")
    const timeRangeRegex = /\b(\d{1,2})(?::(\d{2}))?\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)?\b/i;
    const m = text.match(timeRangeRegex);
    if (m) {
      let [ , h1, m1='00', h2, m2='00', mer ] = m;
      mer = mer ? mer.toUpperCase() : 'PM';
      const norm = (h, mm) => {
        let hh = parseInt(h,10);
        if (mer === 'PM' && hh < 12) hh += 12;
        if (mer === 'AM' && hh === 12) hh = 0;
        return new Date(2025,4,13, hh, parseInt(mm,10));
      };
      const d1 = norm(h1, m1), d2 = norm(h2, m2);
      const opts2 = { hour: 'numeric', minute: '2-digit' };
      time = `${d1.toLocaleTimeString('en-US', opts2)} – ${d2.toLocaleTimeString('en-US', opts2)}`;
      date = chronoResults[0]?.start
        ? chronoResults[0].start.date().toLocaleDateString('en-US')
        : date;
    } else if (chronoResults.length > 0) {
      // 3c) Final fallback: single date/time
      const single = chronoResults[0];
      if (single.start) {
        date = single.start.date().toLocaleDateString('en-US');
        const opts3 = { hour: 'numeric', minute: '2-digit' };
        time = single.start.date().toLocaleTimeString('en-US', opts3);
      }
    }
  }

  // --- 4. Title extraction by line-position relative to date ---
  let title = '';
  const datePattern = date
    ? new RegExp(date.replace(/\//g,'\\/'))
    : /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i;
  const dateLineIdx = lines.findIndex(l => datePattern.test(l));
  for (let i = dateLineIdx - 1; i >= 0; i--) {
    const l = lines[i];
    if (
      l.split(/\s+/).length <= 6 &&
      !/^[A-Z\s,]+$/.test(l) &&
      !/^[\d\W]+$/.test(l) &&
      !chrono.parse(l).length
    ) {
      title = l;
      break;
    }
  }
  if (!title) {
    title = lines.find(l => /talk|event/i.test(l)) || lines[0];
  }

  // --- 5. Location extraction (improved) ---
  let location = '';
  const locationKeywords = /\b(location|venue|address|at|room|building|hall|auditorium|center|centre|suite|floor|street|st\.|ave\.|road|rd\.|blvd\.|park|plaza|esb|zoom|meet|google|teams|classroom|online|virtual|lab|library|lounge|cafeteria|ballroom|theater|theatre|conference|1001|101|202|303|104|105|106|107|108|109|110|111|112|113|114|115|116|117|118|119|120)\b/i;
  // Prefer lines near the date/time or with location keywords
  let searchStart = Math.max(0, dateLineIdx - 2);
  let searchEnd = Math.min(lines.length, dateLineIdx + 5);
  for (let i = searchStart; i < searchEnd; i++) {
    if (locationKeywords.test(lines[i])) {
      location = lines[i];
      break;
    }
  }
  if (!location) {
    location = lines.find(l => locationKeywords.test(l)) || '';
  }

  // --- 6. Attendees extraction (improved) ---
  let attendees = '';
  const attendeesKeywords = /\b(with|hosted by|presented by|featuring|speaker|panel|attendees|guests|by:|featuring:)\b/i;
  const attLine = lines.find(l => attendeesKeywords.test(l));
  if (attLine) {
    const match = attLine.match(/(?:with|hosted by|presented by|featuring|speaker|panel|attendees|guests|by:|featuring:)\s*(.+)/i);
    attendees = match ? match[1].trim() : attLine;
  }

  // --- 7. Description extraction (improved) ---
  let description = '';
  // Use lines after title/date/time that are not location/attendees
  let descStart = dateLineIdx !== -1 ? dateLineIdx + 1 : 0;
  const descLines = [];
  for (let i = descStart; i < lines.length; i++) {
    if (
      !locationKeywords.test(lines[i]) &&
      !attendeesKeywords.test(lines[i]) &&
      !chrono.parse(lines[i]).length &&
      lines[i] !== title
    ) {
      descLines.push(lines[i]);
    }
  }
  description = descLines.slice(0, 3).join(' ');

  // Always return all fields, even if empty
  return { title, date, time, location, description, attendees };
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
    // Extract event info using Google NLP
    const eventInfo = await extractEventInfoFromOcr(text);
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
    // Parse start/end time from time string (e.g. "7:00 PM – 8:00 PM")
    let startTime = '', endTime = '';
    const timeRange = time.split(/[–-]/);
    if (timeRange.length === 2) {
      startTime = timeRange[0].trim();
      endTime = timeRange[1].trim();
    } else {
      startTime = time.trim();
      endTime = '';
    }
    // Parse date and time to RFC3339
    const parseDateTime = (dateStr, timeStr) => {
      const d = new Date(`${dateStr} ${timeStr}`);
      return d.toISOString();
    };
    const startDateTime = parseDateTime(date, startTime);
    const endDateTime = endTime ? parseDateTime(date, endTime) : undefined;
    // Prepare event object
    const event = {
      summary: title,
      start: { dateTime: startDateTime },
      end: { dateTime: endDateTime || startDateTime },
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

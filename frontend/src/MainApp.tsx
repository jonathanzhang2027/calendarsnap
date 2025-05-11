import React, { useState } from "react";
import "./App.css";
import { Link } from "react-router-dom";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000/api";

type EventInfo = {
  text: string;
  title: string;
  date: string;
  time: string;
  location?: string;
  description?: string;
  attendees?: string;
};

const MainApp: React.FC = () => {
  const [preview, setPreview] = useState<string | null>(null);
  const [extractedInfo, setExtractedInfo] = useState<EventInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editedEvent, setEditedEvent] = useState<Partial<EventInfo>>({});
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarMessage, setCalendarMessage] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPreview(URL.createObjectURL(file));
      setExtractedInfo(null);
      setEditedEvent({});
      setError(null);
      uploadImage(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setPreview(URL.createObjectURL(file));
      setExtractedInfo(null);
      setEditedEvent({});
      setError(null);
      uploadImage(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const uploadImage = async (file: File) => {
    setLoading(true);
    setExtractedInfo(null);
    setEditedEvent({});
    setError(null);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const response = await fetch(API_URL + "/upload", {
        method: "POST",
        body: formData,
      });
      console.log(response);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to extract text from image.");
      }
      const data = await response.json();
      console.log(data);
      setExtractedInfo(data);
      setEditedEvent({
        title: data.title,
        date: data.date,
        time: data.time,
        location: data.location,
        description: data.description,
        attendees: data.attendees,
      });
    } catch (err: any) {
      setError(
        err.message ||
          "An error occurred while extracting text. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setEditedEvent((prev) => ({ ...prev, [name]: value }));
  };

  // Helper to convert MM/DD/YYYY to YYYY-MM-DD for input type="date"
  const toInputDate = (dateStr: string | undefined) => {
    if (!dateStr) return "";
    // Try to parse MM/DD/YYYY or similar
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      const [mm, dd, yyyy] = parts;
      return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    }
    // Already in yyyy-mm-dd
    return dateStr;
  };

  // Helper to convert YYYY-MM-DD to MM/DD/YYYY for backend
  const fromInputDate = (input: string) => {
    if (!input) return "";
    const [yyyy, mm, dd] = input.split("-");
    return `${mm}/${dd}/${yyyy}`;
  };

  const handleAddToCalendar = async () => {
    if (!editedEvent.title || !editedEvent.date || !editedEvent.time) {
      setCalendarMessage("Title, date, and time are required.");
      return;
    }
    setCalendarLoading(true);
    setCalendarMessage(null);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(API_URL + "/add-to-calendar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...editedEvent,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setCalendarMessage("Event added to Google Calendar!");
      } else {
        setCalendarMessage(data.error || "Failed to add event to calendar.");
      }
    } catch (err: any) {
      setCalendarMessage("An error occurred. Please try again.");
    } finally {
      setCalendarLoading(false);
    }
  };

  return (
    <div className="app-bg">
      <header className="app-header-card">
        <h1 className="main-title">CalendarSnap</h1>
        <p className="subtitle">
          Extract events from images and add them to your Google Calendar.
        </p>
      </header>
      <main className="main-content">
        <div className="card upload-card">
          <h2>Upload Event Image</h2>
          <div
            className="upload-area styled-upload"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            tabIndex={0}
            aria-label="Image upload area. Drag and drop or use the file input."
          >
            <p>Drag & drop an image here, or</p>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="file-input"
              aria-label="Upload image file"
              disabled={loading}
            />
          </div>
          {/* In-product privacy notice */}
          <div
            style={{
              textAlign: "center",
              color: "#666",
              fontSize: "0.95rem",
              margin: "0.5rem 0 0.5rem 0",
            }}
          >
            We only use your Google account to add events to your calendar. Your
            data is never stored or shared.
          </div>
          {/* Google Calendar link */}
          <div
            style={{
              textAlign: "center",
              marginTop: "0.5rem",
              marginBottom: "1rem",
            }}
          >
            <a
              href="https://calendar.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="google-calendar-link"
              style={{
                color: "#1976d2",
                textDecoration: "underline",
                fontWeight: 500,
                fontSize: "1.5rem",
              }}
            >
              Go to My Google Calendar
            </a>
          </div>
          {preview && (
            <div className="preview-section">
              <img
                src={preview}
                alt="Event preview"
                className="image-preview styled-preview"
              />
            </div>
          )}
        </div>
        <div className="card event-info-card">
          <h2>Extracted Event Information</h2>
          <div className="placeholder-info">
            {loading && (
              <div className="loading-overlay">
                <div className="lds-dual-ring large"></div>
                <p>Extracting text from image...</p>
              </div>
            )}
            {!loading && error && (
              <p style={{ color: "red" }} role="alert">
                {error}
              </p>
            )}
            {!loading && extractedInfo ? (
              <form className="event-info-form styled-form">
                <label>
                  <span style={{ fontWeight: "bold" }}>
                    Title<span style={{ color: "red" }}>*</span>:
                  </span>
                  <input
                    type="text"
                    name="title"
                    value={editedEvent.title ?? extractedInfo.title ?? ""}
                    onChange={handleFieldChange}
                    autoComplete="off"
                  />
                </label>
                <label>
                  <span style={{ fontWeight: "bold" }}>
                    Date<span style={{ color: "red" }}>*</span>:
                  </span>
                  <input
                    type="date"
                    name="date"
                    value={toInputDate(
                      editedEvent.date ?? extractedInfo.date ?? ""
                    )}
                    onChange={(e) => {
                      const val = fromInputDate(e.target.value);
                      setEditedEvent((prev) => ({ ...prev, date: val }));
                    }}
                    autoComplete="off"
                  />
                </label>
                <label>
                  <span style={{ fontWeight: "bold" }}>
                    Time<span style={{ color: "red" }}>*</span>:
                  </span>
                  <input
                    type="text"
                    name="time"
                    value={editedEvent.time ?? extractedInfo.time ?? ""}
                    onChange={handleFieldChange}
                    autoComplete="off"
                  />
                </label>
                <label>
                  Location:
                  <input
                    type="text"
                    name="location"
                    value={editedEvent.location ?? extractedInfo.location ?? ""}
                    onChange={handleFieldChange}
                    autoComplete="off"
                  />
                </label>
                <label>
                  Description:
                  <textarea
                    name="description"
                    value={
                      editedEvent.description ?? extractedInfo.description ?? ""
                    }
                    onChange={handleFieldChange}
                    rows={2}
                    style={{ width: "100%" }}
                  />
                </label>
                <label>
                  Attendees:
                  <input
                    type="text"
                    name="attendees"
                    value={
                      editedEvent.attendees ?? extractedInfo.attendees ?? ""
                    }
                    onChange={handleFieldChange}
                    autoComplete="off"
                  />
                </label>
                <button
                  className="google-login-button styled-calendar-btn"
                  style={{ marginTop: 16, marginBottom: 8 }}
                  onClick={handleAddToCalendar}
                  disabled={calendarLoading}
                  type="button"
                >
                  {calendarLoading ? "Adding..." : "Add to Google Calendar"}
                </button>
                {calendarMessage && (
                  <div
                    style={{
                      marginTop: 8,
                      color: calendarMessage.includes("success")
                        ? "green"
                        : "red",
                    }}
                  >
                    {calendarMessage}
                  </div>
                )}
              </form>
            ) : !loading ? (
              <p>No event information extracted yet.</p>
            ) : null}
          </div>
        </div>
      </main>
      <div
        style={{ textAlign: "center", marginTop: "2rem", marginBottom: "1rem" }}
      >
        <Link
          to="/privacy"
          style={{
            color: "#888",
            textDecoration: "underline",
            fontSize: "1rem",
          }}
        >
          Privacy Policy
        </Link>
      </div>
    </div>
  );
};

export default MainApp;

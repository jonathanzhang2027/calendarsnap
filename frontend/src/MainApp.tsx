import React, { useState } from "react";
import "./App.css";

const API_URL =
  process.env.REACT_APP_API_URL || "http://localhost:8000/api/upload";

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
  const [image, setImage] = useState<File | null>(null);
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
      setImage(file);
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
      setImage(file);
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
      const response = await fetch(API_URL, {
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

  const handleAddToCalendar = async () => {
    if (!editedEvent.title || !editedEvent.date || !editedEvent.time) {
      setCalendarMessage("Title, date, and time are required.");
      return;
    }
    setCalendarLoading(true);
    setCalendarMessage(null);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        "http://localhost:8000/api/add-to-calendar",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...editedEvent,
          }),
        }
      );
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
    <div className="App">
      <header className="App-header">
        <h1>CalendarSnap</h1>
        <p>
          Upload a screenshot or image of your event details. We'll extract the
          event info for you!
        </p>
      </header>
      <div
        className="upload-area"
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
          style={{ display: "block", margin: "0 auto" }}
          aria-label="Upload image file"
        />
      </div>
      {preview && (
        <div className="preview-section">
          <h2>Image Preview</h2>
          <img
            src={preview}
            alt="Preview of uploaded event image"
            className="image-preview"
          />
        </div>
      )}
      <div className="extracted-info-section">
        <h2>Extracted Event Information</h2>
        <div className="placeholder-info">
          {loading ? (
            <div className="spinner" aria-live="polite" aria-busy="true">
              <div className="lds-dual-ring"></div>
              <p>Extracting text from image...</p>
            </div>
          ) : error ? (
            <p style={{ color: "red" }} role="alert">
              {error}
            </p>
          ) : extractedInfo ? (
            <form className="event-info-form">
              <label>
                Title:
                <input
                  type="text"
                  name="title"
                  value={editedEvent.title ?? extractedInfo.title ?? ""}
                  onChange={handleFieldChange}
                  autoComplete="off"
                />
              </label>
              <label>
                Date:
                <input
                  type="text"
                  name="date"
                  value={editedEvent.date ?? extractedInfo.date ?? ""}
                  onChange={handleFieldChange}
                  autoComplete="off"
                />
              </label>
              <label>
                Time:
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
                  value={editedEvent.attendees ?? extractedInfo.attendees ?? ""}
                  onChange={handleFieldChange}
                  autoComplete="off"
                />
              </label>
              <label>
                Raw OCR Text:
                <textarea
                  name="text"
                  value={extractedInfo.text}
                  readOnly
                  rows={5}
                  style={{ width: "100%" }}
                />
              </label>
              <button
                className="google-login-button"
                style={{ marginTop: 16, marginBottom: 8 }}
                onClick={handleAddToCalendar}
                disabled={calendarLoading}
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
          ) : (
            <p>No event information extracted yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MainApp;

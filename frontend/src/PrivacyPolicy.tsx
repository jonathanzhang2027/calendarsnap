import React from "react";
import { Link } from "react-router-dom";

const PrivacyPolicy: React.FC = () => (
  <div
    style={{
      maxWidth: 700,
      margin: "3rem auto",
      padding: "2rem",
      background: "#fff",
      borderRadius: 12,
      boxShadow: "0 2px 16px rgba(80,80,180,0.08)",
    }}
  >
    <h1 style={{ textAlign: "center", marginBottom: "1.5rem" }}>
      Privacy Policy
    </h1>
    <p>
      <strong>CalendarSnap</strong> respects your privacy. We do not store your
      uploaded images, extracted event data, or Google user data on our servers.
      All processing is performed securely and only for the purpose of
      extracting event information and adding it to your Google Calendar.
    </p>
    <p>
      CalendarSnap accesses your Google Calendar only with your explicit
      permission, using Google OAuth. We use your Google user data solely to add
      events to your calendar as requested by you. We do not store, share, or
      use your Google user data for any other purpose. All processing is
      performed securely and in accordance with Google's{" "}
      <a
        href="https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes"
        target="_blank"
        rel="noopener noreferrer"
      >
        Limited Use requirements
      </a>
      .
    </p>
    <p>
      We do not share your data with third parties. For questions or concerns,
      please contact us at{" "}
      <a href="mailto:jonathanzhang4@gmail.com">jonathanzhang4@gmail.com</a>.
    </p>
    <p>
      By using CalendarSnap, you consent to the processing of your data as
      described in this policy.
    </p>
    <div style={{ textAlign: "center", marginTop: "2.5rem" }}>
      <Link
        to="/login"
        style={{
          display: "inline-block",
          background: "#1976d2",
          color: "#fff",
          padding: "0.7rem 2rem",
          borderRadius: 8,
          textDecoration: "none",
          fontWeight: 500,
          fontSize: "1.1rem",
          boxShadow: "0 2px 8px rgba(80,80,180,0.08)",
          transition: "background 0.2s",
        }}
      >
        Back to Login
      </Link>
    </div>
  </div>
);

export default PrivacyPolicy;

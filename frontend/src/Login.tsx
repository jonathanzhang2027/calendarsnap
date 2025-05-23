import React, { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./Login.css";

const Login: React.FC = () => {
  const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
  const navigate = useNavigate();

  // Generate a random state for CSRF protection
  const generateCryptoRandomState = () => {
    const randomValues = new Uint32Array(2);
    window.crypto.getRandomValues(randomValues);
    const utf8Encoder = new TextEncoder();
    const utf8Array = utf8Encoder.encode(
      String.fromCharCode.apply(null, randomValues as unknown as number[])
    );
    return btoa(
      String.fromCharCode.apply(null, utf8Array as unknown as number[])
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  };

  // --- Silent Auth on Mount ---
  useEffect(() => {
    // Only try silent auth if not already logged in
    if (localStorage.getItem("token")) return;
    const oauth2Endpoint = "https://accounts.google.com/o/oauth2/v2/auth";
    const params = {
      client_id: clientId || "",
      redirect_uri: window.location.origin + "/login",
      response_type: "token",
      scope:
        "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email",
      include_granted_scopes: "true",
      prompt: "none",
    };
    const url = oauth2Endpoint + "?" + new URLSearchParams(params).toString();
    // Create a hidden iframe
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = url;
    document.body.appendChild(iframe);

    // Handler to receive token from iframe
    const handleMessage = (event: MessageEvent) => {
      if (
        typeof event.data === "string" &&
        event.data.startsWith("access_token=")
      ) {
        const token = event.data.split("=")[1];
        if (token) {
          localStorage.setItem("token", token);
          navigate("/app");
        }
      }
    };
    window.addEventListener("message", handleMessage);

    // Clean up
    setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      window.removeEventListener("message", handleMessage);
    }, 5000);
  }, [clientId, navigate]);

  useEffect(() => {
    // Parse hash params after redirect
    const fragmentString = window.location.hash.substring(1);
    const params: Record<string, string> = {};
    const regex = /([^&=]+)=([^&]*)/g;
    let match;
    while ((match = regex.exec(fragmentString))) {
      params[decodeURIComponent(match[1])] = decodeURIComponent(match[2]);
    }
    if (Object.keys(params).length > 0 && params["access_token"]) {
      localStorage.setItem("token", params["access_token"]);
      // Also postMessage to parent for silent auth
      if (window.parent !== window) {
        window.parent.postMessage(
          `access_token=${params["access_token"]}`,
          window.location.origin
        );
      }
      navigate("/app");
    }
  }, [navigate]);

  //   useEffect(() => {
  //     if (localStorage.getItem("token")) {
  //       navigate("/app");
  //     }
  //   }, [navigate]);

  const handleLogin = () => {
    console.log("handleLogin", clientId);
    const state = generateCryptoRandomState();
    localStorage.setItem("state", state);
    const oauth2Endpoint = "https://accounts.google.com/o/oauth2/v2/auth";
    const form = document.createElement("form");
    form.setAttribute("method", "GET");
    form.setAttribute("action", oauth2Endpoint);
    const params: Record<string, string> = {
      client_id: clientId || "",
      redirect_uri: window.location.origin + "/login",
      response_type: "token",
      scope:
        "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email",
      state: state,
      include_granted_scopes: "true",
    };
    for (const p in params) {
      const input = document.createElement("input");
      input.setAttribute("type", "hidden");
      input.setAttribute("name", p);
      input.setAttribute("value", params[p]);
      form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <img
          src="/IMG_5429.jpg"
          alt="CalendarSnap Logo"
          className="profile-image"
        />
        <h1 className="login-title">CalendarSnap</h1>
        <p className="login-subtitle">
          Sign in to upload event images and add events directly to your Google
          Calendar
        </p>
        <button onClick={handleLogin} className="google-login-button">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fill="#FFF"
              d="M12 5c1.617 0 3.101.575 4.286 1.578L19.4 4.05C17.4 2.3 14.9 1.2 12 1.2 7.9 1.2 4.2 3.6 2.6 7.2l3.9 3c.9-2.7 3.5-4.7 5.5-5.2z"
            />
            <path
              fill="#FFF"
              d="M20.4 12c0-.9-.1-1.5-.3-2.2H12v4.3h4.8c-.2 1.1-.8 1.9-1.7 2.5l3.2 2.5c1.9-1.8 3.1-4.4 3.1-7.1z"
            />
            <path
              fill="#FFF"
              d="M6.5 14.2c-.2-.6-.4-1.2-.4-1.9s.1-1.4.4-2L2.6 7.2C1.9 8.7 1.5 10.3 1.5 12s.4 3.3 1.1 4.8l3.9-2.6z"
            />
            <path
              fill="#FFF"
              d="M12 22.8c3.1 0 5.7-1 7.6-2.8l-3.2-2.5c-1 .7-2.1 1.1-3.6 1.1-2.7 0-5-1.8-5.8-4.3L3.2 17c1.6 3.5 5.4 5.8 8.8 5.8z"
            />
          </svg>
          Sign in with Google
        </button>
      </div>
      <div
        className="login-info-below-card"
        style={{
          maxWidth: 400,
          margin: "0 auto",
          marginTop: 16,
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 2px 8px #0001",
          padding: 20,
          color: "#222",
          fontSize: "1.05rem",
          textAlign: "left",
        }}
      >
        <div style={{ marginBottom: 8 }}>
          <b>How it works:</b> Upload or paste an event image or calendar
          screenshot, review/edit the extracted details, and add events to your
          Google Calendar.
        </div>
        <div style={{ marginBottom: 8 }}>
          <b>Why Google access?</b> We only use your Google account to add
          events to your calendar. We never store or share your data.
        </div>
        <div style={{ marginBottom: 0 }}>
          <b>Privacy:</b> All processing is transient and privacy-compliant.{" "}
          <a href="/privacy" target="_blank" rel="noopener noreferrer">
            View our Privacy Policy
          </a>
        </div>
        <div style={{ marginTop: 8, fontSize: "0.98rem", color: "#666" }}>
          This app is hosted on our own verified domain. Homepage and privacy
          policy are always accessible without login.
        </div>
      </div>
      <div
        style={{ textAlign: "center", marginTop: "2rem", marginBottom: "1rem" }}
      >
        <Link
          to="/privacy"
          style={{
            color: "#fff",
            textDecoration: "underline",
            fontSize: "1.25rem",
            fontWeight: 600,
            textShadow: "0 1px 4px rgba(80,80,180,0.25)",
          }}
        >
          Privacy Policy
        </Link>
      </div>
    </div>
  );
};

export default Login;

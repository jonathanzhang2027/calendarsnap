import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
      navigate("/app");
    }
  }, [navigate]);

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
        <img src="/max.JPG" alt="CalendarSnap Logo" className="profile-image" />
        <h1 className="login-title">CalendarSnap</h1>
        <p className="login-subtitle">Sign in to access your calendar</p>
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
    </div>
  );
};

export default Login;

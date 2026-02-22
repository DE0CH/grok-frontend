import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { setGrokApiKey, setGrokBaseUrl } from "../lib/grokApi";
import { setApiKeyCookie, setBaseUrlCookie } from "../lib/cookies";

const DEFAULT_BASE_URL = "https://api.x.ai/v1";

export default function Login() {
  const [key, setKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedKey = key.trim();
    if (!trimmedKey) {
      setError("Please enter your API key.");
      return;
    }
    setError(null);
    setApiKeyCookie(trimmedKey);
    setGrokApiKey(trimmedKey);
    const trimmedUrl = baseUrl.trim();
    if (trimmedUrl) {
      setBaseUrlCookie(trimmedUrl);
      setGrokBaseUrl(trimmedUrl);
    } else {
      setGrokBaseUrl(null);
    }
    const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/";
    navigate(from, { replace: true });
  };

  return (
    <div className="page login-page">
      <h1>Log in</h1>
      <p className="subtitle">Enter your API key to use Image to Image and Image to Video.</p>

      <div className="login-help">
        <button
          type="button"
          className="login-help-toggle"
          onClick={() => setHelpOpen((o) => !o)}
          aria-expanded={helpOpen}
        >
          Help: What is an API key? {helpOpen ? "▴" : "▾"}
        </button>
        {helpOpen && (
          <div className="login-explanation">
            <p>
              <strong>What is this?</strong> It's like a password that lets this app use the image generation API. The app only stores it on your device. When the app makes a request, the key is sent from your browser directly to the API server — it never passes through any other server.
            </p>
            <p>
              <strong>How do I get one?</strong> Go to the{" "}
              <a href="https://console.x.ai" target="_blank" rel="noopener noreferrer">
                xAI Cloud Console
              </a>
              , sign in or sign up, and create an API key in the dashboard. Or use a compatible API provider and enter its Base URL below.
            </p>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="form">
        <label className="block">
          <span>API key</span>
          <input
            type="password"
            className="api-key-input"
            placeholder="API key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoComplete="off"
            autoFocus
          />
        </label>
        <label className="block">
          <span>Base URL <span style={{ fontWeight: "normal", opacity: 0.6 }}>(optional)</span></span>
          <input
            type="url"
            className="api-key-input"
            placeholder={DEFAULT_BASE_URL}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            autoComplete="off"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="primary-button">
          Continue
        </button>
      </form>
    </div>
  );
}

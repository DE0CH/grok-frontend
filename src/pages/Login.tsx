import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { setGrokApiKey } from "../lib/grokApi";
import { setApiKeyCookie } from "../lib/cookies";

export default function Login() {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = key.trim();
    if (!trimmed) {
      setError("Please enter your API key.");
      return;
    }
    setError(null);
    setApiKeyCookie(trimmed);
    setGrokApiKey(trimmed);
    const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/";
    navigate(from, { replace: true });
  };

  return (
    <div className="page login-page">
      <h1>Log in</h1>
      <p className="subtitle">Enter your xAI API key to use Image to Image and Image to Video.</p>

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
              <strong>What is this?</strong> It’s like a password that lets this app use xAI’s tools to generate or edit images and videos for you. We only keep it on your device and only send it to xAI when we make a request.
            </p>
            <p>
              <strong>How do I get one?</strong> Go to the{" "}
              <a href="https://console.x.ai" target="_blank" rel="noopener noreferrer">
                xAI Cloud Console
              </a>
              , sign in or sign up (you can use your X account), and create an API key in the dashboard.
            </p>
            <p>
              <strong>Cost.</strong> Using the API is paid — xAI charges you for image and video generation based on your usage.
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
            placeholder="xAI API key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoComplete="off"
            autoFocus
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

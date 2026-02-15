import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { setGrokApiKey } from "../lib/grokApi";
import { setApiKeyCookie } from "../lib/cookies";

export default function Login() {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
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

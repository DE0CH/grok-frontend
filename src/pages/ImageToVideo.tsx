import { useState, useCallback } from "react";
import { imageToVideo } from "../lib/grokApi";
import ImageUpload from "../components/ImageUpload";

const DURATION_MIN = 1;
const DURATION_MAX = 15;
const DURATION_DEFAULT = 5;
type Resolution = "480p" | "720p";

export default function ImageToVideo() {
  const [preview, setPreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(DURATION_DEFAULT);
  const [resolution, setResolution] = useState<Resolution>("480p");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFileSelect = useCallback((f: File) => {
    if (!f.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    setError(null);
    setResultUrl(null);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  }, []);

  const submit = useCallback(async () => {
    if (!preview || !prompt.trim()) {
      setError("Please upload an image and enter a prompt.");
      return;
    }
    setLoading(true);
    setError(null);
    setResultUrl(null);
    try {
      const url = await imageToVideo(prompt.trim(), preview, {
        duration,
        resolution,
      });
      setResultUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [preview, prompt, duration, resolution]);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Image to Video</h1>
        <p className="subtitle">Upload an image and describe the motion. The model returns a short video.</p>
      </div>

      {resultUrl && (
        <div className="result result-on-top">
          <video src={resultUrl} controls className="result-video" />
        </div>
      )}

      {loading && !resultUrl && (
        <div className="status">
          <span className="spinner" /> Video is being generated. This may take a few minutes…
        </div>
      )}

      <div className="form-card">
        <div className="form">
          <label className="block">
            <span>Prompt</span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Animate the clouds drifting and trees swaying gently"
              rows={3}
            />
          </label>

          <div className="form-row">
            <label className="block">
              <span>Duration — {duration}s</span>
              <input
                type="range"
                className="slider"
                min={DURATION_MIN}
                max={DURATION_MAX}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
            </label>
            <label className="block">
              <span>Resolution</span>
              <select value={resolution} onChange={(e) => setResolution(e.target.value as Resolution)}>
                <option value="480p">480p</option>
                <option value="720p">720p</option>
              </select>
            </label>
          </div>

          <ImageUpload preview={preview} onFileSelect={onFileSelect} />

          <button
            type="button"
            className="primary-button"
            onClick={submit}
            disabled={loading || !preview || !prompt.trim()}
          >
            {loading ? <><span className="spinner" /> Generating video…</> : "Generate video"}
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
    </div>
  );
}

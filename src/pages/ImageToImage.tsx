import { useState, useCallback } from "react";
import { imageEdit } from "../lib/grokApi";

export default function ImageToImage() {
  const [preview, setPreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
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
      const url = await imageEdit(prompt.trim(), preview);
      setResultUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [preview, prompt]);

  return (
    <div className="page">
      <h1>Image to Image</h1>
      <p className="subtitle">Upload an image and describe how to edit it. The model returns a new image.</p>

      {resultUrl && (
        <div className="result result-on-top">
          <h2>Result</h2>
          <img src={resultUrl} alt="Generated" className="result-img" />
        </div>
      )}

      <div className="form">
        <label className="block">
          <span>Prompt</span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Change the sky to sunset and add birds"
            rows={3}
          />
        </label>

        <label className="block">
          <span>Image</span>
          <input type="file" accept="image/*" onChange={onFileChange} />
        </label>

        <button type="button" onClick={submit} disabled={loading || !preview || !prompt.trim()}>
          {loading ? "Generating…" : "Generate image"}
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {preview && (
        <div className="preview-wrap preview-at-bottom">
          <label className="block">
            <span>Input image</span>
          </label>
          <img src={preview} alt="Upload preview" className="preview-img" />
        </div>
      )}
    </div>
  );
}

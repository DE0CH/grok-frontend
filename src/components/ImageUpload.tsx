import { useState, useCallback } from "react";

type Props = {
  preview: string | null;
  onFileSelect: (file: File) => void;
  label?: string;
};

export default function ImageUpload({ preview, onFileSelect, label = "Image" }: Props) {
  const [isDragging, setIsDragging] = useState(false);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f && f.type.startsWith("image/")) onFileSelect(f);
      e.target.value = "";
    },
    [onFileSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files?.[0];
      if (f && f.type.startsWith("image/")) onFileSelect(f);
    },
    [onFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  return (
    <label className="block">
      <span>{label}</span>
      <div
        className={`upload-zone ${isDragging ? "upload-zone--dragging" : ""} ${preview ? "upload-zone--has-preview" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          type="file"
          accept="image/*"
          onChange={handleChange}
          className="upload-zone-input"
        />
        {preview ? (
          <div className="upload-zone-preview">
            <img src={preview} alt="" className="upload-zone-thumb" />
            <span className="upload-zone-change">Change image</span>
          </div>
        ) : (
          <div className="upload-zone-empty">
            <span className="upload-zone-icon" aria-hidden>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </span>
            <span className="upload-zone-text">Drop an image or click to browse</span>
          </div>
        )}
      </div>
    </label>
  );
}

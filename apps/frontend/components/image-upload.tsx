"use client";

import { useRef, useState } from "react";
import { uploadImageBase64, uploadImageUrl } from "@/lib/api";

type Props = {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  className?: string;
};

export function ImageUpload({ value, onChange, label = "Image", className = "" }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"url" | "file">("url");
  const [urlInput, setUrlInput] = useState(value);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please select an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("File must be under 5 MB."); return; }
    setError("");
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target?.result as string;
        try {
          const result = await uploadImageBase64(base64, file.name);
          onChange(result.secure_url);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Upload failed.");
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch { setUploading(false); }
  };

  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) return;
    setError("");
    setUploading(true);
    try {
      const result = await uploadImageUrl(urlInput.trim());
      onChange(result.secure_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium uppercase tracking-[0.24em] text-text/60">{label}</label>
        <div className="flex gap-1 text-xs">
          <button type="button" onClick={() => setMode("url")} className={`px-2 py-0.5 rounded ${mode === "url" ? "bg-accent/10 text-accent" : "text-text/40 hover:text-text/70"}`}>URL</button>
          <button type="button" onClick={() => setMode("file")} className={`px-2 py-0.5 rounded ${mode === "file" ? "bg-accent/10 text-accent" : "text-text/40 hover:text-text/70"}`}>Upload</button>
        </div>
      </div>

      {mode === "url" ? (
        <div className="flex gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onBlur={handleUrlSubmit}
            placeholder="https://example.com/image.jpg"
            className="flex-1 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <button
            type="button"
            onClick={handleUrlSubmit}
            disabled={uploading || !urlInput.trim()}
            className="rounded-xl bg-primary px-3 py-2 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50"
          >
            {uploading ? "…" : "Use"}
          </button>
        </div>
      ) : (
        <div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full rounded-xl border-2 border-dashed border-black/10 py-4 text-sm text-text/50 hover:border-accent/40 hover:text-accent transition disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Click to choose image (max 5 MB)"}
          </button>
        </div>
      )}

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}

      {value && (
        <div className="mt-2 flex items-center gap-2">
          <img src={value} alt="" className="h-12 w-12 rounded-lg object-cover border border-black/10" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          <p className="text-xs text-text/40 truncate flex-1">{value.startsWith("data:") ? "Uploaded file" : value}</p>
          <button type="button" onClick={() => { onChange(""); setUrlInput(""); }} className="text-xs text-red-400 hover:text-red-600">Remove</button>
        </div>
      )}
    </div>
  );
}

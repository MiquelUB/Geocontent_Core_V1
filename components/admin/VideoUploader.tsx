'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Video, X, CheckCircle, Loader2, Zap, Tv2 } from 'lucide-react';

interface VideoUploaderProps {
  poiId: string;
  existingVideos?: string[];
  theme?: any;
}

type UploadState =
  | { phase: 'idle' }
  | { phase: 'detecting' }
  | { phase: 'signing' }
  | { phase: 'uploading'; progress: number; type: 'snack' | 'dinner' }
  | { phase: 'notifying'; type: 'snack' | 'dinner' }
  | { phase: 'done'; type: 'snack' | 'dinner'; url: string }
  | { phase: 'error'; message: string };

/**
 * Detects video duration from the browser without reading the whole file.
 * Returns duration in seconds (may be Infinity for some formats).
 */
function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    video.src = url;
  });
}

/**
 * Uploads a file directly to Supabase Storage via a signed URL.
 * Uses XMLHttpRequest to report real upload progress.
 */
function directUpload(
  signedUrl: string,
  file: File,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.open('PUT', signedUrl);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.send(file);
  });
}

export default function VideoUploader({ poiId, existingVideos = [], theme }: VideoUploaderProps) {
  const activeTheme = theme || {
    mainText: "text-emerald-600",
    primary: "bg-emerald-600",
    bg: "bg-emerald-50",
    hover: "hover:bg-emerald-700",
  };
  const [videos, setVideos] = useState<string[]>(existingVideos);
  const [state, setState] = useState<UploadState>({ phase: 'idle' });
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be selected again
    if (inputRef.current) inputRef.current.value = '';

    try {
      // ── Step 1: Detect duration → classify Snack / Dinner ──────────────
      setState({ phase: 'detecting' });
      const duration = await getVideoDuration(file);
      const type: 'snack' | 'dinner' = duration > 0 && duration < 30 ? 'snack' : 'dinner';

      // ── Step 2: Get Supabase signed upload URL ──────────────────────────
      setState({ phase: 'signing' });
      const sigRes = await fetch(
        `/api/upload/signed-url?fileName=${encodeURIComponent(file.name)}&bucket=geocontent&contentType=${encodeURIComponent(file.type || 'video/mp4')}`
      );
      if (!sigRes.ok) throw new Error('No s\'ha pogut obtenir la URL signada.');
      const { signedUrl, publicUrl, storagePath } = await sigRes.json();

      // ── Step 3: Upload directly to Supabase (Next.js never touches bytes) ─
      setState({ phase: 'uploading', progress: 0, type });
      await directUpload(signedUrl, file, (pct) => {
        setState({ phase: 'uploading', progress: pct, type });
      });

      // ── Step 4: Notify backend → save URL + enqueue transcoding job ─────
      setState({ phase: 'notifying', type });
      const notifyRes = await fetch('/api/upload/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poiId,
          publicUrl,
          storagePath,
          type,
          duration,
          fileName: file.name,
        }),
      });
      if (!notifyRes.ok) throw new Error('Error en la notificació al servidor.');

      // ── Done ────────────────────────────────────────────────────────────
      setVideos((prev) => [...prev, publicUrl].slice(0, 3));
      setState({ phase: 'done', type, url: publicUrl });
    } catch (err: any) {
      console.error('[VideoUploader]', err);
      setState({ phase: 'error', message: err.message ?? 'Error desconegut' });
    }
  };

  const isBusy = state.phase !== 'idle' && state.phase !== 'done' && state.phase !== 'error';

  return (
    <div className="space-y-4 pt-4 border-t border-stone-100">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Label className="text-stone-600 font-medium flex items-center gap-2">
          <Video className={`w-4 h-4 ${activeTheme.mainText}`} />
          Vídeos del Punt (Màxim 3)
        </Label>
        <span className="text-xs text-stone-400">{videos.length}/3</span>
      </div>

      {/* Video grid */}
      <div className="grid grid-cols-3 gap-3">
        {videos.map((v, i) => (
          <div
            key={i}
            className="relative aspect-video bg-stone-100 rounded-md border border-stone-200 flex items-center justify-center overflow-hidden group"
          >
            <video src={v} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Button
                size="icon"
                variant="ghost"
                className="text-white hover:text-red-400"
                onClick={() => setVideos((prev) => prev.filter((_, idx) => idx !== i))}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}

        {videos.length < 3 && (
          <label
            className={`aspect-video cursor-pointer border-2 border-dashed border-stone-200 rounded-md flex flex-col items-center justify-center gap-2 hover:bg-stone-50 hover:border-${activeTheme.primary.split('-')[1]}-300 transition-all ${isBusy ? 'opacity-50 pointer-events-none' : ''
              }`}
          >
            {isBusy ? (
              <Loader2 className={`w-5 h-5 ${activeTheme.mainText} animate-spin`} />
            ) : (
              <>
                <Video className="w-5 h-5 text-stone-400" />
                <span className="text-[10px] text-stone-500 uppercase tracking-wider font-bold">
                  Afegir Vídeo
                </span>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleFileSelected}
              disabled={isBusy}
            />
          </label>
        )}
      </div>

      {/* Status panel */}
      {state.phase === 'uploading' && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-stone-500">
            <span className="flex items-center gap-1.5">
              {state.type === 'snack' ? (
                <Zap className="w-3 h-3 text-amber-500" />
              ) : (
                <Tv2 className="w-3 h-3 text-blue-500" />
              )}
              {state.type === 'snack' ? 'Snack · MP4 offline' : 'Dinner · HLS streaming'}
            </span>
            <span className="font-mono font-bold">{state.progress}%</span>
          </div>
          <Progress value={state.progress} className="h-1.5" />
        </div>
      )}

      {state.phase === 'detecting' && (
        <p className="text-xs text-stone-400 flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" /> Analitzant durada…
        </p>
      )}

      {state.phase === 'signing' && (
        <p className="text-xs text-stone-400 flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" /> Obtenint URL segura…
        </p>
      )}

      {state.phase === 'notifying' && (
        <p className="text-xs text-stone-400 flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" />
          Encuant transcodificació {state.type === 'snack' ? 'Snack' : 'Dinner'}…
        </p>
      )}

      {state.phase === 'done' && (
        <div className="text-xs px-3 py-2 rounded flex items-center gap-2 bg-green-50 text-green-700">
          <CheckCircle className="w-3 h-3" />
          {state.type === 'snack'
            ? '⚡ Snack pujat · Transcodificant a MP4 480p offline'
            : '🎬 Dinner pujat · Transcodificant a HLS 720p adaptatiu'}
        </div>
      )}

      {state.phase === 'error' && (
        <div className="text-xs px-3 py-2 rounded flex items-center gap-2 bg-red-50 text-red-600">
          <X className="w-3 h-3" />
          {state.message}
        </div>
      )}
    </div>
  );
}

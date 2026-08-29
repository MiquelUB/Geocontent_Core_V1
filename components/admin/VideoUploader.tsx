'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Video, X, CheckCircle, Loader2, Zap, Tv2, Sparkles } from 'lucide-react';

interface VideoUploaderProps {
  poiId: string;
  existingVideos?: string[];
  theme?: any;
  videoTranslations?: Record<string, any>;
  defaultVoiceId?: string;
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
  tagging: string,
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

export default function VideoUploader({ poiId, existingVideos = [], theme, videoTranslations, defaultVoiceId }: VideoUploaderProps) {
  const activeTheme = theme || {
    mainText: "text-emerald-600",
    primary: "bg-emerald-600",
    bg: "bg-emerald-50",
    hover: "hover:bg-emerald-700",
  };
  const [videos, setVideos] = useState<string[]>(existingVideos || []);
  const [videoVoices, setVideoVoices] = useState<Record<string, string>>({});
  const [pendingTranslations, setPendingTranslations] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (existingVideos) setVideos(existingVideos);
  }, [existingVideos]);
  const [state, setState] = useState<UploadState>({ phase: 'idle' });
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be selected again
    if (inputRef.current) inputRef.current.value = '';

    if (file.size > 200 * 1024 * 1024) {
      alert(`El fitxer de vídeo "${file.name}" supera el límit màxim de 200MB.`);
      return;
    }

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
      const { signedUrl, publicUrl, storagePath, tagging } = await sigRes.json();

      // ── Step 3: Upload directly to Supabase (Next.js never touches bytes) ─
      setState({ phase: 'uploading', progress: 0, type });
      await directUpload(signedUrl, file, tagging, (pct) => {
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
      setVideos((prev) => [...prev, publicUrl].slice(0, 4));
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
          Vídeos del Punt (Màxim 4)
        </Label>
        <span className="text-xs text-stone-400">{videos.length}/4</span>
      </div>

      {/* Video grid */}
      <div className="grid grid-cols-3 gap-3">
        {videos.map((v, i) => (
          <div
            key={i}
            className="relative aspect-video bg-stone-100 rounded-md border border-stone-200 flex items-center justify-center overflow-hidden group"
          >
            <video src={v} className="w-full h-full object-cover" />
            <div className="absolute top-2 right-2 flex flex-col gap-2">
              <div className="flex flex-col gap-1 items-end">
                <select
                  value={videoVoices[v] || defaultVoiceId || 'nova'}
                  onChange={(e) => setVideoVoices(prev => ({ ...prev, [v]: e.target.value }))}
                  className="text-[10px] border border-stone-200 rounded px-1.5 py-1 bg-white h-7 outline-none opacity-80 hover:opacity-100"
                >
                  <option value="nova">Dona (Nova)</option>
                  <option value="alloy">Home (Alloy)</option>
                  <option value="echo">Home (Echo)</option>
                  <option value="fable">Dona/Nen (Fable)</option>
                  <option value="onyx">Home Greu (Onyx)</option>
                  <option value="shimmer">Dona Clara (Shimmer)</option>
                </select>

                <Button
                  size="icon"
                  variant="default"
                  title="Traduir Vídeo (IA)"
                  className="w-8 h-8 rounded-full bg-purple-600 hover:bg-purple-700 shadow-md"
                  onClick={async () => {
                    if (!poiId) { alert("Guarda el POI primer."); return; }
                    try {
                      const { requestVideoTranslation } = await import('@/lib/actions/omnivoice');
                      const selectedVoice = videoVoices[v] || defaultVoiceId || 'nova';
                      const res = await requestVideoTranslation(poiId, v, selectedVoice);
                      if (res.success) {
                        alert("Traducció de vídeo encuada! L'IA processarà el vídeo en segon pla.");
                        setPendingTranslations(prev => ({ ...prev, [v]: true }));
                      } else {
                        alert("Error: " + res.error);
                      }
                    } catch (err) {
                      alert("Error de connexió.");
                    }
                  }}
                >
                  <Sparkles className="w-4 h-4 text-white" />
                </Button>
              </div>
              <Button
                size="icon"
                variant="default"
                title="Eliminar Vídeo"
                className="w-8 h-8 rounded-full bg-red-600 hover:bg-red-700 shadow-md"
                onClick={() => setVideos((prev) => prev.filter((_, idx) => idx !== i))}
              >
                <X className="w-4 h-4 text-white" />
              </Button>
            </div>
            
            {/* Check de traducció completada / pendent */}
            {pendingTranslations[v] ? (
              <div className="absolute bottom-2 left-2 flex items-center gap-1 px-1.5 py-1 bg-blue-50 border border-blue-200 rounded text-blue-700 text-[10px] font-bold shadow-md" title="Traducció en curs">
                <Loader2 className="w-3 h-3 animate-spin" />
                PROCESSANT...
              </div>
            ) : videoTranslations?.[v] && Object.keys(videoTranslations[v]).length > 0 ? (
              <div className="absolute bottom-2 left-2 flex items-center gap-1 px-1.5 py-1 bg-green-50 border border-green-200 rounded text-green-700 text-[10px] font-bold shadow-md" title="Traduccions completades">
                <CheckCircle className="w-3 h-3" />
                {Object.keys(videoTranslations[v]).join(', ').toUpperCase()}
              </div>
            ) : null}
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
        <div className="text-xs px-3 py-2 rounded flex items-center gap-2 bg-primary/10 text-primary">
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

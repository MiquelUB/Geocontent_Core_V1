'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, X, Plus, Music, Film, ImageIcon, History, MapPin, FolderIcon, Upload, Link2, Trash2, MapIcon, CloudUpload, Sparkles, ExternalLink, CheckCircle2 } from "lucide-react";
import iconsMapping from '@/lib/icons-mapping.json';
import { getAdminTheme } from "@/lib/adminTheme";
import { compressImage } from "@/lib/imageOptimization";
import { uploadFileClient } from "@/lib/upload-client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { autoTranslateAction, translateFieldsAction } from '@/lib/actions/ai';
import { generatePoiAudiosAction } from '@/lib/actions/audio'; // Obsolet, mantingut per backward compat
import { requestTtsGeneration } from '@/lib/actions/omnivoice';

const SUPPORTED_LOCALES = [
  { id: 'ca', name: 'Català' },
  { id: 'es', name: 'Castellà' },
  { id: 'en', name: 'Anglès' },
  { id: 'fr', name: 'Francès' },
];

const BIOME_MAP: Record<string, string> = {
  mountain: 'Montanya',
  coast: 'Mar',
  city: 'City',
  interior: 'Interior',
  bloom: 'Blossom',
};

interface ManualPoiFormProps {
  poi?: any;
  onSave: (data: FormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
  routes?: any[];
  defaultRouteId?: string;
  municipalityTheme?: string;
}

interface VideoSlot {
  url: string;
  file: File | null;
  mode: 'url' | 'file';
  voiceId?: string;
}

const MAX_VIDEO_SLOTS = 3;
const MAX_VIDEO_SIZE_MB = 30; // 30MB max per Reel video to control S3 bandwidth and storage budget

const getInitialTranslations = (translations: any, baseValue: string = '', secondaryBaseValue: string = '') => {
  const effectiveBase = (baseValue && baseValue.trim() !== '') 
    ? baseValue 
    : ((secondaryBaseValue && secondaryBaseValue.trim() !== '') ? secondaryBaseValue : '');

  let res: Record<string, string> = { ca: effectiveBase, es: '', en: '', fr: '' };
  if (translations) {
    let parsed = translations;
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch (e) {}
    }
    if (parsed && typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed)) {
        if (v && typeof v === 'string' && v.trim() !== '') {
          res[k] = v;
        }
      }
    }
  }
  if ((!res.ca || res.ca.trim() === '') && effectiveBase) {
    res.ca = effectiveBase;
  }
  return res;
};

export default function ManualPoiForm({ poi, onSave, onCancel, isLoading, routes = [], defaultRouteId, municipalityTheme }: ManualPoiFormProps) {
  const router = useRouter();
  const activeTheme = getAdminTheme(municipalityTheme);
  
  // States for multi-language fields
  const [titles, setTitles] = useState<Record<string, string>>(() =>
    getInitialTranslations(poi?.titleTranslations || poi?.title_translations, poi?.title || poi?.name)
  );
  
  const [descriptions, setDescriptions] = useState<Record<string, string>>(() =>
    getInitialTranslations(
      poi?.descriptionTranslations || poi?.description_translations, 
      poi?.description, 
      poi?.textContent || poi?.text_content
    )
  );

  const [textContents, setTextContents] = useState<Record<string, string>>(() =>
    getInitialTranslations(
      poi?.textContentTranslations || poi?.text_content_translations, 
      poi?.textContent || poi?.text_content, 
      poi?.description
    )
  );

  const [activeLocale, setActiveLocale] = useState('ca');
  
  const [routeId, setRouteId] = useState(poi?.routeId || poi?.route_id || defaultRouteId || '');
  const [latitude, setLatitude] = useState(poi?.latitude !== undefined && poi?.latitude !== null ? poi.latitude.toString() : '');
  const [longitude, setLongitude] = useState(poi?.longitude !== undefined && poi?.longitude !== null ? poi.longitude.toString() : '');
  const [icon, setIcon] = useState(poi?.icon || '');
  const [poiType, setPoiType] = useState(poi?.type || 'CIVIL');
  const [manualQuiz, setManualQuiz] = useState<any>(poi?.manualQuiz || poi?.manual_quiz || null);
  const [voiceScript, setVoiceScript] = useState(poi?.voiceScript || poi?.voice_script || '');
  const [voiceId, setVoiceId] = useState(poi?.voiceId || poi?.voice_id || 'nova');
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  const [appThumbnail, setAppThumbnail] = useState(
    poi?.appThumbnail || poi?.app_thumbnail || poi?.image_url || poi?.thumbnail_1x1 || ''
  );
  const [header16x9, setHeader16x9] = useState(
    poi?.header16x9 || poi?.header_16x9 || poi?.hero_image_url || ''
  );
  const [audioUrl, setAudioUrl] = useState(
    poi?.audioUrl || poi?.audio_url || poi?.audio || (poi?.audioTranslations?.ca || (poi?.audioTranslations && Object.values(poi.audioTranslations)[0])) || ''
  );

  const [carouselImages, setCarouselImages] = useState<string[]>(() => {
    if (poi?.carouselImages && poi.carouselImages.length > 0) return poi.carouselImages;
    if (poi?.carousel_images && poi.carousel_images.length > 0) return poi.carousel_images;
    if (poi?.images && poi.images.length > 0) {
      return poi.images;
    }
    return [];
  });
  const [carouselCaptions, setCarouselCaptions] = useState<Record<string, string>[]>(() => {
    if (poi?.carouselCaptions && Array.isArray(poi.carouselCaptions)) return poi.carouselCaptions;
    return [];
  });
  const [carouselFiles, setCarouselFiles] = useState<(File | null)[]>(() =>
    new Array((poi?.carouselImages?.length || poi?.carousel_images?.length || (poi?.images?.length || 0))).fill(null)
  );
  const [newCarouselUrl, setNewCarouselUrl] = useState('');
  const [newCarouselFile, setNewCarouselFile] = useState<File | null>(null);

  const [appThumbnailFile, setAppThumbnailFile] = useState<File | null>(null);
  const [headerFile, setHeaderFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioTranslations, setAudioTranslations] = useState<Record<string, string>>(poi?.audioTranslations || poi?.audio_translations || {});
  const [videoTranslations, setVideoTranslations] = useState<Record<string, string>>(poi?.videoTranslations || poi?.video_translations || {});
  const [pendingTranslations, setPendingTranslations] = useState<Record<string, boolean>>({});

  // Polling per quan hi ha traduccions pendents
  useEffect(() => {
    const hasPending = Object.values(pendingTranslations).some(v => v);
    if (!hasPending) return;

    const interval = setInterval(() => {
      router.refresh();
    }, 5000);

    return () => clearInterval(interval);
  }, [pendingTranslations, router]);

  // Netejar pendents quan arriba la dada del servidor
  useEffect(() => {
    setPendingTranslations(prev => {
      const newPending = { ...prev };
      let changed = false;
      const vTrans: any = poi?.videoTranslations || poi?.video_translations || {};
      for (const url in newPending) {
        if (newPending[url] && vTrans[url] && Object.keys(vTrans[url]).length > 0) {
          delete newPending[url];
          changed = true;
        }
      }
      return changed ? newPending : prev;
    });
  }, [poi]);

  const parseVideos = (raw: any): string[] => {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try { const p = JSON.parse(raw); return Array.isArray(p) ? p : [raw]; } catch { return [raw]; }
    }
    return [];
  };

  const initVideoSlots = (): VideoSlot[] => {
    const raw = poi?.videoUrls || poi?.video_urls || poi?.videoUrl || poi?.video_url;
    const existingUrls: string[] = parseVideos(raw);
    const slots: VideoSlot[] = existingUrls.slice(0, MAX_VIDEO_SLOTS).map((url: string) => ({
      url,
      file: null,
      mode: 'url' as const,
    }));
    return slots;
  };
  const [videoSlots, setVideoSlots] = useState<VideoSlot[]>(initVideoSlots);

  // Sync form states whenever poi prop changes
  useEffect(() => {
    setTitles(getInitialTranslations(poi?.titleTranslations || poi?.title_translations, poi?.title || poi?.name));
    setDescriptions(getInitialTranslations(poi?.descriptionTranslations || poi?.description_translations, poi?.description, poi?.textContent || poi?.text_content));
    setTextContents(getInitialTranslations(poi?.textContentTranslations || poi?.text_content_translations, poi?.textContent || poi?.text_content, poi?.description));
    setRouteId(poi?.routeId || poi?.route_id || defaultRouteId || '');
    setLatitude(poi?.latitude !== undefined && poi?.latitude !== null ? poi.latitude.toString() : '');
    setLongitude(poi?.longitude !== undefined && poi?.longitude !== null ? poi.longitude.toString() : '');
    setIcon(poi?.icon || '');
    setPoiType(poi?.type || 'CIVIL');
    setManualQuiz(poi?.manualQuiz || poi?.manual_quiz || null);
    setVoiceScript(poi?.voiceScript || poi?.voice_script || '');
    setVoiceId(poi?.voiceId || poi?.voice_id || 'nova');
    setAppThumbnail(poi?.appThumbnail || poi?.app_thumbnail || poi?.image_url || poi?.thumbnail_1x1 || '');
    setHeader16x9(poi?.header16x9 || poi?.header_16x9 || poi?.hero_image_url || '');
    setAudioUrl(poi?.audioUrl || poi?.audio_url || poi?.audio || (poi?.audioTranslations?.ca || (poi?.audioTranslations && Object.values(poi.audioTranslations)[0])) || '');
    setAudioTranslations(poi?.audioTranslations || poi?.audio_translations || {});
    setVideoTranslations(poi?.videoTranslations || poi?.video_translations || {});
    setAppThumbnailFile(null);
    setHeaderFile(null);
    setAudioFile(null);

    const carImages = (poi?.carouselImages && poi.carouselImages.length > 0)
      ? poi.carouselImages
      : ((poi?.carousel_images && poi.carousel_images.length > 0)
        ? poi.carousel_images
        : (poi?.images && poi.images.length > 0 ? poi.images : []));
    setCarouselImages(carImages);
    setCarouselFiles(new Array(carImages.length).fill(null));

    const rawVideos = poi?.videoUrls || poi?.video_urls || poi?.videoUrl || poi?.video_url;
    const existingUrls: string[] = parseVideos(rawVideos);
    setVideoSlots(existingUrls.slice(0, MAX_VIDEO_SLOTS).map((url: string) => ({
      url,
      file: null,
      mode: 'url' as const,
    })));
  }, [poi, defaultRouteId]);

  const handleAddVideoSlot = () => {
    if (videoSlots.length < MAX_VIDEO_SLOTS) {
      setVideoSlots([...videoSlots, { url: '', file: null, mode: 'url', voiceId: voiceId || 'nova' }]);
    }
  };

  const handleRemoveVideoSlot = (index: number) => {
    setVideoSlots(videoSlots.filter((_, i) => i !== index));
  };

  const updateVideoSlot = (index: number, updates: Partial<VideoSlot>) => {
    setVideoSlots(videoSlots.map((slot, i) => i === index ? { ...slot, ...updates } : slot));
  };

  const handleVideoFileChange = async (index: number, file: File | null) => {
    if (!file) {
      updateVideoSlot(index, { file: null, url: '' });
      return;
    }
    if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
      alert(`El fitxer "${file.name}" supera el límit de ${MAX_VIDEO_SIZE_MB}MB.`);
      return;
    }
    
    // Pugem el vídeo directament a S3 per evitar saturar i fer petar el timeout de 60s del Server Action.
    try {
      setIsUploading(true);
      setUploadStatus(`Pujant vídeo ${file.name}... (Sisplau, espera)`);
      
      const sigRes = await fetch(
        `/api/upload/signed-url?fileName=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type || 'video/mp4')}`
      );
      if (!sigRes.ok) throw new Error("No s'ha pogut obtenir la URL de pujada segura.");
      const { signedUrl, publicUrl } = await sigRes.json();

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed: HTTP ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error('Network error durant la pujada'));
        xhr.open('PUT', signedUrl);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.send(file);
      });

      // Guardem només la URL final. Així al guardar el POI, el servidor només rep un string en milisegons.
      updateVideoSlot(index, { file: null, url: publicUrl });
      alert(`Vídeo pujat correctament! Ara pots guardar el POI.`);
    } catch (err: any) {
      console.error(err);
      alert('Error pujant el vídeo: ' + err.message);
      updateVideoSlot(index, { file: null, url: '' });
    } finally {
      setIsUploading(false);
      setUploadStatus("");
    }
  };

  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");

  const handleAutoTranslate = async () => {
    if (!titles.ca) {
      alert("Cal un títol en català per traduir.");
      return;
    }
    setIsTranslating(true);
    try {
      const res = await translateFieldsAction({
        title: titles.ca,
        description: descriptions.ca,
        textContent: textContents.ca
      });
      if (res.success) {
        setTitles(prev => ({ ...prev, ...res.data.title }));
        setDescriptions(prev => ({ ...prev, ...res.data.description }));
        setTextContents(prev => ({ ...prev, ...res.data.textContent }));
      } else {
        alert("Error en la traducció: " + res.error);
      }
    } catch (err) {
      console.error("Translation Error:", err);
      alert("Error de connexió en la traducció");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleGenerateVoiceScriptAudio = async () => {
    setIsGeneratingAudio(true);
    try {
      if (!poi?.id) {
        alert("Si us plau, guarda el POI (Crea'l) abans de generar l'àudio.");
        setIsGeneratingAudio(false);
        return;
      }
      
      const res = await requestTtsGeneration(poi.id, voiceId);
      if (res.success) {
        alert("Generació d'àudio encuada correctament. El procés es farà en segon pla (pot trigar uns minuts). Torna a carregar la pàgina més tard per veure l'àudio.");
      } else {
        alert("Error encuant l'àudio: " + (res.error || "Error desconegut"));
      }
    } catch (err: any) {
      console.error("Audio Generation Error:", err);
      alert("Error de connexió en la sol·licitud");
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleGenerateAudios = async () => {
    setIsGeneratingAudio(true);
    try {
      if (!poi?.id) {
        alert("Si us plau, guarda el POI primer.");
        setIsGeneratingAudio(false);
        return;
      }
      const res = await requestTtsGeneration(poi.id, voiceId);
      if (res.success) {
        alert("Petició enviada! Es generarà l'audioguia en segon pla.");
      } else {
        alert("Error generant àudios: " + res.error);
      }
    } catch (err) {
      console.error("Audio Generation Error:", err);
      alert("Error de connexió en la generació d'àudios");
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleAddCarouselImage = () => {

    if (carouselImages.length >= 4) return;

    if (newCarouselFile) {
      const blobUrl = URL.createObjectURL(newCarouselFile);
      setCarouselImages([...carouselImages, blobUrl]);
      setCarouselFiles([...carouselFiles, newCarouselFile]);
      setCarouselCaptions([...carouselCaptions, {}]);
      setNewCarouselFile(null);
      setNewCarouselUrl('');
    } else if (newCarouselUrl) {
      setCarouselImages([...carouselImages, newCarouselUrl]);
      setCarouselFiles([...carouselFiles, null]);
      setCarouselCaptions([...carouselCaptions, {}]);
      setNewCarouselUrl('');
    }
  };

  const handleRemoveCarouselImage = (index: number) => {
    const url = carouselImages[index];
    if (url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
    setCarouselImages(carouselImages.filter((_, i) => i !== index));
    setCarouselFiles(carouselFiles.filter((_, i) => i !== index));
    setCarouselCaptions(carouselCaptions.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || isUploading) return;

    setIsUploading(true);
    setUploadStatus("Comprimint i pujant arxius...");

    const formData = new FormData();
    // We send the primary title/description/text for backward compatibility or default display
    formData.append('title', titles.ca || titles[Object.keys(titles)[0]] || '');
    formData.append('description', descriptions.ca || '');
    formData.append('text_content', textContents.ca || '');
    formData.append('voice_script', voiceScript || '');
    formData.append('voice_id', voiceId || 'nova');
    
    // We send the full translation objects as JSON
    formData.append('title_translations', JSON.stringify(titles));
    formData.append('description_translations', JSON.stringify(descriptions));
    formData.append('text_content_translations', JSON.stringify(textContents));

    formData.append('latitude', latitude);
    formData.append('longitude', longitude);
    formData.append('icon', icon);
    if (routeId) formData.append('route_id', routeId);
    formData.append('type', poiType);

    try {
      // 1. Upload App Thumbnail
      let finalAppThumbnail = appThumbnail;
      if (appThumbnailFile) {
        setUploadStatus("Pujant miniatura...");
        const compressed = await compressImage(appThumbnailFile);
        finalAppThumbnail = await uploadFileClient(compressed);
      }
      formData.append('app_thumbnail', finalAppThumbnail);

      // 2. Upload Header Image
      let finalHeader16x9 = header16x9;
      if (headerFile) {
        setUploadStatus("Pujant imatge de capçalera...");
        const compressed = await compressImage(headerFile);
        finalHeader16x9 = await uploadFileClient(compressed);
      }
      formData.append('header_16x9', finalHeader16x9);

      // 3. Upload Audio
      let finalAudioUrl = audioUrl;
      if (audioFile) {
        setUploadStatus("Pujant àudio...");
        finalAudioUrl = await uploadFileClient(audioFile);
      }
      formData.append('audio_url', finalAudioUrl);
      if (audioTranslations && Object.keys(audioTranslations).length > 0) {
        formData.append('audio_translations', JSON.stringify(audioTranslations));
      }
      if (videoTranslations && Object.keys(videoTranslations).length > 0) {
        formData.append('video_translations', JSON.stringify(videoTranslations));
      }

      // 4. Upload Carousel Images
      setUploadStatus("Pujant imatges del carrusel...");
      const finalCarouselUrls: string[] = [];
      for (let i = 0; i < carouselImages.length; i++) {
        const url = carouselImages[i];
        const file = carouselFiles[i];
        if (file) {
          const compressed = await compressImage(file);
          const uploadedUrl = await uploadFileClient(compressed);
          finalCarouselUrls.push(uploadedUrl);
        } else if (!url.startsWith('blob:')) {
          finalCarouselUrls.push(url);
        }
      }
      formData.append('carousel_images', JSON.stringify(finalCarouselUrls));
      formData.append('carousel_captions', JSON.stringify(carouselCaptions));

      // 5. Upload Videos
      setUploadStatus("Pujant vídeos...");
      const finalVideoUrls: string[] = [];
      for (let i = 0; i < videoSlots.length; i++) {
        const slot = videoSlots[i];
        if (slot.file) {
          const uploadedUrl = await uploadFileClient(slot.file);
          finalVideoUrls.push(uploadedUrl);
        } else if (slot.url && slot.url.startsWith('http')) {
          finalVideoUrls.push(slot.url);
        }
      }
      formData.append('video_urls', JSON.stringify(finalVideoUrls));
      formData.append('video_slot_count', videoSlots.length.toString());
      const initialVideos = parseVideos(poi?.videoUrls || poi?.video_urls || poi?.videoUrl || poi?.video_url);
      formData.append('initial_video_urls', JSON.stringify(initialVideos));

      if (manualQuiz) formData.append('manual_quiz', JSON.stringify(manualQuiz));

      setUploadStatus("Guardant informació al servidor...");
      console.log(">>> [ADMIN DEBUG] Enviant dades al servidor. Claus:", Array.from(formData.keys()));
      await onSave(formData);
    } catch (err: any) {
      alert("Error en la pujada client-side: " + err.message);
    } finally {
      setIsUploading(false);
      setUploadStatus("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between p-2 bg-blue-50 border border-blue-100 rounded-lg mb-4">
        <div className="flex items-center gap-2 text-[10px] text-blue-600 font-bold uppercase tracking-wider">
          <CloudUpload className="w-3 h-3" />
          Mode Estalvi de Dades (Pujada Directa) Actiu
        </div>
        <div className="text-[9px] text-blue-400 italic">Evita errors 413 de tamany</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Tabs value={activeLocale} onValueChange={setActiveLocale} className="w-full">
            <div className="flex items-center justify-between mb-2">
              <div className="flex flex-col gap-1">
                <Label className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-stone-400" />
                  Contingut Multilingüe
                </Label>
                {poi?.id && (
                  <div className="flex gap-2 mt-1">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      className="h-6 text-[9px] border-primary/30 text-primary hover:bg-primary/5"
                      disabled={isTranslating}
                      onClick={async () => {
                        setIsTranslating(true);
                        await autoTranslateAction('poi', poi.id);
                        window.location.reload();
                      }}
                    >
                      {isTranslating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : "🤖"} Auto-Traduir
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      className="h-6 text-[9px] border-purple-300 text-purple-600 hover:bg-purple-50"
                      disabled={isGeneratingAudio}
                      onClick={handleGenerateAudios}
                    >
                      {isGeneratingAudio ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Music className="w-3 h-3 mr-1" />} Audioguies IA
                    </Button>
                  </div>
                )}
              </div>
              <TabsList className="bg-stone-100/50 h-8 p-1">
                {SUPPORTED_LOCALES.map(loc => (
                  <TabsTrigger key={loc.id} value={loc.id} className="text-[10px] px-2 h-6 font-bold uppercase">
                    {loc.id}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {SUPPORTED_LOCALES.map(loc => (
              <TabsContent key={loc.id} value={loc.id} className="space-y-4 mt-0 border-l-2 border-primary/20 pl-4 py-2">
                <div className="grid gap-2">
                  <Label htmlFor={`title-${loc.id}`} className="text-xs font-bold text-stone-600">
                    Títol ({loc.name}) {loc.id === 'ca' && <span className="text-red-500">*</span>}
                  </Label>
                  <Input 
                    id={`title-${loc.id}`} 
                    value={titles[loc.id] || ''} 
                    onChange={(e) => setTitles({...titles, [loc.id]: e.target.value})} 
                    placeholder={`Ex: Església de Sant Joan (${loc.id.toUpperCase()})`} 
                    required={loc.id === 'ca'} 
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor={`desc-${loc.id}`} className="text-xs font-bold text-stone-600">
                    Descripció Breu ({loc.name})
                  </Label>
                  <Textarea 
                    id={`desc-${loc.id}`} 
                    value={descriptions[loc.id] || ''} 
                    onChange={(e) => setDescriptions({...descriptions, [loc.id]: e.target.value})} 
                    className="min-h-[60px] text-sm"
                    placeholder={`Resum en ${loc.name}...`}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor={`textContent-${loc.id}`} className="text-xs font-bold text-stone-600">
                    Text Històric / Curiositats ({loc.name})
                  </Label>
                  <Textarea 
                    id={`textContent-${loc.id}`} 
                    value={textContents[loc.id] || ''} 
                    onChange={(e) => setTextContents({...textContents, [loc.id]: e.target.value})} 
                    className="min-h-[120px] text-sm font-light leading-relaxed" 
                    placeholder={`Escu lo que la IA farà servir per explicar aquest punt en ${loc.name}...`}
                  />
                </div>
              </TabsContent>
            ))}
          </Tabs>

          {/* Botó d'IA per a Traducció de Text */}
          <div className="pt-4 border-t border-stone-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full bg-stone-50 border-stone-200 text-stone-600 hover:bg-white hover:text-primary transition-all text-[11px] h-9"
              onClick={handleAutoTranslate}
              disabled={isTranslating || !titles.ca}
            >
              {isTranslating ? (
                <Loader2 className="w-3 h-3 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3 mr-2 text-amber-500" />
              )}
              {isTranslating ? 'Traduint...' : 'Auto-Tradueix Continguts (IA)'}
            </Button>
          </div>

          <div className="grid gap-2 pt-4 border-t border-stone-100">
            <div className="flex items-center justify-between">
              <Label htmlFor="voiceScript" className="flex items-center gap-2 font-bold text-stone-600">
                🎙️ Guió de Veu (Audioguia IA)
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-900 transition-all text-[11px] h-8 px-3 flex items-center gap-1.5"
                onClick={handleGenerateVoiceScriptAudio}
                disabled={isGeneratingAudio || (!voiceScript && !textContents.ca && !descriptions.ca)}
                title="Envia a la cua per generar àudio en segon pla"
              >
                {isGeneratingAudio ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                )}
                {isGeneratingAudio ? 'Encuant...' : 'Generar Audioguia (IA)'}
              </Button>
            </div>
            
            <div className="flex gap-4">
              <div className="flex-1">
                <p className="text-[10px] text-stone-400 italic mb-2">
                  Text expressiu que el motor de veu llegirà per a l'idioma base (Català). Un procés en segon pla (Outbox) generarà l'àudio.
                </p>
                <Textarea 
                  id="voiceScript" 
                  value={voiceScript} 
                  onChange={(e) => setVoiceScript(e.target.value)} 
                  className="min-h-[100px] text-sm bg-indigo-50/30 border-indigo-100 focus:border-indigo-300"
                  placeholder="Escriu el guió narratiu per a la veu..."
                />
              </div>
              <div className="w-48 space-y-2">
                <Label htmlFor="voiceId" className="text-xs font-bold text-stone-600">Veu (Persona)</Label>
                <select
                  id="voiceId"
                  value={voiceId}
                  onChange={(e) => setVoiceId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-medium"
                >
                  <option value="nova">Nova (Femenina, enèrgica)</option>
                  <option value="alloy">Alloy (Andrògina, versàtil)</option>
                  <option value="echo">Echo (Masculina, suau)</option>
                  <option value="fable">Fable (Masc., britànica)</option>
                  <option value="onyx">Onyx (Masculina, greu)</option>
                  <option value="shimmer">Shimmer (Femenina, dolça)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid gap-2 pt-4 border-t border-stone-100">
            <Label htmlFor="routeId" className="flex items-center gap-2">
              <FolderIcon className="w-4 h-4 text-stone-400" />
              Assignar a Carpeta (Ruta) <span className="text-red-500">*</span>
            </Label>
            <select
              id="routeId"
              value={routeId}
              onChange={(e) => setRouteId(e.target.value)}
              required
              className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${!routeId ? 'border-red-300 bg-red-50/30' : 'border-input'}`}
            >
              <option value="" disabled>— Selecciona una ruta obligatòriament —</option>
              {routes.map((r: any) => (
                <option key={r.id} value={r.id}>{r.title || r.name}</option>
              ))}
            </select>
          </div>

          <div className="grid gap-2 pt-2 border-t border-stone-100">
            <Label htmlFor="poiType">Categoria</Label>
            <select
              id="poiType"
              value={poiType}
              onChange={(e) => setPoiType(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {['RELIGIOS', 'DEFENSIU', 'CIVIL', 'NATURA', 'AIGUA', 'MIRADOR', 'LLEGENDA', 'PERSONA_ILLUSTRE', 'GUERRA_CIVIL'].map(t => (
                <option key={t} value={t}>{t.replace('_', ' ')}</option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <MapIcon className="w-4 h-4 text-stone-400" />
              Símbol al Mapa (Icona)
            </Label>
            <div className="flex flex-wrap gap-2 p-3 bg-stone-50 rounded-xl border border-stone-100 max-h-[160px] overflow-y-auto">
              {(() => {
                const biomeKey = municipalityTheme || 'mountain';
                const biome = BIOME_MAP[biomeKey] || 'Montanya';
                const availableIcons = (iconsMapping as any)[biome] || [];

                return availableIcons.map((iconName: string) => {
                  const iconUrl = `/icons/${biome}/${iconName}`;
                  const isSelected = icon === iconName;

                  return (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => setIcon(iconName)}
                      className={`relative w-12 h-12 rounded-lg border-2 transition-all p-1 bg-white hover:scale-105 ${isSelected ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-stone-200 opacity-60 grayscale hover:opacity-100 hover:grayscale-0'}`}
                    >
                      <img src={iconUrl} alt={iconName} className="w-full h-full object-contain" title={iconName} />
                      {isSelected && (
                        <div className="absolute -top-1 -right-1 bg-primary text-white rounded-full p-0.5 shadow-sm">
                          <div className="w-2 h-2 rounded-full bg-white" />
                        </div>
                      )}
                    </button>
                  );
                });
              })()}
            </div>
            <p className="text-[10px] text-stone-400 italic px-1">Tria el símbol que apareixerà al mapa per aquest punt.</p>
          </div>


          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Latitud</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="42.411466"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value.replace(',', '.'))}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>Longitud</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="1.131715"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value.replace(',', '.'))}
                required
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-stone-400" />
                Foto Llistat
              </div>
              <Badge variant="outline" className="text-[9px]">1:1</Badge>
            </Label>
            {appThumbnailFile ? (
              <div className="mb-2 text-xs text-stone-600 bg-stone-100 p-2 rounded flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="truncate">Arxiu a pujar: {appThumbnailFile.name}</span>
              </div>
            ) : appThumbnail ? (
              <div className="mb-2 w-16 h-16 rounded-md overflow-hidden border border-stone-200">
                <img src={appThumbnail} alt="App Thumbnail" className="w-full h-full object-cover" />
              </div>
            ) : null}
            <Input type="file" accept="image/*" onChange={(e) => setAppThumbnailFile(e.target.files?.[0] || null)} />
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-stone-400 font-bold uppercase">O URL:</span>
              <Input value={appThumbnail} onChange={(e) => setAppThumbnail(e.target.value)} placeholder="Enganxa una URL d'imatge..." className="h-8 text-xs" />
            </div>
          </div>

          <div className="grid gap-2">
            <Label className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-stone-400" />
                Foto Header
              </div>
              <Badge variant="outline" className="text-[9px]">16:9</Badge>
            </Label>
            {headerFile ? (
              <div className="mb-2 text-xs text-stone-600 bg-stone-100 p-2 rounded flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="truncate">Arxiu a pujar: {headerFile.name}</span>
              </div>
            ) : header16x9 ? (
              <div className="mb-2 w-32 h-18 aspect-video rounded-md overflow-hidden border border-stone-200">
                <img src={header16x9} alt="Header 16:9" className="w-full h-full object-cover" />
              </div>
            ) : null}
            <Input type="file" accept="image/*" onChange={(e) => setHeaderFile(e.target.files?.[0] || null)} />
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-stone-400 font-bold uppercase">O URL:</span>
              <Input value={header16x9} onChange={(e) => setHeader16x9(e.target.value)} placeholder="Enganxa una URL d'imatge panoràmica..." className="h-8 text-xs" />
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Music className="w-4 h-4 text-stone-400" />
                Àudio (MP3)
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="bg-indigo-50/70 border-indigo-200 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-900 transition-all text-[10px] h-7 px-2.5 flex items-center gap-1.5"
                onClick={handleGenerateAudios}
                disabled={isGeneratingAudio || (!voiceScript && !textContents.ca && !descriptions.ca)}
                title="Genera les audioguies MP3 en tots els idiomes amb IA"
              >
                {isGeneratingAudio ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Music className="w-3 h-3 text-indigo-500" />
                )}
                {isGeneratingAudio ? 'Generant...' : 'Audioguies IA'}
              </Button>
            </div>
            {audioTranslations && Object.keys(audioTranslations).length > 0 ? (
              Object.entries(audioTranslations).map(([loc, url]) => (
                <div key={loc} className="flex items-center gap-2 mb-1 p-2 bg-stone-50 rounded-lg border border-stone-200">
                  <span className="text-[10px] font-bold w-6 text-center uppercase text-stone-500">{loc}</span>
                  <audio src={url as string} controls className="h-8 w-full" />
                </div>
              ))
            ) : (
              audioUrl && !audioFile && (
                <div className="flex items-center gap-2 mb-1 p-2 bg-stone-50 rounded-lg border border-stone-200">
                  <span className="text-[10px] font-bold w-6 text-center uppercase text-stone-500">CA</span>
                  <audio src={audioUrl} controls className="h-8 w-full" />
                </div>
              )
            )}
            <Input type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
          </div>

          <div className="grid gap-3 pt-2 border-t border-stone-100">
            <Label className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-stone-400" />
                Vídeos Reel (Màx 30MB per fitxer)
              </div>
              <Button type="button" variant="outline" size="sm" className="h-7 text-[10px]" onClick={handleAddVideoSlot}>
                Afegir Slot
              </Button>
            </Label>
            <p className="text-[10px] text-orange-600 font-medium px-1">Per a vídeos pesats, guarda el punt i usa la 'Consola HLS' de sota.</p>
            {videoSlots.map((slot, idx) => (
              <div key={idx} className="p-3 rounded-xl border border-stone-200 bg-stone-50/50 space-y-2 w-full min-w-0 overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-stone-500 uppercase">Vídeo {idx + 1}</span>
                  <button type="button" onClick={() => handleRemoveVideoSlot(idx)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {slot.url && (
                  <div className="flex flex-col gap-2 bg-white p-2 rounded-lg border border-stone-200 text-xs min-w-0 w-full overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                        <Film className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                        <span className="font-mono text-[11px] text-stone-600 truncate min-w-0" title={slot.file ? slot.file.name : slot.url}>
                          {(() => {
                            if (slot.file) return slot.file.name;
                            let fname = slot.url.split('/').pop() || slot.url;
                            if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_/i.test(fname)) {
                              fname = fname.substring(37);
                            }
                            return fname;
                          })()}
                        </span>
                      </div>
                      {slot.url.startsWith('http') && (
                        <div className="flex flex-nowrap overflow-x-auto items-center gap-1.5 justify-start sm:justify-end flex-shrink-0 w-full pb-1 scrollbar-hide">
                          <a
                            href={slot.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 font-bold flex-shrink-0 bg-blue-50 px-2 py-1 rounded border border-blue-100"
                          >
                            <ExternalLink className="w-3 h-3" /> Veure
                          </a>
                          
                          {/* Selector de veu per vídeo */}
                          <div className="flex items-center gap-1.5 ml-2">
                            <Label className="text-[10px] text-stone-500 font-medium">Veu:</Label>
                            <select
                              value={slot.voiceId || voiceId || 'nova'}
                              onChange={(e) => updateVideoSlot(idx, { voiceId: e.target.value })}
                              className="text-[10px] border border-stone-200 rounded px-1.5 py-1 bg-white h-7 outline-none focus:border-purple-300"
                            >
                              <option value="nova">Dona (Nova)</option>
                              <option value="alloy">Home (Alloy)</option>
                              <option value="echo">Home (Echo)</option>
                              <option value="fable">Dona/Nen (Fable)</option>
                              <option value="onyx">Home Greu (Onyx)</option>
                              <option value="shimmer">Dona Clara (Shimmer)</option>
                            </select>
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[9px] text-purple-600 border-purple-200 hover:bg-purple-50 flex-shrink-0 font-bold"
                            onClick={async () => {
                              if (!poi?.id) { alert("Has de guardar el POI primer."); return; }
                              if (slot.url.startsWith('blob:')) {
                                alert("Has de desar el punt (Guardar) per pujar el vídeo abans de poder-lo traduir.");
                                return;
                              }
                              const { requestVideoTranslation } = await import('@/lib/actions/omnivoice');
                              const selectedVoice = slot.voiceId || voiceId || 'nova';
                              const res = await requestVideoTranslation(poi.id, slot.url, selectedVoice);
                              if (res.success) {
                                alert("Traducció de vídeo encuada! L'IA està treballant-hi.");
                                setPendingTranslations(prev => ({ ...prev, [slot.url]: true }));
                              } else {
                                alert("Error: " + res.error);
                              }
                            }}
                          >
                            <Sparkles className="w-3 h-3 mr-1" /> Traduir
                          </Button>
                          
                          {/* Check de traducció completada / pendent */}
                          {pendingTranslations[slot.url] ? (
                            <div className="flex items-center gap-1 px-1.5 py-1 bg-blue-50 border border-blue-200 rounded text-blue-700 text-[10px] font-bold" title="Traducció en curs">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              PROCESSANT...
                            </div>
                          ) : videoTranslations?.[slot.url] && Object.keys(videoTranslations[slot.url]).length > 0 ? (
                            <div className="flex items-center gap-1 px-1.5 py-1 bg-green-50 border border-green-200 rounded text-green-700 text-[10px] font-bold" title="Traduccions completades">
                              <CheckCircle2 className="w-3 h-3" />
                              {Object.keys(videoTranslations[slot.url]).join(', ').toUpperCase()}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <Input
                  type="file"
                  accept="video/*"
                  onChange={(e) => handleVideoFileChange(idx, e.target.files?.[0] || null)}
                  className="h-9 text-xs cursor-pointer w-full max-w-full overflow-hidden text-ellipsis"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-stone-100 space-y-4">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 font-bold text-stone-800">
            <span>🤖</span> Repte de Quiz (IA)
          </Label>
          {manualQuiz && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setManualQuiz(null)}
              className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
            >
              Eliminar Quiz
            </Button>
          )}
        </div>

        {manualQuiz ? (
          <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 space-y-3">
            <div>
              <Label className="text-xs text-stone-500">Pregunta:</Label>
              <Input 
                value={manualQuiz.pregunta || ''} 
                onChange={e => setManualQuiz({...manualQuiz, pregunta: e.target.value})}
                className="bg-white text-sm"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {manualQuiz.opcions?.map((opt: string, idx: number) => (
                <div key={idx} className={`space-y-1 p-2 rounded-lg border ${idx === manualQuiz.correcta ? `${activeTheme.border} ${activeTheme.bg}` : 'border-stone-200 bg-white'}`}>
                  <Label className="text-[10px] text-stone-400">Opció {String.fromCharCode(65+idx)} {idx === manualQuiz.correcta && "✓"}</Label>
                  <Input 
                    value={opt} 
                    onChange={e => {
                      const newOpts = [...manualQuiz.opcions];
                      newOpts[idx] = e.target.value;
                      setManualQuiz({...manualQuiz, opcions: newOpts});
                    }}
                    className="h-8 text-xs bg-white"
                  />
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    className={`w-full h-6 text-[10px] mt-1 ${idx === manualQuiz.correcta ? `${activeTheme.text} font-bold` : 'text-stone-400'}`}
                    onClick={() => setManualQuiz({...manualQuiz, correcta: idx})}
                  >
                    {idx === manualQuiz.correcta ? 'Correcta' : 'Marcar Correcta'}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-stone-400 italic">Aquest punt no té cap quiz assignat.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setManualQuiz({ pregunta: '', opcions: ['', '', '', ''], correcta: 0 })}
              className="w-full text-xs"
            >
              Crear Quiz Manualment
            </Button>
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isGeneratingQuiz || !textContents[activeLocale] || !titles[activeLocale]}
          onClick={async () => {
            setIsGeneratingQuiz(true);
            try {
              const res = await fetch('/api/ai/generate-quiz', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  title: titles[activeLocale] || titles.ca, 
                  content: textContents[activeLocale] || textContents.ca, 
                  type: poiType,
                  locale: activeLocale 
                })
              });
              const data = await res.json();
              if (data.success && data.quiz) {
                setManualQuiz(data.quiz);
              } else {
                alert(data.error || "No s'ha pogut generar el quiz");
              }
            } catch (e) {
              console.error("Error generant quiz:", e);
              alert("Error de connexió");
            } finally {
              setIsGeneratingQuiz(false);
            }
          }}
          className="w-full text-xs"
        >
          {isGeneratingQuiz ? 'Generant...' : (manualQuiz ? 'Regenerar Quiz amb IA' : 'Generar Quiz amb IA')}
        </Button>
        {!textContents.ca && <p className="text-[10px] text-amber-600">⚠️ Cal omplir el 'Text Històric' en català (base) per generar el quiz.</p>}
      </div>

      <div className="space-y-4 pt-4 border-t border-stone-100">
        <Label>Carrusel (Max 4)</Label>
        <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/30 space-y-4">
          <Input type="file" accept="image/*" onChange={(e) => setNewCarouselFile(e.target.files?.[0] || null)} />
          <Button type="button" onClick={handleAddCarouselImage} disabled={!newCarouselFile || carouselImages.length >= 4}>
            Afegir al carrusel
          </Button>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {carouselImages.map((url, idx) => (
            <div key={idx} className="flex flex-col gap-2">
              <div className="relative aspect-square bg-stone-100 rounded-md overflow-hidden group">
                <img src={url} alt={`Carousel ${idx}`} className="w-full h-full object-cover" />
                <button type="button" onClick={() => handleRemoveCarouselImage(idx)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100">
                  <X className="w-3 h-3" />
                </button>
              </div>
              <Textarea 
                placeholder={`Text de la imatge (${activeLocale.toUpperCase()})`}
                value={carouselCaptions[idx]?.[activeLocale] || ''}
                onChange={(e) => {
                  const newCaptions = [...carouselCaptions];
                  if (!newCaptions[idx]) newCaptions[idx] = {};
                  newCaptions[idx][activeLocale] = e.target.value;
                  setCarouselCaptions(newCaptions);
                }}
                className="text-xs resize-none h-16"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="pt-6 flex flex-col gap-4">
        {isUploading && (
          <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl flex items-center gap-4 animate-pulse">
            <CloudUpload className="w-8 h-8 text-primary animate-bounce" />
            <div className="flex-1">
              <div className="text-sm font-bold text-primary">{uploadStatus}</div>
              <div className="text-[10px] text-stone-500 italic">Estem enviant els arxius directament al núvol per evitar errors de tamany.</div>
            </div>
          </div>
        )}
        <div className="flex gap-4">
          <Button type="submit" disabled={isLoading || isUploading} className={`flex-1 ${activeTheme.primary} ${activeTheme.hover} text-white py-6 h-auto text-lg font-serif`}>
            {isLoading || isUploading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {isUploading ? 'Pujant Multimèdia...' : 'Guardant...'}
              </>
            ) : (poi ? 'Actualitzar Punt Territorial' : 'Crear Nou Punt Territorial')}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} className={`py-6 h-auto px-8 ${activeTheme.text} border-stone-200 hover:${activeTheme.bg}`} disabled={isUploading}>Cancel·lar</Button>
        </div>
      </div>
    </form >
  );
}

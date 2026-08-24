'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getRouteWithPois, addPoiToRoute, removePoiFromRoute, closeRouteAndGenerateFinalQuiz } from '@/lib/actions/content';
import { CheckCircle2, Trophy, Loader2, MapPin, Trash2, RefreshCw, Pencil } from 'lucide-react';

interface Poi {
  id: string;
  title: string;
  description?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  appThumbnail?: string | null;
  header16x9?: string | null;
  audioUrl?: string | null;
  videoUrls?: string[] | null | any;
  textContent?: string | null;
  carouselImages?: string[] | null | any;
  orderIndex?: number;
  manualQuiz?: any;
}

interface RoutePoiManagerProps {
  routeId: string;
  routeName: string;
  onClose: () => void;
  onEditPoi?: (poi: Poi) => void;
  theme?: any;
}

export default function RoutePoiManager({ routeId, routeName, onClose, onEditPoi, theme }: RoutePoiManagerProps) {
  const activeTheme = theme || {
    text: "text-[#2D4636]",
    mainText: "text-[#2D4636]/80",
    bg: "bg-[#2D4636]/10",
    primary: "bg-[#2D4636]",
    hover: "hover:bg-[#1E2F24]",
  };
  const [pois, setPois] = useState<Poi[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<string | null>(null); // poiId being processed
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [routeStatus, setRouteStatus] = useState<string>('DRAFT');
  const [finalQuiz, setFinalQuiz] = useState<any>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const route = await getRouteWithPois(routeId);
      const mappedPois = route?.routePois?.map(rp => ({
        ...rp.poi,
        routeId: route.id,
        orderIndex: rp.orderIndex
      })) ?? [];
      setPois(mappedPois);
      setRouteStatus((route as any)?.status || 'DRAFT');
      setFinalQuiz((route as any)?.finalQuiz || null);
    } finally {
      setIsLoading(false);
    }
  }, [routeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleRemovePoi(poiId: string) {
    if (!confirm('Treure aquest punt de la ruta?')) return;
    setIsSaving(poiId);
    const res = await removePoiFromRoute(routeId, poiId);
    if (res.success) {
      setPois(prev => prev.filter(p => p.id !== poiId));
    } else {
      alert('Error: ' + res.error);
    }
    setIsSaving(null);
  }

  async function handleAddOrphan(poiId: string) {
    setIsSaving(poiId);
    const nextOrder = pois.length;
    const res = await addPoiToRoute(routeId, poiId, nextOrder);
    if (res.success) {
      await fetchData();
    } else {
      alert('Error: ' + res.error);
    }
    setIsSaving(null);
  }

  async function handleFinalize() {
    if (!confirm('Vols tancar la ruta i generar el Repte Final amb IA? Això analitzarà tots els punts.')) return;
    setIsFinalizing(true);
    try {
      const res = await closeRouteAndGenerateFinalQuiz(routeId);
      if (res.success) {
        setRouteStatus('CLOSED');
        setFinalQuiz(res.finalQuiz);
        alert('Ruta segellada i Repte Final generat amb èxit!');
      } else {
        alert('Error: ' + res.error);
      }
    } finally {
      setIsFinalizing(false);
    }
  }


  return (
    <div className="bg-stone-50 border border-stone-200 rounded-xl shadow-inner p-6 space-y-6 animate-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-serif text-lg font-bold text-stone-900">Punts de la Ruta</h3>
          <p className="text-xs text-stone-500 mt-0.5">
            <span className={`font-medium ${activeTheme.mainText}`}>"{routeName}"</span>
            {' '}— {pois.length} punt{pois.length !== 1 ? 's' : ''} assignat{pois.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={fetchData} title="Refrescar">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={onClose}>
            Tancar
          </Button>
        </div>
      </div>

      {/* Route Status Banner */}
      {routeStatus === 'CLOSED' ? (
        <div className={`${activeTheme.bg} border ${activeTheme.border} rounded-lg p-3 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <Trophy className={`w-5 h-5 ${activeTheme.text}`} />
            <div>
              <p className={`text-xs font-bold ${activeTheme.mainText} uppercase tracking-widest`}>Ruta Segellada</p>
              <p className={`text-[10px] ${activeTheme.text}`}>Aquesta ruta ja és visible per als usuaris i té un Repte Final.</p>
            </div>
          </div>
          <Badge variant="outline" className={`${activeTheme.bgSoft} ${activeTheme.text} ${activeTheme.border}`}>ACTIVA</Badge>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-amber-600" />
            <div>
              <p className="text-xs font-bold text-amber-800 uppercase tracking-widest">Ruta en esborrany</p>
              <p className="text-[10px] text-amber-600">Afegeix punts i prem "Finalitzar" per publicar-la.</p>
            </div>
          </div>
          <Button
            size="sm"
            disabled={pois.length === 0 || isFinalizing}
            onClick={handleFinalize}
            className={`${activeTheme.primary} ${activeTheme.hover} text-white text-xs h-8 px-4`}
          >
            {isFinalizing ? (
              <><Loader2 className="w-3 h-3 mr-2 animate-spin" /> Generant...</>
            ) : (
              'Finalitzar i Segellar'
            )}
          </Button>
        </div>
      )}

      {/* Final Quiz Preview if exists */}
      {finalQuiz && (
        <div className="bg-stone-100 border border-stone-200 rounded-lg p-3 space-y-2">
          <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest flex items-center gap-2">
            <Trophy className="w-3 h-3" /> Repte Final (Generat per IA)
          </p>
          {finalQuiz.preguntes ? (
            <div className="space-y-3">
              {finalQuiz.preguntes.map((q: any, i: number) => (
                <div key={i} className="border-b border-stone-200 pb-2 last:border-0 last:pb-0">
                  <p className="text-xs font-bold text-stone-800">{i + 1}. {q.pregunta}</p>
                  <div className="grid grid-cols-2 gap-1 mt-1">
                    {q.opcions?.map((o: string, idx: number) => (
                      <div key={idx} className={`text-[10px] p-1.5 rounded border ${idx === q.correcta ? `${activeTheme.border} ${activeTheme.bg} ${activeTheme.text} font-bold` : 'border-stone-200 bg-white text-stone-500'}`}>
                        {o} {idx === q.correcta && "✓"}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <p className="text-xs font-bold text-stone-800">{finalQuiz.pregunta}</p>
              <div className="grid grid-cols-2 gap-1 mt-1">
                {finalQuiz.opcions?.map((o: string, idx: number) => (
                  <div key={idx} className={`text-[10px] p-1.5 rounded border ${idx === finalQuiz.correcta ? `${activeTheme.border} ${activeTheme.bg} ${activeTheme.text} font-bold` : 'border-stone-200 bg-white text-stone-500'}`}>
                    {o} {idx === finalQuiz.correcta && "✓"}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-stone-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Carregant punts...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* LEFT: Current POIs in this route */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5" /> Punts Actuals
            </h4>
            {pois.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-stone-200 rounded-lg">
                <p className="text-sm text-stone-400">Cap punt assignat a aquesta ruta.</p>
                <p className="text-xs text-stone-400 mt-1">Afegeix-ne de nous o assigna'n d'existents.</p>
              </div>
            ) : (
              <ol className="space-y-2">
                {pois.map((poi, idx) => (
                  <li
                    key={poi.id}
                    className="flex items-center gap-3 bg-white border border-stone-200 rounded-lg p-3 shadow-sm"
                  >
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-stone-800 text-white text-[10px] font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-800 truncate">{poi.title}</p>
                      <p className="text-[10px] text-stone-400 font-mono">
                        {poi.latitude?.toFixed(4) ?? '—'}, {poi.longitude?.toFixed(4) ?? '—'}
                      </p>
                    </div>
                    {(poi.latitude && poi.longitude) ? (
                      <Badge variant="outline" className={`text-[9px] ${activeTheme.border} ${activeTheme.text} flex-shrink-0`}>
                        📍 GPS
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[9px] border-red-200 text-red-600 flex-shrink-0">
                        ⚠️ Sense GPS
                      </Badge>
                    )}
                    {/* Edit button */}
                    {onEditPoi && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          onEditPoi(poi);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        disabled={isSaving === poi.id}
                        className={`text-stone-400 hover:${activeTheme.mainText} hover:${activeTheme.bg} flex-shrink-0 p-1.5 h-auto`}
                        title="Editar punt"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemovePoi(poi.id)}
                      disabled={isSaving === poi.id}
                      className="text-stone-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0 p-1.5 h-auto"
                      title="Treure de la ruta"
                    >
                      {isSaving === poi.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    </Button>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* RIGHT: Hint to use the editor above */}
          <div className="space-y-4">
            <div className="border border-stone-200 rounded-lg p-4 bg-white">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">Crear nou punt</h4>
              <p className="text-xs text-stone-400 italic">
                Utilitza l&apos;&quot;Editor de Punts&quot; de dalt per crear un nou punt.<br />
                Assegura&apos;t de seleccionar <strong className="text-stone-600">&quot;{routeName}&quot;</strong> al desplegable de ruta.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

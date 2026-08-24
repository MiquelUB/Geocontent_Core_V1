'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AiRouteGenerator from '@/components/admin/AiRouteGenerator';
import { UsersTable } from '@/components/admin/UsersTable';
import ExecutiveReport from '@/components/admin/ExecutiveReport';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, FileText, UploadCloud, AlertCircle, Plus, X, ImageIcon, MonitorPlay, Globe, Languages, Sparkles, CheckCircle2 } from "lucide-react";
import { verifyAdminPassword } from "@/lib/actions/auth";
import { createRoute, updateRoute, deleteLegend, createPoi, updatePoi, addPoiToRoute } from "@/lib/actions/content";
import { translateRouteAction, translateFieldsAction } from "@/lib/actions/ai";
import { getAdminLegends, getRouteWithPois, getAllProfiles } from "@/lib/actions/queries";
import { getReports } from "@/lib/actions/reports";
import { compressImage } from "@/lib/imageOptimization";
import { uploadFileClient } from "@/lib/upload-client";
import { useRouter } from "next/navigation";
import { getAdminTheme } from "@/lib/adminTheme";
import VideoUploader from "./VideoUploader";
import ManualPoiForm from "./ManualPoiForm";
import RoutePoiManager from "./RoutePoiManager";
import MunicipalityManager from "./MunicipalityManager";
import AdminSecurityGate from "./AdminSecurityGate";
import { PublishChangesButton } from "./PublishChangesButton";
import S3Maintenance from "./S3Maintenance";

interface Legend {
  id: string;
  title?: string;
  name?: string;
  description?: string;
  category?: string;
  location_name?: string;
  municipality_name?: string;
  pois_count?: number;
  total_visits?: number;
  created_at?: string;
  pois?: any[];
  downloadRequired?: boolean;
}

export default function AdminDashboard({
  municipalityId,
  municipalityTheme,
  legends: initialLegends = [],
  profiles: initialProfiles = [],
  reports: initialReports = [],
  brand: initialBrand = null
}: {
  municipalityId?: string,
  municipalityTheme?: string,
  legends?: Legend[],
  profiles?: any[],
  reports?: any[],
  brand?: any
}) {
  const router = useRouter();
  const [brand, setBrand] = useState<any>(initialBrand);
  const adminTheme = getAdminTheme(brand?.themeId || municipalityTheme);
  const [activeTab, setActiveTab] = useState<'rutes' | 'usuaris' | 'executiu' | 'config'>('rutes');
  const [isLoading, setIsLoading] = useState(false);

  // 🔄 Sync state with initialBrand when server re-renders (router.refresh())
  useEffect(() => {
    if (initialBrand) {
      setBrand(initialBrand);
    }
  }, [initialBrand]);

  // States per a la creació de Ruta (Carpeta/Legend)
  const [routeTitle, setRouteTitle] = useState('');
  const [routeDescription, setRouteDescription] = useState('');
  const [routeLocation, setRouteLocation] = useState('');
  const [routeThumbnail, setRouteThumbnail] = useState('');
  const [routeThumbFile, setRouteThumbFile] = useState<File | null>(null);
  const [routeHeader, setRouteHeader] = useState('');
  const [routeHeaderFile, setRouteHeaderFile] = useState<File | null>(null);
  const [routeCategory, setRouteCategory] = useState(municipalityTheme || 'mountain');
  const [routeDownloadRequired, setRouteDownloadRequired] = useState(false);
  const [routeFinalQuiz, setRouteFinalQuiz] = useState<any>(null);
  const [isGeneratingRouteQuiz, setIsGeneratingRouteQuiz] = useState(false);
  const [translatingRouteId, setTranslatingRouteId] = useState<string | null>(null);

  // States per a traduccions de Ruta (Formulari)
  const [routeNameTranslations, setRouteNameTranslations] = useState<Record<string, string>>({});
  const [routeDescriptionTranslations, setRouteDescriptionTranslations] = useState<Record<string, string>>({});
  const [isTranslatingRouteForm, setIsTranslatingRouteForm] = useState(false);

  // State per llistat
  const [legends, setLegends] = useState<Legend[]>(initialLegends);
  const [editingRoute, setEditingRoute] = useState<Legend | null>(null);

  // Per gestionar POIs de la ruta des d'aquest dashboard
  const [managingRoute, setManagingRoute] = useState<any>(null);
  const [editingPoi, setEditingPoi] = useState<any>(null);
  const [editingLegend, setEditingLegend] = useState<any>(null);
  const [profiles, setProfiles] = useState<any[]>(initialProfiles);
  const [reports, setReports] = useState<any[]>(initialReports);

  useEffect(() => {
    async function fetchData() {
      // Si no tenim dades inicials o volem refrescar, les tornem a carregar solo si necesario
      if (legends.length === 0) {
        const data = await getAdminLegends();
        setLegends(data as any);
      }

      if (profiles.length === 0) {
        const profilesData = await getAllProfiles();
        setProfiles(profilesData);
      }

      if (reports.length === 0) {
        const reportsData = await getReports(municipalityId);
        setReports(reportsData || []);
      }

      // Fetch brand if not provided
      if (!brand && municipalityId) {
        const res = await fetch(`/api/municipality?id=${municipalityId}`);
        const brandData = await res.json();
        setBrand(brandData);
      }
    }
    fetchData();
  }, [municipalityId, initialLegends.length, initialProfiles.length, initialReports.length]);
  useEffect(() => {
    setProfiles(initialProfiles);
  }, [initialProfiles]);

  useEffect(() => {
    setReports(initialReports);
  }, [initialReports]);

  useEffect(() => {
    if (editingRoute) {
      setRouteTitle(editingRoute.title || editingRoute.name || '');
      setRouteDescription(editingRoute.description || '');
      setRouteLocation(editingRoute.location_name || '');
      setRouteCategory(editingRoute.category || '');
      setRouteDownloadRequired(editingRoute.downloadRequired || false);
      setRouteThumbnail((editingRoute as any).thumbnail_1x1 || (editingRoute as any).thumbnail1x1 || '');
      setRouteHeader((editingRoute as any).header_16x9 || (editingRoute as any).header16x9 || '');
      setRouteNameTranslations((editingRoute as any).nameTranslations || {});
      setRouteDescriptionTranslations((editingRoute as any).descriptionTranslations || {});
    }
  }, [editingRoute]);

  const resetRouteForm = () => {
    setEditingLegend(null);
    setEditingRoute(null);
    setEditingPoi(null);
    setRouteTitle('');
    setRouteDescription('');
    setRouteLocation('');
    setRouteThumbnail('');
    setRouteThumbFile(null);
    setRouteHeader('');
    setRouteHeaderFile(null);
    setRouteCategory(municipalityTheme || 'mountain');
    setRouteDownloadRequired(false);
    setRouteThumbFile(null);
    setRouteFinalQuiz(null);
    setRouteNameTranslations({});
    setRouteDescriptionTranslations({});
  };

  async function handleTranslateRouteForm() {
    if (!routeTitle) {
      alert("S'ha d'introduir el Nom de la Ruta per traduir.");
      return;
    }
    setIsTranslatingRouteForm(true);
    try {
      const res = await translateFieldsAction({
        name: routeTitle,
        description: routeDescription || ''
      });
      if (res.success && res.data) {
        const nt = res.data.name || {};
        const dt = res.data.description || {};
        setRouteNameTranslations(nt);
        setRouteDescriptionTranslations(dt);

        if (editingRoute?.id) {
          await translateRouteAction(editingRoute.id);
        }
        alert("Traduccions de la ruta generades amb èxit (Castellà, Anglès, Francès)!");
      } else {
        alert("Error traduint la ruta: " + res.error);
      }
    } catch (err: any) {
      console.error("Error traduint la ruta:", err);
      alert("Error de connexió en traduir la ruta");
    } finally {
      setIsTranslatingRouteForm(false);
    }
  }

  async function handleSaveRoute() {
    if (!routeTitle) return alert('El títol de la ruta és obligatori.');
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', routeTitle);
      formData.append('description', routeDescription);
      formData.append('location', routeLocation);
      formData.append('category', routeCategory);
      if (Object.keys(routeNameTranslations).length > 0) {
        formData.append('name_translations', JSON.stringify(routeNameTranslations));
      }
      if (Object.keys(routeDescriptionTranslations).length > 0) {
        formData.append('description_translations', JSON.stringify(routeDescriptionTranslations));
      }
      let finalRouteThumbnail = routeThumbnail;
      if (routeThumbFile) {
        const compressed = await compressImage(routeThumbFile);
        finalRouteThumbnail = await uploadFileClient(compressed);
      }
      formData.append('thumbnail_1x1', finalRouteThumbnail);

      let finalRouteHeader = routeHeader;
      if (routeHeaderFile) {
        // Assume uploadFileClient works for 16:9 images too without severe compression size issues, but compression is fine
        const compressedHeader = await compressImage(routeHeaderFile);
        finalRouteHeader = await uploadFileClient(compressedHeader);
      }
      formData.append('header_16x9', finalRouteHeader);

      formData.append('download_required', String(routeDownloadRequired));
      if (routeFinalQuiz) {
        formData.append('final_quiz', JSON.stringify(routeFinalQuiz));
      }

      let res;
      if (editingRoute) {
        res = await updateRoute(editingRoute.id, formData);
      } else {
        res = await createRoute(formData);
      }

      if (res.success) {
        alert('Ruta guardada!');
        if (!editingRoute) resetRouteForm();
        const updated = await getAdminLegends();
        setLegends(updated as any);
      } else {
        alert("Error: " + res.error);
      }
    } catch (error: any) {
      alert("Error: " + error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleTranslateRouteDirect(routeId: string) {
    setTranslatingRouteId(routeId);
    try {
      const res = await translateRouteAction(routeId);
      if (res.success) {
        alert('Traduccions de la ruta (es, en, fr) generades amb èxit!');
        const updated = await getAdminLegends();
        setLegends(updated as any);
      } else {
        alert("Error traduint la ruta: " + res.error);
      }
    } catch (error: any) {
      alert("Error: " + error.message);
    } finally {
      setTranslatingRouteId(null);
    }
  }

  async function handleDeleteRoute(id: string) {
    if (!confirm('Estàs segur que vols esborrar aquesta ruta? Aquesta acció no es pot desfer.')) return;
    setIsLoading(true);
    try {
      const res = await deleteLegend(id);
      if (res.success) {
        alert('Ruta esborrada correctament.');
        const updated = await getAdminLegends();
        setLegends(updated as any);
      } else {
        alert("Error: " + res.error);
      }
    } catch (error: any) {
      alert("Error: " + error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSavePoi(formData: FormData) {
    setIsLoading(true);
    try {
      let res;
      if (editingPoi) {
        res = await updatePoi(editingPoi.id, formData);
      } else {
        res = await createPoi(formData);
      }

      if (res.success) {
        alert(editingPoi ? 'Punt actualitzat!' : 'Punt guardat correctament!');
        setEditingPoi(null);
        const updated = await getAdminLegends();
        setLegends(updated as any);
      } else {
        alert("Error: " + res.error);
      }
    } catch (error: any) {
      alert("Error: " + error.message);
    } finally {
      setIsLoading(false);
    }
  }


  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 p-8 font-sans">
      <header
        className={`mb-8 flex flex-col md:flex-row justify-between items-center border ${adminTheme.border} backdrop-blur-md p-8 rounded-3xl gap-6 shadow-sm text-white`}
        style={{ backgroundColor: `${adminTheme.hex}EE` }}
      >
        <div className="flex items-center gap-4">
          {brand?.logoUrl ? (
            <div className={`w-14 h-14 rounded-xl overflow-hidden bg-white shadow-md border ${adminTheme.border} flex items-center justify-center p-2 flex-shrink-0 bg-white transition-transform hover:scale-105`}>
              <img src={brand.logoUrl} alt="Logo Consistori" className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className={`w-14 h-14 rounded-xl overflow-hidden bg-white shadow-sm border ${adminTheme.border} flex items-center justify-center p-2 flex-shrink-0`}>
              <span className="text-2xl">🏛️</span>
            </div>
          )}
          <div>
            <h1 className="text-3xl font-serif text-white tracking-tight">{brand?.name || 'Geocontent Studio'}</h1>
            <p className="text-white/80 font-serif italic">Panell de Control Institucional</p>
          </div>
        </div>

        <nav className={`flex flex-wrap md:flex-nowrap justify-center space-x-2 bg-white/20 p-1.5 rounded-xl border border-white/30 backdrop-blur-sm`}>
          <button
            onClick={() => setActiveTab('rutes')}
            className={`px-5 py-2.5 rounded-lg transition-all duration-300 text-sm font-bold ${activeTab === 'rutes' ? 'bg-white shadow-lg scale-105' : 'text-white hover:bg-white/20'}`}
            style={activeTab === 'rutes' ? { color: adminTheme.hex } : {}}
          >
            Creació de Rutes
          </button>
          <button
            onClick={() => setActiveTab('usuaris')}
            className={`px-5 py-2.5 rounded-lg transition-all duration-300 text-sm font-bold ${activeTab === 'usuaris' ? 'bg-white shadow-lg scale-105' : 'text-white hover:bg-white/20'}`}
            style={activeTab === 'usuaris' ? { color: adminTheme.hex } : {}}
          >
            Gestió d'Usuaris
          </button>
          <button
            onClick={() => setActiveTab('executiu')}
            className={`px-5 py-2.5 rounded-lg transition-all duration-300 text-sm font-bold ${activeTab === 'executiu' ? 'bg-white shadow-lg scale-105' : 'text-white hover:bg-white/20'}`}
            style={activeTab === 'executiu' ? { color: adminTheme.hex } : {}}
          >
            Informe Executiu
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`px-5 py-2.5 rounded-lg transition-all duration-300 text-sm font-bold ${activeTab === 'config' ? 'bg-white shadow-lg scale-105' : 'text-white hover:bg-white/20'}`}
            style={activeTab === 'config' ? { color: adminTheme.hex } : {}}
          >
            Configuració
          </button>
        </nav>
      </header>

      <main className="animate-in fade-in duration-500">
        {activeTab === 'rutes' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

              <Card className="border-stone-200 shadow-sm bg-white h-full">
                <CardHeader className="bg-stone-50/50 border-b border-stone-100 pb-4">
                  <CardTitle className="font-serif text-xl text-stone-800 flex items-center gap-2">
                    1. Analista Documental (IA)
                  </CardTitle>
                  <p className="text-sm text-stone-500">Puja documents per extraure informació de referència.</p>
                </CardHeader>
                <CardContent className="p-6">
                  <AiRouteGenerator theme={adminTheme} />
                </CardContent>
              </Card>

              <Card className="border-stone-200 shadow-sm bg-white h-full overflow-hidden">
                <CardHeader className="bg-stone-50/50 border-b border-stone-100 pb-4">
                  <CardTitle className="font-serif text-xl text-stone-800 flex items-center gap-2">
                    2. Gestió de Carpeta i Punts
                  </CardTitle>
                  <p className="text-sm text-stone-500">Omple les dades manualment basant-te en la IA.</p>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="p-6 border-b border-stone-100 bg-stone-50/30">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-stone-700 uppercase tracking-wider">Metadata de la Ruta (Carpeta)</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isTranslatingRouteForm || !routeTitle}
                        onClick={handleTranslateRouteForm}
                        className="border-purple-300 text-purple-700 hover:bg-purple-50 flex items-center gap-1.5 h-8 text-xs font-bold"
                      >
                        {isTranslatingRouteForm ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-purple-600 fill-purple-200" />
                        )}
                        {isTranslatingRouteForm ? "Traduint..." : "Traduir Ruta (IA)"}
                      </Button>
                    </div>

                    {(Object.keys(routeNameTranslations).length > 0 || Object.keys(routeDescriptionTranslations).length > 0) && (
                      <div className="mb-4 p-2.5 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-between text-xs text-purple-800 font-medium animate-in fade-in">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-purple-600 flex-shrink-0" />
                          <span>Traduccions de la ruta preparades (es, en, fr)</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 font-bold text-purple-700 uppercase">
                          {Object.keys(routeNameTranslations).length} idiomes
                        </span>
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="routeTitle">Nom de la Ruta</Label>
                        <Input id="routeTitle" value={routeTitle} onChange={(e) => setRouteTitle(e.target.value)} placeholder="Ex: Ruta de l'Ecomuseu" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="routeDescription">Descripció</Label>
                        <Textarea id="routeDescription" value={routeDescription} onChange={(e) => setRouteDescription(e.target.value)} placeholder="Escriu una breu descripció de la ruta..." />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="routeLocation">Localització (Municipi/Poble)</Label>
                        <Input id="routeLocation" value={routeLocation} onChange={(e) => setRouteLocation(e.target.value)} placeholder="Ex: Sort" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="routeThumb" className="flex items-center justify-between text-stone-600">
                          <div className="flex items-center gap-2">
                            <ImageIcon className="w-4 h-4" />
                            Portada de Carpeta (1x1)
                          </div>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold uppercase">Upload Recomanat</span>
                        </Label>
                        {routeThumbnail && !routeThumbFile && (
                          <div className="mb-1 w-16 h-16 rounded-md overflow-hidden border border-stone-200">
                            <img src={routeThumbnail} alt="Portada 1x1" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setRouteThumbFile(file);
                            }
                          }}
                          className="cursor-pointer"
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-stone-400">O URL:</span>
                          <Input id="routeThumb" value={routeThumbnail} onChange={(e) => setRouteThumbnail(e.target.value)} placeholder="URL imatge" className="h-8 text-xs" />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="routeHeader" className="text-xs font-bold text-stone-600 flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <MonitorPlay className="w-3.5 h-3.5 text-stone-400" />
                            Imatge de Capçalera (16:9)
                          </div>
                        </Label>
                        {routeHeader && !routeHeaderFile && (
                          <div className="mb-1 w-32 h-18 aspect-video rounded-md overflow-hidden border border-stone-200">
                            <img src={routeHeader} alt="Capçalera 16:9" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setRouteHeaderFile(file);
                            }
                          }}
                          className="cursor-pointer"
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-stone-400">O URL:</span>
                          <Input id="routeHeader" value={routeHeader} onChange={(e) => setRouteHeader(e.target.value)} placeholder="URL imatge panoràmica" className="h-8 text-xs" />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 py-2">
                        <input
                          type="checkbox"
                          id="routeDownloadRequired"
                          checked={routeDownloadRequired}
                          onChange={(e) => setRouteDownloadRequired(e.target.checked)}
                          className="w-4 h-4 rounded border-stone-300 text-stone-800 focus:ring-stone-900"
                        />
                        <Label htmlFor="routeDownloadRequired" className="text-xs font-bold text-stone-600 mb-0 cursor-pointer">
                          ⚠️ Baixada Recomanada (Manca Cobertura)
                        </Label>
                      </div>

                      {editingRoute && managingRoute && (
                        <div className="mt-2 p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="flex items-center gap-2">
                              <span>🤖</span>
                              Repte Final de Ruta (IA)
                            </Label>
                            {routeFinalQuiz && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setRouteFinalQuiz(null)}
                                className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                Eliminar
                              </Button>
                            )}
                          </div>

                          {routeFinalQuiz ? (
                            <div className="bg-white/80 p-3 rounded-lg border border-primary/10 text-xs space-y-3">
                              <p className="text-stone-500 italic">S'han generat múltiples preguntes per al repte final.</p>
                              {routeFinalQuiz.preguntes?.map((q: any, i: number) => (
                                <div key={i} className="space-y-1">
                                  <p className="font-bold text-primary">{i + 1}. {q.pregunta}</p>
                                  <ul className="list-disc list-inside text-stone-600">
                                    {q.opcions.map((o: string, idx: number) => (
                                      <li key={idx} className={idx === q.correcta ? "text-green-600 font-bold" : ""}>
                                        {o} {idx === q.correcta && "✓"}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[10px] text-stone-500 italic">No hi ha repte final generat per aquesta ruta.</p>
                          )}

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isGeneratingRouteQuiz || !managingRoute?.pois || managingRoute.pois.length === 0}
                            onClick={async () => {
                              if (!managingRoute?.pois) return;
                              setIsGeneratingRouteQuiz(true);
                              try {
                                const poisData = managingRoute.pois.map((p: any) => ({
                                  title: p.title,
                                  content: p.textContent || p.description || ''
                                }));
                                const res = await fetch('/api/ai/generate-route-quiz', {
                                  method: 'POST',
                                  body: JSON.stringify({ title: routeTitle, pois: poisData })
                                });
                                const data = await res.json();
                                if (data.quiz && data.quiz.preguntes) setRouteFinalQuiz(data.quiz);
                                else alert(data.error || "No s'ha pogut generar el quiz");
                              } catch (e) {
                                console.error("Error generant repte final:", e);
                              } finally {
                                setIsGeneratingRouteQuiz(false);
                              }
                            }}
                            className="w-full h-8 text-xs border-primary/30 text-primary hover:bg-primary/10"
                          >
                            {isGeneratingRouteQuiz ? (
                              <>Generant...</>
                            ) : (
                              <>{routeFinalQuiz ? "Regenerar Repte Final amb IA" : "Generar Repte Final amb IA"}</>
                            )}
                          </Button>
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <Button onClick={handleSaveRoute} disabled={isLoading} size="sm" className={`w-fit ${adminTheme.primary} ${adminTheme.hover} text-white`}>
                          {editingRoute ? 'Actualitzar Ruta' : 'Crear Ruta'}
                        </Button>
                        {editingRoute && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={translatingRouteId === editingRoute.id}
                            onClick={() => handleTranslateRouteDirect(editingRoute.id)}
                            className="border-purple-300 text-purple-700 hover:bg-purple-50 flex items-center gap-1.5"
                          >
                            {translatingRouteId === editingRoute.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Globe className="w-3.5 h-3.5 text-purple-600" />
                            )}
                            {translatingRouteId === editingRoute.id ? "Traduint..." : "Traduir Ruta (IA)"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    <h3 className="text-sm font-bold text-stone-700 uppercase tracking-wider">
                      {editingPoi ? (
                        <span className="flex items-center gap-2">
                          ✏️ Editant: <span className={`${adminTheme.mainText} normal-case font-normal`}>{editingPoi.title}</span>
                        </span>
                      ) : 'Editor de Punts'}
                      {!editingPoi && managingRoute && (
                        <span className={`ml-2 text-[10px] font-normal ${adminTheme.mainText} normal-case`}>
                          → assignant a "{managingRoute.name}"
                        </span>
                      )}
                    </h3>
                    <ManualPoiForm
                      key={editingPoi?.id ?? (managingRoute?.id ?? 'new')}
                      poi={editingPoi ?? null}
                      onSave={handleSavePoi}
                      onCancel={resetRouteForm}
                      isLoading={isLoading}
                      routes={legends}
                      defaultRouteId={managingRoute?.id ?? (editingLegend?.id ?? undefined)}
                      municipalityTheme={brand?.themeId || municipalityTheme}
                    />

                    {editingLegend && (
                      <div className="pt-6 border-t border-stone-100">
                        <Label className="mb-4 block text-stone-800 font-bold">Consola de Vídeo HLS (Extra)</Label>
                        <VideoUploader poiId={editingLegend.id} theme={adminTheme} />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {managingRoute && (
              <RoutePoiManager
                routeId={managingRoute.id}
                routeName={managingRoute.name}
                onClose={() => setManagingRoute(null)}
                theme={adminTheme}
                onEditPoi={(poi) => {
                  setEditingPoi(poi);
                  setEditingLegend(null);
                }}
              />
            )}

            <Card className="border-stone-200 shadow-sm bg-white">
              <CardHeader>
                <CardTitle className="font-serif text-xl text-stone-800">Llistat de Rutes Existents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border border-stone-200">
                  <table className="w-full text-sm">
                    <thead className="bg-stone-50 text-stone-700">
                      <tr className="text-left border-b border-stone-200">
                        <th className="p-4 font-medium font-serif">Títol</th>
                        <th className="p-4 font-medium font-serif text-right">Accions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {legends?.map((legend: any) => (
                        <tr key={legend.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                          <td className="p-4 font-medium text-stone-800">{legend.title}</td>
                          <td className="p-4 text-right space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingRoute(legend);
                                setManagingRoute(legend);
                                setEditingLegend(null);
                                setEditingPoi(null);
                              }}
                            >
                              Editar Ruta
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setManagingRoute(legend);
                                setEditingRoute(null);
                                setEditingPoi(null);
                                setEditingLegend(null);
                              }}
                            >
                              Gestionar Punts
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDeleteRoute(legend.id)}
                            >
                              Borrar
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'usuaris' && (
          <div className="animate-in fade-in duration-500">
            <UsersTable profiles={profiles} theme={adminTheme} />
          </div>
        )}

        {activeTab === 'executiu' && (
          <div className="animate-in fade-in duration-500">
            <ExecutiveReport
              municipalityId={municipalityId || 'null'}
              theme={adminTheme}
              reports={reports}
            />
          </div>
        )}

        {activeTab === 'config' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <MunicipalityManager municipalityId={municipalityId || ''} />
            <S3Maintenance municipalityTheme={brand?.themeId || municipalityTheme} />
          </div>
        )}
      </main>
    </div>
  );
}

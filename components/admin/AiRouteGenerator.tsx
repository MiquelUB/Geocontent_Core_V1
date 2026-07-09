'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, FileText, UploadCloud, AlertCircle, Download } from "lucide-react";
import { generateRouteFromDocumentAction } from '@/lib/actions/ai';

export default function AiRouteGenerator({ theme }: { theme?: any }) {
  const activeTheme = theme || {
    text: "text-[#2D4636]",
    mainText: "text-[#2D4636]/80",
    bg: "bg-[#2D4636]/10",
    bgSoft: "bg-[#2D4636]/5",
    border: "border-[#2D4636]/20",
    ring: "ring-[#2D4636]/20",
    primary: "bg-[#2D4636]",
    hover: "hover:bg-[#1E2F24]",
    fileBg: "file:bg-[#2D4636]/10",
    fileText: "file:text-[#2D4636]",
    fileHover: "hover:file:bg-[#2D4636]/20"
  };
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      const isPdf = selectedFile.type === 'application/pdf';
      const isTxt = selectedFile.type === 'text/plain';
      const isMd = selectedFile.type === 'text/markdown' || selectedFile.name.toLowerCase().endsWith('.md');
      
      if (!isPdf && !isTxt && !isMd) {
        setError("Format invàlid. Només es permeten fitxers PDF, TXT o MD.");
        setFile(null);
        return;
      }
      setError(null);
      setFile(selectedFile);
    }
  };

  async function handleGenerate() {
    console.log("handleGenerate called", file);
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      console.log("Generant ruta via Server Action...");
      const result = await generateRouteFromDocumentAction(formData);

      if (!result.success) {
        throw new Error(result.error || 'Error al servidor generant la ruta');
      }

      console.log("Response data:", result.data);
      setResult(result.data);
      console.log("Set result to:", result.data);

    } catch (err: any) {
      console.error("Error in handleGenerate:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Converts the JSON result object into a human-readable plain-text document
   * that mirrors what the user sees in the card UI.
   */
  function buildTxtContent(data: any): string {
    const lines: string[] = [];

    lines.push(`=== TERRITORI ===`);
    lines.push(`Nom: ${data.territory?.name || '—'}`);
    lines.push(`Context: ${data.territory?.context || '—'}`);
    if (data.territory?.suggested_themes?.length) {
      lines.push(`Temàtiques: ${data.territory.suggested_themes.join(', ')}`);
    }
    lines.push('');

    if (data.notable_figures?.length) {
      lines.push(`=== FIGURES NOTABLES ===`);
      for (const fig of data.notable_figures) {
        lines.push(`• ${fig.name}: ${fig.connection}`);
      }
      lines.push('');
    }

    if (data.pois?.length) {
      lines.push(`=== PUNTS D'INTERÈS (${data.pois.length}) ===`);
      for (const poi of data.pois) {
        lines.push('');
        lines.push(`--- ${poi.title} [${poi.id}] ---`);
        lines.push(`Nucli: ${poi.nucleus || '—'}`);
        lines.push(`Categoria: ${poi.category?.replace('_', ' ') || '—'}`);
        lines.push(`Estat: ${poi.status || '—'}`);
        lines.push(`Període: ${poi.historical_period || 'No consta'}`);
        if (poi.altitude_m) lines.push(`Altitud: ${poi.altitude_m}m`);
        lines.push(`Coordenades: ${poi.coordinates_available ? 'Disponibles' : 'No disponibles'}`);
        lines.push(`Potencial visitant: ${poi.visitor_potential || '—'} — ${poi.visitor_potential_reason || ''}`);
        lines.push('');
        lines.push(`Descripció:`);
        lines.push(poi.description || '—');
        if (poi.unique_facts?.length) {
          lines.push('');
          lines.push(`Fets singulars:`);
          for (const fact of poi.unique_facts) lines.push(`  - ${fact}`);
        }
        if (poi.connections) {
          lines.push('');
          lines.push(`Connexions: ${poi.connections}`);
        }
        if (poi.raw_data_gaps?.length) {
          lines.push('');
          lines.push(`Informació que falta:`);
          for (const gap of poi.raw_data_gaps) {
            lines.push(`  - ${typeof gap === 'string' ? gap : gap.reason || JSON.stringify(gap)}`);
          }
        }
      }
      lines.push('');
    }

    const notes = data.route_building_notes;
    if (notes) {
      lines.push(`=== ESTRATÈGIA DE RUTA ===`);

      if (notes.top_pois?.length) {
        lines.push('');
        lines.push(`Punts Clau (Top 3):`);
        notes.top_pois.forEach((note: any, i: number) => {
          lines.push(`  ${i + 1}. ${typeof note === 'string' ? note : note.reason || JSON.stringify(note)}`);
        });
      }

      if (notes.suggested_combinations?.length) {
        lines.push('');
        lines.push(`Combinacions Temàtiques:`);
        for (const comb of notes.suggested_combinations) {
          lines.push(`  Tema: ${comb.theme}`);
          lines.push(`  POIs: ${comb.poi_ids?.join(', ') || '—'}`);
          lines.push(`  Perquè: ${comb.rationale}`);
          lines.push('');
        }
      }

      if (notes.not_ready_to_publish?.length) {
        lines.push(`POIs no llestos per publicar:`);
        for (const item of notes.not_ready_to_publish) {
          lines.push(`  - [${item.poi_id}]: ${item.missing}`);
        }
        lines.push('');
      }

      if (notes.accessibility_warnings?.some((w: any) => w !== null)) {
        lines.push(`Advertències d'accés / estat:`);
        for (const warn of notes.accessibility_warnings) {
          if (warn) lines.push(`  • ${typeof warn === 'string' ? warn : warn.reason || JSON.stringify(warn)}`);
        }
      }
    }

    return lines.join('\n');
  }

  function handleDownloadTxt() {
    if (!result) return;
    const txt = buildTxtContent(result);
    const baseName = file?.name.replace(/\.[^/.]+$/, '') || 'dossier';
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}_dossier.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Targeta de Pujada de Fitxers */}
      <Card className="border-stone-200 bg-white">
        <CardHeader className="pb-4">
          <CardTitle className={`flex items-center gap-2 font-serif ${activeTheme.text}`}>
            Analista de Documents
          </CardTitle>
          <CardDescription>
            Puja documentació històrica municipal. El motor d'IA extraurà els punts d'interès i prepararà el guió audiovisual.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed border-stone-300 rounded-lg p-6 flex flex-col items-center justify-center text-center bg-stone-50">
            <UploadCloud className="h-10 w-10 text-stone-400 mb-2" />
            <p className="text-sm text-stone-600 mb-4">Arrossega o selecciona un fitxer (Només PDF, TXT o MD)</p>
            <input
              type="file"
              accept=".pdf, .txt, .md"
              onChange={handleFileChange}
              className={`block w-full text-sm text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold ${activeTheme.fileBg} ${activeTheme.fileText} ${activeTheme.fileHover}`}
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={isLoading || !file}
            className={`w-full ${activeTheme.primary} ${activeTheme.hover} text-white`}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Llegint arxiu i generant Ruta... (10-20s)
              </>
            ) : (
              'Processar Document i Crear Ruta'
            )}
          </Button>

          {error && (
            <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Avís de Seguretat</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Targeta de Resultats (Dossier d'Investigació) */}
      {result && (
        <Card className="border-stone-200 bg-stone-50 shadow-inner animate-in fade-in slide-in-from-bottom-4 duration-700">
          <CardHeader className="flex flex-row items-start justify-between">
            <div className="flex-1">
              <Badge className="mb-2 bg-stone-800 text-stone-100 hover:bg-stone-700">🔍 Dossier d'Investigació</Badge>
              <CardTitle className="font-serif text-2xl text-stone-900">{result.territory?.name || "Territori Analitzat"}</CardTitle>
              <p className="text-sm text-stone-600 mt-2 max-w-2xl border-l-2 border-stone-200 pl-4 py-1 italic">
                {result.territory?.context}
              </p>
              {result.territory?.suggested_themes && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {result.territory.suggested_themes.map((theme: string, i: number) => (
                    <span key={i} className={`text-[10px] font-bold uppercase tracking-wider ${activeTheme.text} ${activeTheme.bg} px-2 py-0.5 rounded border ${activeTheme.border}`}>
                      #{theme}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTxt}
              className="ml-4 border-stone-300 text-stone-500 hover:bg-stone-100"
            >
              <Download className="h-4 w-4 mr-1" />
              Descarregar .txt
            </Button>

          </CardHeader>
          <CardContent className="space-y-8">
            {/* Secció de Personatges */}
            {result.notable_figures && result.notable_figures.length > 0 && (
              <div className="bg-stone-100 p-4 rounded-lg border border-stone-200">
                <h4 className="text-xs font-bold uppercase text-stone-500 mb-3 flex items-center gap-2">
                  👤 Figures Notables
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {result.notable_figures.map((fig: any, i: number) => (
                    <div key={i} className="bg-white p-2 rounded border border-stone-200 text-xs">
                      <span className="font-bold text-stone-800">{fig.name}:</span> {fig.connection}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Punts d'Interès (Fitxes de Treball) */}
            <div className="space-y-4">
              <h4 className="font-bold text-sm uppercase text-stone-800 flex items-center gap-2">
                📂 Fitxes de Patrimoni i Natura ({result.pois?.length || 0})
              </h4>
              <div className="grid grid-cols-1 gap-6">
                {result.pois?.map((poi: any, idx: number) => (
                  <div key={idx} className="bg-white rounded-lg border border-stone-300 shadow-sm overflow-hidden">
                    <div className="bg-stone-50 px-4 py-2 border-b border-stone-200 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-stone-400">[{poi.id || idx}]</span>
                        <h5 className="font-bold text-stone-900">{poi.title}</h5>
                        {poi.nucleus && <Badge variant="secondary" className="text-[9px] h-4 px-1.5">{poi.nucleus}</Badge>}
                      </div>
                      <Badge className="bg-stone-200 text-stone-600 border-none text-[9px] uppercase">
                        {poi.category?.replace('_', ' ')}
                      </Badge>
                    </div>

                    <div className="p-4">
                      <div className="flex flex-wrap gap-4 mb-4 text-[10px] text-stone-500">
                        {poi.historical_period && <span>⏳ {poi.historical_period}</span>}
                        {poi.altitude_m && <span>🏔️ {poi.altitude_m}m</span>}
                        {poi.status && (
                          <span className="bg-stone-100 px-1.5 py-0.5 rounded text-stone-600 font-medium">
                            ESTAT: {poi.status}
                          </span>
                        )}
                        <span>📍 Coordenades: {poi.coordinates_available ? 'Disponibles' : 'null'}</span>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className={`text-[9px] ${poi.visitor_potential === 'alt' ? 'border-green-200 text-green-700' : poi.visitor_potential === 'mitjà' ? 'border-orange-200 text-orange-700' : 'border-stone-200 text-stone-500'}`}>
                            Potencial: {poi.visitor_potential}
                          </Badge>
                          {poi.visitor_potential_reason && (
                            <span className="italic text-[9px] text-stone-400">({poi.visitor_potential_reason})</span>
                          )}
                        </div>
                      </div>

                      <p className="text-sm text-stone-700 leading-relaxed mb-4">{poi.description}</p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <h6 className={`text-[10px] font-bold uppercase ${activeTheme.text}`}>✨ Fets Singulars</h6>
                          <ul className="text-xs text-stone-600 list-disc list-inside space-y-1">
                            {poi.unique_facts?.map((fact: string, i: number) => (
                              <li key={i}>{fact}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="space-y-2">
                          <h6 className="text-[10px] font-bold uppercase text-stone-500">🔗 Connexions</h6>
                          <p className="text-xs text-stone-600 italic">{poi.connections || "Sense connexions detectades."}</p>
                        </div>
                      </div>

                      {poi.raw_data_gaps && poi.raw_data_gaps.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-stone-100 flex items-start gap-2">
                          <AlertCircle className="h-3 w-3 text-orange-400 mt-0.5" />
                          <div className="text-[10px] text-stone-400">
                            <span className="font-bold uppercase mr-2">Gaps d'informació:</span>
                            {poi.raw_data_gaps.map((g: any) => typeof g === 'string' ? g : g.reason || g.id || JSON.stringify(g)).join(', ')}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes de Construcció de Ruta ( v3 Structured ) */}
            {result.route_building_notes && (
              <div className="mt-8 space-y-6">
                <h4 className="text-sm font-bold text-stone-800 uppercase flex items-center gap-2 border-b border-stone-200 pb-2">
                  📝 Estratègia de Ruta per al Gestor
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Top POIs */}
                  {result.route_building_notes.top_pois && (
                    <div className="bg-green-50/50 p-4 rounded-lg border border-green-100">
                      <h5 className="text-[11px] font-bold text-green-800 uppercase mb-3">⭐ Punts Clau (Top 3)</h5>
                      <ul className="space-y-2">
                        {result.route_building_notes.top_pois.map((note: any, i: number) => (
                          <li key={i} className="text-xs text-green-900 leading-snug">
                            {typeof note === 'string' ? note : note.reason || note.id || JSON.stringify(note)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Combinacions Suggerides */}
                  {result.route_building_notes.suggested_combinations && (
                    <div className={`${activeTheme.bgSoft} p-4 rounded-lg border ${activeTheme.border}`}>
                      <h5 className={`text-[11px] font-bold ${activeTheme.text} uppercase mb-3`}>🔗 Rutes Temàtiques</h5>
                      <div className="space-y-3">
                        {result.route_building_notes.suggested_combinations.map((comb: any, i: number) => (
                          <div key={i} className={`bg-white p-2 rounded border ${activeTheme.border}`}>
                            <div className={`font-bold text-[10px] ${activeTheme.text} uppercase mb-1`}>{comb.theme}</div>
                            <div className="text-[9px] text-stone-400 mb-1 flex flex-wrap gap-1">
                              {comb.poi_ids?.map((id: string) => <span key={id} className="bg-stone-50 px-1 rounded">#{id}</span>)}
                            </div>
                            <p className="text-[10px] text-stone-600 italic">"{comb.rationale}"</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Bloquejos de Publicació */}
                  {result.route_building_notes.not_ready_to_publish && result.route_building_notes.not_ready_to_publish.length > 0 && (
                    <div className="bg-red-50/50 p-4 rounded-lg border border-red-100">
                      <h5 className="text-[11px] font-bold text-red-800 uppercase mb-3">⚠️ Bloquejos de Publicació</h5>
                      <ul className="space-y-2">
                        {result.route_building_notes.not_ready_to_publish.map((item: any, i: number) => (
                          <li key={i} className="text-[10px] text-red-900 border-b border-red-100 pb-1 last:border-0">
                            <span className="font-bold">[{item.poi_id}]:</span> {item.missing}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Advertències d'Accessibilitat */}
                  {result.route_building_notes.accessibility_warnings && result.route_building_notes.accessibility_warnings.some((w: any) => w !== null) && (
                    <div className="bg-orange-50/50 p-4 rounded-lg border border-orange-100">
                      <h5 className="text-[11px] font-bold text-orange-800 uppercase mb-3">🚧 Avisos d'Accés / Estat</h5>
                      <ul className="space-y-2">
                        {result.route_building_notes.accessibility_warnings.map((warn: any, i: number) => warn && (
                          <li key={i} className="text-[10px] text-orange-900 flex items-start gap-2">
                            <span>•</span> {typeof warn === 'string' ? warn : warn.reason || warn.id || JSON.stringify(warn)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

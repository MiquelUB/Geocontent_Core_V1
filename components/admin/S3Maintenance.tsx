'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, HardDrive, Trash2, ShieldAlert } from "lucide-react";
import { analyzeS3Orphans, cleanS3Orphans } from "@/lib/actions/maintenance";
import { getAdminTheme } from "@/lib/adminTheme";

export default function S3Maintenance({ municipalityTheme = 'mountain' }: { municipalityTheme?: string }) {
  const activeTheme = getAdminTheme(municipalityTheme);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  async function handleAnalyze() {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    try {
      const res = await analyzeS3Orphans();
      if (res.success) {
        setAnalysisResult(res);
      } else {
        alert("Error analitzant: " + res.error);
      }
    } catch (err: any) {
      alert("Excepció: " + err.message);
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleClean() {
    if (!analysisResult || !analysisResult.orphans || analysisResult.orphans.length === 0) return;
    
    if (!confirm(`Estàs segur d'esborrar definitivament ${analysisResult.count} arxius (${analysisResult.totalSizeMB} MB)?`)) return;

    setIsCleaning(true);
    try {
      const keys = analysisResult.orphans.map((o: any) => o.key);
      const res = await cleanS3Orphans(keys);
      if (res.success) {
        if (res.deleted === 0) {
          alert(res.message || "No s'ha esborrat cap fitxer (podrien estar protegits per la base de dades).");
        } else {
          let msg = `S'han esborrat ${res.deleted} arxius orfes de l'S3 amb èxit.`;
          if (res.failedCount && res.failedCount > 0) {
            msg += ` (${res.failedCount} arxius no s'han pogut esborrar)`;
          }
          alert(msg);
          setAnalysisResult(null);
        }
      } else {
        alert("Error esborrant: " + res.error);
      }
    } catch (err: any) {
      alert("Excepció: " + err.message);
    } finally {
      setIsCleaning(false);
    }
  }

  return (
    <div className="space-y-6 bg-white p-6 rounded-lg shadow-sm border border-stone-200">
      <div>
        <h3 className="text-lg font-bold flex items-center gap-2 text-stone-800">
          <HardDrive className="w-5 h-5" /> 
          Manteniment de l'Emmagatzematge (AWS S3)
        </h3>
        <p className="text-sm text-stone-500 mt-1">
          Aquesta eina rastreja tota la base de dades a la recerca d'imatges i àudios que ja no s'estan utilitzant enlloc (orfes) per tal d'estalviar espai.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Button 
          onClick={handleAnalyze} 
          disabled={isAnalyzing || isCleaning}
          className={`${activeTheme.primary} ${activeTheme.hover} text-white`}
        >
          {isAnalyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldAlert className="w-4 h-4 mr-2" />}
          {isAnalyzing ? 'Analitzant Llista Blanca...' : 'Analitzar Emmagatzematge S3'}
        </Button>
        
        {analysisResult && (
          <div className="text-sm">
            <span className="font-bold text-stone-800">{analysisResult.count} arxius orfes trobats</span> 
            <span className="text-stone-500 ml-1">({analysisResult.totalSizeMB} MB d'escombraries)</span>
          </div>
        )}
      </div>

      {analysisResult && analysisResult.count > 0 && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-md">
          <p className="text-sm text-red-800 mb-3 font-semibold">Es pot alliberar espai. Aquesta acció és irreversible i esborrarà els fitxers de l'AWS S3.</p>
          <Button 
            onClick={handleClean} 
            disabled={isCleaning}
            variant="destructive"
            className="w-full sm:w-auto"
          >
            {isCleaning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
            {isCleaning ? 'Purgant S3...' : `Purgar ${analysisResult.count} arxius orfes`}
          </Button>
        </div>
      )}
    </div>
  );
}

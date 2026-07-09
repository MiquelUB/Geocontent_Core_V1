'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Upload } from "lucide-react";
import { updateMunicipality } from "@/lib/actions/content";
import { getMunicipalities } from "@/lib/actions/queries";
import { uploadFileClient } from "@/lib/upload-client";
import { useRouter } from "next/navigation";

export default function MunicipalityManager({ municipalityId }: { municipalityId?: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [themeId, setThemeId] = useState('mountain');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [adminMasterPassword, setAdminMasterPassword] = useState('');
  const [planTier, setPlanTier] = useState('roure');
  const [extraRoutesCount, setExtraRoutesCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [muniId, setMuniId] = useState(municipalityId || '');

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const munis = await getMunicipalities();
      if (munis && munis.length > 0) {
        const target = muniId ? munis.find(m => m.id === muniId) : munis[0];
        if (target) {
          setName(target.name);
          setLogoUrl((target as any).logoUrl || '');
          setThemeId((target as any).themeId || 'mountain');
          setAdminMasterPassword((target as any).adminMasterPassword || '');
          setPlanTier((target as any).planTier || 'roure');
          setExtraRoutesCount((target as any).extraRoutesCount || 0);
          setMuniId(target.id);
        }
      }
      setIsLoading(false);
    }
    load();
  }, [muniId]);

  async function handleSave() {
    if (!muniId || !name) return;
    setIsSaving(true);

    let finalLogoUrl = logoUrl;
    if (logoFile) {
      try {
        const up = await uploadFileClient(logoFile);
        if (up) finalLogoUrl = up;
      } catch (err: any) {
        alert("Error pujant la imatge: " + err.message);
        setIsSaving(false);
        return;
      }
    }

    console.log('>>> [CLIENT] Calling API with:', { id: muniId, name, logoUrl: finalLogoUrl, themeId });

    // Use Server Action explicitly to comply with GEMINI.md (Server Actions com a única capa de mutació client)
    let res: any;
    try {
      res = await updateMunicipality(muniId, name, finalLogoUrl, themeId, adminMasterPassword, planTier, extraRoutesCount);
    } catch (e: any) {
      res = { success: false, error: 'Excepció cridant la Server Action', details: e.message };
    }

    console.log('>>> [CLIENT] Received response:', res);

    if (res && (res as any).success) {
      alert('Configuració de Marca Blanca actualitzada!');
      if (finalLogoUrl) setLogoUrl(finalLogoUrl);
      setLogoFile(null);
      router.refresh();
    } else {
      console.error('>>> [CLIENT] Save failed:', res);
      const errorMsg = (res as any)?.error || 'Unknown error during save';
      alert('Error: ' + errorMsg + '\n\nFull response: ' + JSON.stringify(res));
    }
    setIsSaving(false);
  }

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4">
        <Label>Logo de la Marca Blanca</Label>
        <div className="flex items-center gap-4">
          {logoUrl && (
            <div className="w-16 h-16 rounded-md overflow-hidden bg-stone-100 border border-stone-200">
              <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
            </div>
          )}
          <div className="flex-1">
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
              className="cursor-pointer"
            />
          </div>
        </div>
        <p className="text-[10px] text-stone-400 italic">Puja el logo oficial (PNG o SVG preferiblement).</p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="muniName">Nom de l'Entitat / Marca Blanca</Label>
        <Input
          id="muniName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Ajuntament de Sort"
        />
        <p className="text-[10px] text-stone-400 italic">Aquest és el nom principal de l'aplicació.</p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="globalTheme">Temàtica Visual de l'App (Pell)</Label>
        <select
          id="globalTheme"
          value={themeId}
          onChange={(e) => setThemeId(e.target.value)}
          className="flex h-10 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-950 focus-visible:ring-offset-2"
        >
          <option value="mountain">Muntanya (Verd)</option>
          <option value="coast">Costa (Blau)</option>
          <option value="city">Ciutat (Gris)</option>
          <option value="interior">Interior (Marró)</option>
          <option value="bloom">Floració (Rosa)</option>
        </select>
        <p className="text-[10px] text-stone-400 italic">Aquesta temàtica s'aplicarà a tota l'experiència de l'usuari.</p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="adminPass">Contrasenya Mestra (Consistori)</Label>
        <Input
          id="adminPass"
          type="password"
          value={adminMasterPassword}
          onChange={(e) => setAdminMasterPassword(e.target.value)}
          placeholder="Clau mestra per l'admin"
        />
        <p className="text-[10px] text-stone-400 italic">Aquesta contrasenya serà la que facin servir al consistori.</p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="planTier">Pla de Subscripció</Label>
        <select
          id="planTier"
          value={planTier}
          onChange={(e) => setPlanTier(e.target.value)}
          className="flex h-10 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-950 focus-visible:ring-offset-2"
        >
          <option value="roure">Pla Roure (5 Rutes / 10 POIs per ruta)</option>
          <option value="mirador">Pla Mirador (10 Rutes / 20 POIs per ruta)</option>
          <option value="enterprise">Pla Enterprise (Ilimitat)</option>
        </select>
        <p className="text-[10px] text-stone-400 italic">Especificacions segons la Hoja de Ruta Estratégica.</p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="extraRoutes">Add-ons de Rutes Extras (+500€/any cadascuna)</Label>
        <Input
          id="extraRoutes"
          type="number"
          min="0"
          value={extraRoutesCount}
          onChange={(e) => setExtraRoutesCount(parseInt(e.target.value) || 0)}
        />
        <p className="text-[10px] text-stone-400 italic">Cada add-on allibera l'espai per una ruta nova completa.</p>
      </div>

      <Button onClick={handleSave} disabled={isSaving || !name} className="bg-stone-800 text-white hover:bg-stone-900">
        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Guardar Canvis
      </Button>
    </div>
  );
}

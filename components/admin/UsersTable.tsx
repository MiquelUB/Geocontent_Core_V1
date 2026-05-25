'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getUserVisits } from "@/lib/actions/gamification";
import { Download as DownloadIcon } from "lucide-react";

interface UserProfile {
  id: string;
  username: string | null;
  email: string | null; // Note: email might be in User model, not Profile. Need to handle this.
  role: string;
  level: number;
  created_at: string;
}

interface Visit {
  id: string;
  poi: { title: string };
  entryTime: string;
  durationSeconds: number | null;
  rating: number | null;
}

export function UsersTable({ profiles, theme }: { profiles: any[], theme?: any }) {
  const activeTheme = theme || {
    hex: "#2D4636",
    text: "text-[#2D4636]",
    mainText: "text-[#2D4636]/80",
    bg: "bg-[#2D4636]/10",
    primary: "bg-[#2D4636]",
    hover: "hover:bg-[#1E2F24]",
  };
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [isLoadingVisits, setIsLoadingVisits] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleUserClick = async (user: any) => {
    setSelectedUser(user);
    setIsDialogOpen(true);
    setIsLoadingVisits(true);
    setVisits([]);

    try {
      const data = await getUserVisits(user.id);
      setVisits(data);
    } catch (e) {
      console.error("Exception fetching visits:", e);
    } finally {
      setIsLoadingVisits(false);
    }
  };

  const handleExportCSV = () => {
    if (!profiles || profiles.length === 0) return;

    // CSV Header
    const headers = ["Usuari", "Email"];

    // CSV Rows
    const rows = profiles.map(p => [
      `"${(p.username || 'Anonim').replace(/"/g, '""')}"`,
      `"${(p.email || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `usuaris_geocontent_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="border-stone-200 shadow-sm bg-white">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-serif text-xl text-stone-800">Directori d'Usuaris</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCSV}
          className={`flex items-center gap-2 border-stone-200 transition-all hover:shadow-md ${activeTheme.text}`}
        >
          <DownloadIcon className="w-4 h-4" />
          Exportar CSV
        </Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-stone-200">
          <Table>
            <TableHeader className="border-b" style={{ backgroundColor: `${activeTheme.hex}15` }}>
              <TableRow>
                <TableHead className="font-serif text-stone-700">Usuari</TableHead>
                <TableHead className="font-serif text-stone-700">Email</TableHead>
                <TableHead className="font-serif text-stone-700">Nivell</TableHead>
                <TableHead className="font-serif text-stone-700 text-right">Accions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles?.map((profile) => (
                <TableRow key={profile.id} className="hover:bg-stone-50/50 cursor-pointer" onClick={() => handleUserClick(profile)}>
                  <TableCell className="font-medium text-stone-800">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full ${activeTheme.bg} flex items-center justify-center ${activeTheme.text} font-bold text-xs`}>
                        {profile.username?.[0]?.toUpperCase() || 'U'}
                      </div>
                      {profile.username || 'Anònim'}
                    </div>
                  </TableCell>
                  <TableCell className="text-stone-600">{profile.email || '-'}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-800">
                      Lvl {profile.level || 1}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className={`text-xs font-bold ${activeTheme.text} hover:scale-105 transition-transform`} style={{ backgroundColor: `${activeTheme.hex}10` }}>
                      Veure Detalls
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!profiles || profiles.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-stone-500">
                    No s'han trobat usuaris.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] bg-white border-stone-200">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-stone-800">
              Activitat de {selectedUser?.username || 'Usuari'}
            </DialogTitle>
            <DialogDescription className="text-stone-500">
              Historial de visites als Punts d'Interès.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto pr-2">
            {isLoadingVisits ? (
              <div className="py-8 text-center text-stone-400">Carregant historial...</div>
            ) : visits.length > 0 ? (
              <div className="space-y-4">
                {visits.map((visit) => (
                  <div key={visit.id} className="flex items-start justify-between p-4 rounded-lg bg-stone-50 border border-stone-100">
                    <div>
                      <h4 className="font-medium text-stone-800">{visit.poi?.title || 'POI Desconegut'}</h4>
                      <p className="text-xs text-stone-500 mt-1">
                        {new Date(visit.entryTime).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${visit.rating === 5 ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-600'}`}>
                        {visit.rating === 5 ? 'Quiz Superat ✓' : 'Desbloquejat'}
                      </div>
                      {visit.durationSeconds && (
                        <div className={`text-xs ${activeTheme.mainText}`}>
                          ⏱ {Math.floor(visit.durationSeconds / 60)} min
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-stone-400 border-2 border-dashed border-stone-100 rounded-lg">
                Aquest usuari encara no ha visitat cap ruta.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

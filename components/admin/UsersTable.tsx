'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getUserVisits, getUserRouteReviews } from "@/lib/actions/gamification";
import { Download as DownloadIcon, Star, MapPin, MessageSquare, Calendar, X } from "lucide-react";

interface UserProfile {
  id: string;
  username: string | null;
  email: string | null;
  role: string;
  level: number;
  created_at?: string;
  createdAt?: string;
  lastLoginAt?: string | null;
}

interface Visit {
  id: string;
  poi: { title: string };
  entryTime: string;
  durationSeconds: number | null;
  rating: number | null;
}

interface RouteReview {
  id: string;
  routeName: string;
  rating: number;
  comment: string;
  completedAt: string;
}

function formatEuropeanDate(dateStr?: string | Date | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return '—';
  }
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
  const [reviews, setReviews] = useState<RouteReview[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Filtre de període de dates
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const filteredProfiles = (profiles || []).filter((p) => {
    if (!startDate && !endDate) return true;

    const userDateStr = p.lastLoginAt || p.createdAt || p.created_at;
    if (!userDateStr) return false;

    const userDate = new Date(userDateStr);
    if (isNaN(userDate.getTime())) return false;

    const y = userDate.getFullYear();
    const m = String(userDate.getMonth() + 1).padStart(2, '0');
    const d = String(userDate.getDate()).padStart(2, '0');
    const userDateKey = `${y}-${m}-${d}`;

    if (startDate && userDateKey < startDate) return false;
    if (endDate && userDateKey > endDate) return false;

    return true;
  });

  const handleClearFilter = () => {
    setStartDate('');
    setEndDate('');
  };

  const handleUserClick = async (user: any) => {
    setSelectedUser(user);
    setIsDialogOpen(true);
    setIsLoadingDetails(true);
    setVisits([]);
    setReviews([]);

    try {
      const [visitsData, reviewsData] = await Promise.all([
        getUserVisits(user.id),
        getUserRouteReviews(user.id)
      ]);
      setVisits(visitsData);
      setReviews(reviewsData);
    } catch (e) {
      console.error("Exception fetching user details:", e);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleExportCSV = () => {
    if (!filteredProfiles || filteredProfiles.length === 0) return;

    // CSV Header (només Nom i Email)
    const headers = ["Nom", "Email"];

    // CSV Rows
    const rows = filteredProfiles.map(p => [
      `"${(p.username || 'Anonim').replace(/"/g, '""')}"`,
      `"${(p.email || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const dateSuffix = startDate || endDate ? `_${startDate || 'inici'}_a_${endDate || 'avui'}` : `_${new Date().toISOString().split('T')[0]}`;
    link.setAttribute("download", `usuaris${dateSuffix}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="border-stone-200 shadow-sm bg-white">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
        <div>
          <CardTitle className="font-serif text-xl text-stone-800">Directori d'Usuaris</CardTitle>
          <p className="text-xs text-stone-500 mt-1">
            Total: {profiles?.length || 0} usuaris {filteredProfiles.length !== (profiles?.length || 0) && `(Filtrats: ${filteredProfiles.length})`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCSV}
          disabled={filteredProfiles.length === 0}
          className={`flex items-center gap-2 border-stone-200 transition-all hover:shadow-md ${activeTheme.text}`}
        >
          <DownloadIcon className="w-4 h-4" />
          Exportar CSV ({filteredProfiles.length})
        </Button>
      </CardHeader>

      {/* Selector de Període de Dates */}
      <div className="px-6 py-3 bg-stone-50/80 border-y border-stone-200 flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5 font-medium text-stone-700">
          <Calendar className="w-4 h-4 text-stone-500" />
          <span>Consultar per període:</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-stone-500 font-medium">Des de:</label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-8 w-36 bg-white text-xs text-stone-800 border-stone-300"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-stone-500 font-medium">Fins a:</label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-8 w-36 bg-white text-xs text-stone-800 border-stone-300"
          />
        </div>
        {(startDate || endDate) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilter}
            className="h-8 px-2 text-xs text-stone-500 hover:text-stone-800 hover:bg-stone-200/60"
          >
            <X className="w-3.5 h-3.5 mr-1" />
            Netejar filtre
          </Button>
        )}
      </div>

      <CardContent className="pt-6">
        <div className="rounded-md border border-stone-200">
          <Table>
            <TableHeader className="border-b" style={{ backgroundColor: `${activeTheme.hex}15` }}>
              <TableRow>
                <TableHead className="font-serif text-stone-700">Usuari</TableHead>
                <TableHead className="font-serif text-stone-700">Email</TableHead>
                <TableHead className="font-serif text-stone-700">Últim Login</TableHead>
                <TableHead className="font-serif text-stone-700">Nivell</TableHead>
                <TableHead className="font-serif text-stone-700 text-right">Accions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProfiles?.map((profile) => (
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
                  <TableCell className="text-stone-600 text-xs font-mono">
                    {formatEuropeanDate(profile.lastLoginAt || profile.createdAt || profile.created_at)}
                  </TableCell>
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
              {(!filteredProfiles || filteredProfiles.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-stone-500">
                    No s'han trobat usuaris per al període seleccionat.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[650px] bg-white border-stone-200">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-stone-800">
              Detalls de {selectedUser?.username || 'Usuari'}
            </DialogTitle>
            <DialogDescription className="text-stone-500">
              Valoracions, comentaris de rutes i historial de visites.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[65vh] overflow-y-auto pr-2 space-y-6">
            {isLoadingDetails ? (
              <div className="py-8 text-center text-stone-400">Carregant detalls d'activitat...</div>
            ) : (
              <>
                {/* Secció 1: Valoracions i Comentaris de Rutes */}
                <div>
                  <h3 className="font-serif text-base font-bold text-stone-800 mb-3 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-amber-500" />
                    Valoracions i Comentaris de Rutes
                  </h3>
                  {reviews.length > 0 ? (
                    <div className="space-y-3">
                      {reviews.map((rev) => (
                        <div key={rev.id} className="p-3.5 rounded-xl bg-amber-50/40 border border-amber-200/50 shadow-sm">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-serif font-bold text-stone-800 text-sm">{rev.routeName}</h4>
                            <div className="flex items-center gap-1 bg-amber-100/80 px-2 py-0.5 rounded-full text-amber-800 text-xs font-bold">
                              <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                              <span>{rev.rating} / 5</span>
                            </div>
                          </div>
                          {rev.comment ? (
                            <p className="text-xs text-stone-700 italic bg-white/80 p-2.5 rounded-lg border border-amber-100 mt-2">
                              &ldquo;{rev.comment}&rdquo;
                            </p>
                          ) : (
                            <p className="text-[11px] text-stone-400 italic mt-1">Sense comentari escrit</p>
                          )}
                          <p className="text-[10px] text-stone-400 text-right mt-1.5">
                            {formatEuropeanDate(rev.completedAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-4 px-4 text-center text-xs text-stone-400 bg-stone-50 border border-dashed border-stone-200 rounded-lg">
                      L'usuari encara no ha deixat cap valoració ni comentari de ruta.
                    </div>
                  )}
                </div>

                {/* Secció 2: Historial de Visites a POIs */}
                <div>
                  <h3 className="font-serif text-base font-bold text-stone-800 mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-stone-600" />
                    Historial de Punts d'Interès (POIs)
                  </h3>
                  {visits.length > 0 ? (
                    <div className="space-y-3">
                      {visits.map((visit) => (
                        <div key={visit.id} className="flex items-start justify-between p-3.5 rounded-lg bg-stone-50 border border-stone-100">
                          <div>
                            <h4 className="font-medium text-stone-800 text-sm">{visit.poi?.title || 'POI Desconegut'}</h4>
                            <p className="text-xs text-stone-500 mt-0.5">
                              {formatEuropeanDate(visit.entryTime)}
                            </p>
                          </div>
                          <div className="text-right flex flex-col items-end gap-1">
                            <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${visit.rating === 5 ? 'bg-primary/10 text-primary' : 'bg-stone-100 text-stone-600'}`}>
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
                    <div className="py-4 px-4 text-center text-xs text-stone-400 border border-dashed border-stone-200 rounded-lg">
                      No hi ha visites a POIs registrades.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getUserVisits, getUserRouteReviews } from "@/lib/actions/gamification";
import { Download as DownloadIcon, Star, MapPin, MessageSquare } from "lucide-react";

interface UserProfile {
  id: string;
  username: string | null;
  email: string | null;
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

interface RouteReview {
  id: string;
  routeName: string;
  rating: number;
  comment: string;
  completedAt: string;
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
                            {new Date(rev.completedAt).toLocaleString()}
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

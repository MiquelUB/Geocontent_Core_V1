'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatsCard } from "@/components/ui/StatsCard";
import { Users, Clock, Map as MapIcon, TrendingUp, TrendingDown, Sparkles, Star, MessageSquare } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';
import MapLibreMap from "@/components/map/MapLibreMap";
import { Marker } from 'react-map-gl/maplibre';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar, Download, RefreshCw, FileCheck, AlertCircle, Info } from "lucide-react";
import { generateReport } from '@/lib/actions/reports';
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from 'motion/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { deleteReport } from '@/lib/actions/reports';
import { Trash2 } from "lucide-react";

interface ExecutiveReportProps {
    municipalityId: string;
    theme?: any;
    reports?: any[];
}

export default function ExecutiveReport({ municipalityId, theme, reports: initialReports = [] }: ExecutiveReportProps) {
    const activeTheme = theme || {
        hex: "#2D4636",
        text: "text-[#2D4636]",
        mainText: "text-[#2D4636]/80",
        bg: "bg-[#2D4636]/10",
        bgSoft: "bg-[#2D4636]/5",
        border: "border-[#2D4636]/20",
        primary: "bg-[#2D4636]",
        hover: "hover:bg-[#1E2F24]",
        chartColors: ["#2D4636", "#43614F", "#5D7A68"]
    };

    const router = useRouter();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [reports, setReports] = useState(initialReports || []);
    const [selectedReports, setSelectedReports] = useState<string[]>([]);
    const [isDeleting, setIsDeleting] = useState(false);

    // Keep reports in sync with props from the server
    useEffect(() => {
        setReports(initialReports || []);
    }, [initialReports]);

    // Polling effect: Refresh data every 5s if there are pending/processing reports
    useEffect(() => {
        const hasActiveJobs = reports.some(r => r.status === 'PENDING' || r.status === 'PROCESSING');

        if (hasActiveJobs) {
            const interval = setInterval(() => {
                router.refresh();
            }, 5000);
            return () => clearInterval(interval);
        }
    }, [reports, router]);

    // Filters
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [period, setPeriod] = useState('month'); // 'week', 'month', 'year', 'custom'

    // Update dates when period changes
    useEffect(() => {
        const end = new Date();
        let start = new Date();

        if (period === 'day') {
            start.setHours(0, 0, 0, 0);
        } else if (period === 'week') {
            start.setDate(end.getDate() - 7);
        } else if (period === 'month') {
            start.setMonth(end.getMonth() - 1);
        } else if (period === 'year') {
            start.setFullYear(end.getFullYear() - 1);
        } else {
            return; // Custom is handled by inputs
        }

        setStartDate(start.toISOString().split('T')[0]);
        setEndDate(end.toISOString().split('T')[0]);
    }, [period]);

    const fetchData = async () => {
        if (!municipalityId || municipalityId === 'null') {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`/api/analytics/executive-report?municipalityId=${municipalityId}&startDate=${startDate}&endDate=${endDate}`);
            const json = await res.json();
            if (json.success) setData(json.data);
        } catch (e) {
            console.error("Failed to load report", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [municipalityId, startDate, endDate]);

    const handleGenerateReport = async () => {
        if (!municipalityId || municipalityId === 'null') {
            toast.error("Municipi no vàlid.");
            return;
        }
        setGenerating(true);
        try {
            const res = await generateReport(municipalityId);
            if (res.success) {
                toast.success("Informe en cua de generació.");
                router.refresh(); // Trigger server refresh for initialReports
            } else {
                toast.error(res.error || "Error al generar l'informe");
            }
        } catch (e) {
            console.error("Generate error", e);
            toast.error("Error de connexió");
        } finally {
            setGenerating(false);
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedReports.length === 0) return;
        if (!confirm(`Segur que vols eliminar ${selectedReports.length} informe(s)?`)) return;

        setIsDeleting(true);
        try {
            for (const id of selectedReports) {
                await deleteReport(id);
            }
            toast.success("Informes eliminats correctament");
            setSelectedReports([]);
            router.refresh();
        } catch (e) {
            toast.error("Error al eliminar informes");
        } finally {
            setIsDeleting(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground">Carregant Informe Executiu...</div>;
    if (!data) return <div className="p-8 text-center text-red-500">Error carregant dades.</div>;

    const metrics = data.metrics || {
        users: { value: 0, active: 0, change: 0 },
        abandonmentRate: { value: 0 },
        routesCompleted: { value: 0 },
        quizStats: { value: 0, solved: 0, total: 0, details: [] },
        ratingStats: { average: 0, totalCount: 0, details: [] }
    };
    const routeCompletions = data.routeCompletions || [];
    const aiInsights = data.aiInsights || "No hi ha conclusions disponibles.";
    const heatmap = data.heatmap || [];
    const municipalityPois = data.pois || [];

    const getChangeBadge = (change: number) => {
        if (change === 0) return null;
        const isPositive = change >= 0;
        return (
            <span className={`text-xs ml-2 font-medium ${isPositive ? 'text-green-600' : 'text-red-600'} flex items-center inline-flex`}>
                {isPositive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                {Math.abs(change)}% vs mes anterior
            </span>
        );
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
        >

            {/* Header amb Filtres i Accions */}
            <div className={`flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 ${activeTheme.bgSoft} p-6 rounded-2xl border ${activeTheme.border} shadow-sm backdrop-blur-sm`}>
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full lg:w-auto">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Període d'Anàlisi</label>
                        <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-stone-200 shadow-sm">
                            <button
                                onClick={() => setPeriod('day')}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${period === 'day' ? `text-white shadow-md scale-105` : 'text-stone-600 hover:bg-stone-50'}`}
                                style={period === 'day' ? { backgroundColor: activeTheme.hex } : {}}
                            >
                                Avui
                            </button>
                            <button
                                onClick={() => setPeriod('week')}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${period === 'week' ? `text-white shadow-md scale-105` : 'text-stone-600 hover:bg-stone-50'}`}
                                style={period === 'week' ? { backgroundColor: activeTheme.hex } : {}}
                            >
                                Setmana
                            </button>
                            <button
                                onClick={() => setPeriod('month')}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${period === 'month' ? `text-white shadow-md scale-105` : 'text-stone-600 hover:bg-stone-50'}`}
                                style={period === 'month' ? { backgroundColor: activeTheme.hex } : {}}
                            >
                                Mes
                            </button>
                            <button
                                onClick={() => setPeriod('year')}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${period === 'year' ? `text-white shadow-md scale-105` : 'text-stone-600 hover:bg-stone-50'}`}
                                style={period === 'year' ? { backgroundColor: activeTheme.hex } : {}}
                            >
                                Any
                            </button>
                        </div>
                    </div>

                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchData}
                        className="h-10 border-stone-200 bg-white"
                        style={{ color: activeTheme.hex }}
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refrescar
                    </Button>
                    <Button
                        onClick={handleGenerateReport}
                        disabled={generating}
                        className="h-10 text-white shadow-md shadow-primary/10 transition-all hover:translate-y-[-1px] active:translate-y-[0]"
                        style={{ backgroundColor: activeTheme.hex }}
                    >
                        <Sparkles className="w-4 h-4 mr-2" />
                        {generating ? "Generant..." : "Generar Informe IA"}
                    </Button>
                </div>
            </div>

            {/* 1. KPI CARDS */}
            <motion.div
                initial="hidden"
                animate="visible"
                variants={{
                    visible: { transition: { staggerChildren: 0.1 } }
                }}
                className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4"
            >
                <motion.div variants={{ hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1 } }}>
                    <StatsCard
                        title="Usuaris Totals"
                        description={<>
                            <span className="text-2xl font-bold">{metrics.users.value}</span>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-[10px] font-normal border-stone-200">
                                    {metrics.users.active} actius
                                </Badge>
                                {getChangeBadge(metrics.users.change)}
                            </div>
                        </>}
                        icon={<Users className={`w-6 h-6 ${activeTheme.mainText}`} />}
                    />
                </motion.div>

                {/* KPI 2: Valoració i Reseñes de Visitants */}
                <motion.div variants={{ hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1 } }}>
                    <Dialog>
                        <DialogTrigger asChild>
                            <div className="cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]">
                                <StatsCard
                                    title="Valoració Visitants"
                                    description={<>
                                        <div className="flex items-baseline gap-1.5">
                                            <span className="text-2xl font-bold text-amber-600">{metrics.ratingStats?.average || 0}</span>
                                            <Star className="w-5 h-5 fill-amber-500 text-amber-500 inline" />
                                        </div>
                                        <div className="mt-1 text-[10px] text-stone-500 font-bold flex items-center justify-between">
                                            <span>{metrics.ratingStats?.totalCount || 0} valoracions</span>
                                            <span className="text-primary font-bold">Veure opinions →</span>
                                        </div>
                                    </>}
                                    icon={<Star className={`w-6 h-6 text-amber-500 fill-amber-500`} />}
                                />
                            </div>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[650px] bg-white border-stone-200">
                            <DialogHeader>
                                <DialogTitle className="font-serif text-2xl text-stone-800 flex items-center gap-2">
                                    <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
                                    Opinions i Valoracions dels Usuaris
                                </DialogTitle>
                                <DialogDescription className="text-stone-500">
                                    Puntuacions en estrelles i ressenyes escrites pels visitants a les rutes del municipi.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="max-h-[60vh] overflow-y-auto pr-2 mt-4 space-y-3">
                                {metrics.ratingStats?.details?.map((item: any, i: number) => (
                                    <div key={i} className="p-4 rounded-xl border border-amber-200/60 bg-amber-50/40 shadow-sm space-y-1.5">
                                        <div className="flex justify-between items-center">
                                            <span className="font-serif font-bold text-stone-800 text-sm">{item.routeName}</span>
                                            <div className="flex items-center gap-1 bg-amber-100 px-2 py-0.5 rounded-full text-amber-800 text-xs font-bold">
                                                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                                                <span>{item.rating} / 5</span>
                                            </div>
                                        </div>
                                        {item.comment ? (
                                            <p className="text-xs text-stone-700 italic bg-white/80 p-2.5 rounded-lg border border-amber-100">
                                                &ldquo;{item.comment}&rdquo;
                                            </p>
                                        ) : (
                                            <p className="text-[11px] text-stone-400 italic">Sense comentari escrit</p>
                                        )}
                                        <div className="flex justify-between text-[10px] text-stone-400 font-medium">
                                            <span>Usuari: {item.username}</span>
                                            <span>{new Date(item.createdAt).toLocaleString()}</span>
                                        </div>
                                    </div>
                                ))}
                                {(!metrics.ratingStats?.details || metrics.ratingStats.details.length === 0) && (
                                    <div className="py-12 text-center text-stone-400 italic border border-dashed border-stone-200 rounded-xl">
                                        Encara no hi ha valoracions registrades en aquest període.
                                    </div>
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>
                </motion.div>

                <motion.div variants={{ hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1 } }}>
                    <StatsCard
                        title="Taxa d'Abandonament"
                        description={<>
                            <span className={`text-2xl font-bold ${metrics.abandonmentRate.value > 40 ? 'text-red-500' : 'text-stone-800'}`}>
                                {metrics.abandonmentRate.value}%
                            </span>
                            <p className="text-[10px] text-stone-500 mt-1">Visitants que no acaben la ruta</p>
                        </>}
                        icon={<TrendingDown className={`w-6 h-6 ${activeTheme.mainText}`} />}
                    />
                </motion.div>

                <motion.div variants={{ hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1 } }}>
                    <Dialog>
                        <DialogTrigger asChild>
                            <div className="cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]">
                                <StatsCard
                                    title="Rutes Completades"
                                    description={<>
                                        <span className="text-2xl font-bold">{metrics.routesCompleted.value}</span>
                                        <div className="mt-2 text-[10px] text-primary font-bold flex items-center gap-1">
                                            <span>Veure detalls</span>
                                            <TrendingUp className="w-3 h-3" />
                                        </div>
                                    </>}
                                    icon={<MapIcon className={`w-6 h-6 ${activeTheme.mainText}`} />}
                                />
                            </div>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px] bg-white border-stone-200">
                            <DialogHeader>
                                <DialogTitle className="font-serif text-2xl text-stone-800">Detall de Rutes Completades</DialogTitle>
                                <DialogDescription className="text-stone-500">Nombre total de passaports segellats per cada itinerari.</DialogDescription>
                            </DialogHeader>
                            <div className="max-h-[60vh] overflow-y-auto pr-2 mt-4 space-y-3">
                                {routeCompletions?.map((item: any, i: number) => (
                                    <div key={i} className={`flex justify-between items-center p-4 rounded-xl border ${activeTheme.border} ${activeTheme.bgSoft}`}>
                                        <div className="flex flex-col">
                                            <span className="font-serif font-bold text-stone-800">{item.name}</span>
                                            <span className="text-[10px] text-stone-500 uppercase tracking-tighter">Ruta Turística</span>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-lg font-bold ${activeTheme.text}`}>
                                                {item.count}
                                            </div>
                                            <div className="text-[10px] text-stone-400 font-medium">FINALITZACIONS</div>
                                        </div>
                                    </div>
                                ))}
                                {(!routeCompletions || routeCompletions.length === 0) && (
                                    <div className="py-12 text-center text-stone-400 italic">No hi ha dades de finalització disponibles.</div>
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>
                </motion.div>

                <motion.div variants={{ hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1 } }}>
                    <Dialog>
                        <DialogTrigger asChild>
                            <div className="cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]">
                                <StatsCard
                                    title="Èxit en Reptes"
                                    description={<>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-2xl font-bold">{metrics.quizStats.value}%</span>
                                            <span className="text-xs text-stone-500">({metrics.quizStats.solved} de {metrics.quizStats.total})</span>
                                        </div>
                                        <div className="mt-2 text-[10px] text-primary font-bold flex items-center gap-1">
                                            <span>Veure detalls</span>
                                            <TrendingUp className="w-3 h-3" />
                                        </div>
                                    </>}
                                    icon={<TrendingUp className={`w-6 h-6 ${activeTheme.mainText}`} />}
                                />
                            </div>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px] bg-white border-stone-200">
                            <DialogHeader>
                                <DialogTitle className="font-serif text-2xl text-stone-800">Detall d'Èxit en Reptes</DialogTitle>
                                <DialogDescription className="text-stone-500">Resultats detallats per cada punt d'interès amb quiz.</DialogDescription>
                            </DialogHeader>
                            <div className="max-h-[60vh] overflow-y-auto pr-2 mt-4 space-y-3">
                                {metrics.quizStats.details?.map((item: any, i: number) => (
                                    <div key={i} className={`flex justify-between items-center p-4 rounded-xl border ${activeTheme.border} ${activeTheme.bgSoft}`}>
                                        <div className="flex flex-col">
                                            <span className="font-serif font-bold text-stone-800">{item.title}</span>
                                            <span className="text-[10px] text-stone-500 uppercase tracking-tighter">Punt d'Interès</span>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-lg font-bold ${activeTheme.text}`}>
                                                {item.solved} / {item.total}
                                            </div>
                                            <div className="text-[10px] text-stone-400 font-medium">RESPOSTES CORRECTES</div>
                                        </div>
                                    </div>
                                ))}
                                {(!metrics.quizStats.details || metrics.quizStats.details.length === 0) && (
                                    <div className="py-12 text-center text-stone-400 italic">No hi ha dades de reptes disponible.</div>
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>
                </motion.div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* 2. CHART: Route Completions */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span>Èxit per Ruta</span>
                            <span className="text-xs font-normal text-stone-500 italic">Nombre de finalitzacions totals</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {routeCompletions && routeCompletions.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={routeCompletions} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11 }} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        cursor={{ fill: 'transparent' }}
                                    />
                                    <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24} name="Completades">
                                        {routeCompletions.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={activeTheme.chartColors[index % activeTheme.chartColors.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-stone-400 italic text-sm">
                                Encara no hi ha rutes completades per mostrar al rànquing.
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* 3. RETENTION / ABANDONMENT */}
                <Card className={`${activeTheme.bgSoft} border-${activeTheme.border.split('-')[1]}-200`}>
                    <CardHeader>
                        <CardTitle className={`flex items-center gap-2 font-serif ${activeTheme.text}`}>
                            <Sparkles className="w-5 h-5 animate-pulse" />
                            Insights d'IA Territorial
                            <Badge variant="outline" className={`border-${activeTheme.text.split('[')[1].split(']')[0]}/30 ${activeTheme.text} text-[10px]`}>ANÀLISI BIOMA</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs font-bold">
                                <span className="text-stone-600">TAXA D'ABANDONAMENT</span>
                                <span className={metrics.abandonmentRate.value > 40 ? "text-red-500" : "text-green-600"}>{metrics.abandonmentRate.value}%</span>
                            </div>
                            <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden">
                                <div
                                    className={`${metrics.abandonmentRate.value > 40 ? "bg-red-400" : "bg-green-500"} h-full`}
                                    style={{ width: `${Math.min(100, metrics.abandonmentRate.value)}%` }}
                                />
                            </div>
                            <p className="text-[10px] text-stone-400">Visitants que inicien però no segellen el passaport final.</p>
                        </div>

                        <div className="pt-4 border-t border-stone-200/50">
                            <h4 className="text-xs font-bold text-stone-700 mb-2 uppercase tracking-wider">Conclusions de l'Assistent</h4>
                            <p className={`text-sm ${activeTheme.text} leading-relaxed italic`}>
                                "{aiInsights}"
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* 4. HEATMAP */}
                <Card className="lg:col-span-3">
                    <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between pb-4 gap-4">
                        <div className="flex flex-col gap-1">
                            <CardTitle className="flex items-center gap-2">
                                <MapIcon className={`w-5 h-5 ${activeTheme.text}`} />
                                Mapa de Calor d'Activitat
                                <Badge variant="secondary" className="text-[10px]">VEHICLE GPS</Badge>
                            </CardTitle>
                            <p className="text-xs text-stone-500 italic">Interaccions anònimes dels visitants al bosc.</p>
                        </div>

                        <div className="flex flex-col gap-1.5 min-w-[320px]">
                            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Cerca per Dates al Mapa
                            </label>
                            <div className="flex items-center gap-2 bg-white p-0.5 px-3 rounded-xl border border-stone-200 shadow-sm transition-all hover:border-stone-300">
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => { setStartDate(e.target.value); setPeriod('custom'); }}
                                    className="h-9 w-32 text-xs border-none bg-transparent focus-visible:ring-0"
                                />
                                <span className="text-stone-300 font-light">→</span>
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => { setEndDate(e.target.value); setPeriod('custom'); }}
                                    className="h-9 w-32 text-xs border-none bg-transparent focus-visible:ring-0"
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-stone-400"
                                    onClick={fetchData}
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="h-[400px] p-0 overflow-hidden rounded-b-xl relative border-t border-stone-100">
                        <MapLibreMap
                            key={data.mapCenter ? `${data.mapCenter[0]}-${data.mapCenter[1]}` : 'map'}
                            className="w-full h-full"
                            heatmapData={heatmap || []}
                            center={data.mapCenter || [1.5209, 41.5912]}
                            zoom={13}
                            showUserLocation={false}
                        >
                            {municipalityPois.map((poi: any) => (
                                <Marker key={poi.id} longitude={poi.longitude} latitude={poi.latitude} anchor="center">
                                    <div className="group relative flex items-center justify-center cursor-pointer">
                                        <div className="w-3.5 h-3.5 bg-amber-500 border-2 border-white rounded-full shadow-lg group-hover:scale-125 transition-transform" />
                                        <div className="absolute bottom-5 bg-stone-900/90 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20">
                                            {poi.title}
                                        </div>
                                    </div>
                                </Marker>
                            ))}
                        </MapLibreMap>
                        <div className="absolute bottom-6 left-6 bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-stone-200/50 max-w-xs animate-in slide-in-from-left-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Info className="w-4 h-4 text-primary" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-600">Llegenda de Calor</span>
                            </div>
                            <div className="h-2 w-full bg-gradient-to-r from-blue-400 via-green-400 via-yellow-400 to-red-500 rounded-full mb-2" />
                            <div className="flex justify-between text-[10px] text-stone-500 font-medium">
                                <span>Poca activitat</span>
                                <span>Molta activitat</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 5. GENERATED REPORTS LIST */}
                <Card className="lg:col-span-3 border-stone-200 shadow-sm">
                    <CardHeader className="bg-stone-50/50">
                        <CardTitle className="text-lg flex items-center justify-between gap-2 w-full">
                            <div className="flex items-center gap-2">
                                <FileCheck className="w-5 h-5 text-green-600" />
                                Arxiu d'Informes d'Impacte
                            </div>
                            {selectedReports.length > 0 && (
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={handleDeleteSelected}
                                    disabled={isDeleting}
                                    className="h-8 animate-in zoom-in-95 duration-200"
                                >
                                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                                    Esborrar ({selectedReports.length})
                                </Button>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {reports.length > 0 ? (
                            <table className="w-full text-sm">
                                <thead className="bg-stone-50 border-y border-stone-100 text-stone-500 text-[10px] uppercase tracking-widest text-left">
                                    <tr>
                                        <th className="px-6 py-3 font-bold w-12 text-center">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded border-stone-300 text-stone-800 focus:ring-stone-900"
                                                checked={selectedReports.length === reports.length && reports.length > 0}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedReports(reports.map(r => r.id));
                                                    else setSelectedReports([]);
                                                }}
                                            />
                                        </th>
                                        <th className="px-6 py-3 font-bold">Data de Generació</th>
                                        <th className="px-6 py-3 font-bold">Títol de l'Informe</th>
                                        <th className="px-6 py-3 font-bold">Estat</th>
                                        <th className="px-6 py-3 font-bold text-right">Accions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100">
                                    {reports.map((report: any) => (
                                        <tr key={report.id} className={`hover:bg-stone-50/50 transition-colors ${selectedReports.includes(report.id) ? 'bg-stone-50' : ''}`}>
                                            <td className="px-6 py-4 text-center">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-stone-300 text-stone-800 focus:ring-stone-900"
                                                    checked={selectedReports.includes(report.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedReports(prev => [...prev, report.id]);
                                                        else setSelectedReports(prev => prev.filter(id => id !== report.id));
                                                    }}
                                                />
                                            </td>
                                            <td className="px-6 py-4 text-stone-500 text-xs">
                                                {new Date(report.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-stone-800">{report.title}</td>
                                            <td className="px-6 py-4">
                                                <Badge className={
                                                    report.status === 'COMPLETED' ? "bg-green-100 text-green-700 hover:bg-green-100" :
                                                        report.status === 'ERROR' ? "bg-red-100 text-red-700 hover:bg-red-100" :
                                                            "bg-stone-100 text-stone-600 animate-pulse"
                                                }>
                                                    {report.status === 'COMPLETED' ? 'Llest' :
                                                        report.status === 'PENDING' ? 'En cua...' :
                                                            report.status === 'PROCESSING' ? 'Processant...' : 'Error'}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    disabled={report.status !== 'COMPLETED'}
                                                    onClick={() => {
                                                        const url = report.resultUrl.startsWith('http') ? report.resultUrl : `${window.location.origin}${report.resultUrl}`;
                                                        window.open(url, '_blank');
                                                    }}
                                                    className="text-stone-400 hover:text-stone-800 h-8"
                                                >
                                                    <Download className="w-4 h-4 mr-2" />
                                                    PDF
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={async () => {
                                                        if (confirm("Eliminar aquest informe?")) {
                                                            await deleteReport(report.id);
                                                            router.refresh();
                                                        }
                                                    }}
                                                    className="text-stone-300 hover:text-red-500 h-8"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="p-12 text-center">
                                <AlertCircle className="w-8 h-8 text-stone-300 mx-auto mb-3" />
                                <p className="text-stone-500 italic text-sm">Encara no s'ha generat cap informe oficial per a l'alcaldia.</p>
                                <Button
                                    variant="link"
                                    className={`${activeTheme.text} mt-2`}
                                    onClick={handleGenerateReport}
                                >
                                    Generar el primer ara
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </motion.div>
    );
}

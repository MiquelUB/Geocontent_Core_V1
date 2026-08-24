'use client'

import { useState, useEffect } from 'react'
import { generateReport } from '@/lib/actions/reports'
import { Button } from '@/components/ui/button'
import { FileText, Loader2, Download, AlertTriangle, CheckCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Report {
    id: string;
    title: string;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    resultUrl: string | null;
    createdAt: Date;
    municipality: { name: string };
    error?: string | null;
}

interface ReportsDashboardProps {
    initialReports: any[]; // Type issues across serialization, using any for now or refined type
    municipalityId?: string; // If null, shows generic or prompts for one
}

export function ReportsDashboard({ initialReports, municipalityId }: ReportsDashboardProps) {
    const [reports, setReports] = useState<Report[]>(initialReports);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    // Sync local state when props change (e.g. after router.refresh())
    useEffect(() => {
        setReports(initialReports);
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

    const handleGenerate = async () => {
        if (!municipalityId) {
            alert("No municipality selected");
            return;
        }
        setIsLoading(true);
        const result = await generateReport(municipalityId);
        setIsLoading(false);
        if (result.success) {
            router.refresh();
            alert("Generació iniciada. L'informe apareixerà i s'actualitzarà automàticament.");
        } else {
            alert("Error: " + result.error);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'COMPLETED': return <CheckCircle className="w-5 h-5 text-primary" />;
            case 'FAILED': return <AlertTriangle className="w-5 h-5 text-red-500" />;
            case 'PROCESSING': return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
            default: return <Loader2 className="w-5 h-5 text-gray-400" />;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-serif font-bold text-[#1e2b25]">Informes d'Impacte</h2>
                    <p className="text-gray-500">Generació automàtica d'informes via IA.</p>
                </div>
                <Button
                    onClick={handleGenerate}
                    disabled={isLoading}
                    className="bg-[#568F72] hover:bg-[#3e6b53] text-white"
                >
                    {isLoading ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generant...</>
                    ) : (
                        <><FileText className="w-4 h-4 mr-2" /> Generar Informe 2026</>
                    )}
                </Button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Títol</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Municipi</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estat</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Accions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {reports.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                    No hi ha informes generats encara.
                                </td>
                            </tr>
                        ) : (
                            reports.map((report) => (
                                <tr key={report.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{report.title}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">{report.municipality?.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center space-x-2">
                                            {getStatusIcon(report.status)}
                                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${report.status === 'COMPLETED' ? 'bg-primary/10 text-primary' :
                                                report.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                                                    report.status === 'PROCESSING' ? 'bg-blue-100 text-blue-700' :
                                                        'bg-gray-100 text-gray-700'
                                                }`}>
                                                {report.status}
                                            </span>
                                        </div>
                                        {report.error && <p className="text-xs text-red-500 mt-1">{report.error}</p>}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(report.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        {report.status === 'COMPLETED' && report.resultUrl && (
                                            <a
                                                href={report.resultUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center text-[#568F72] hover:text-[#3e6b53] font-medium text-sm"
                                            >
                                                <Download className="w-4 h-4 mr-1" /> Descarregar
                                            </a>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

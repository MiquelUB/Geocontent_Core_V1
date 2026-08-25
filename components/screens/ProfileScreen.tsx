import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { ArrowLeft, Settings, Edit, Trophy, ChevronRight, Star, User } from "lucide-react";
import { motion } from "motion/react";
import { PassportGrid } from "@/components/passport/PassportGrid";
import { handleAvatarUploadAction } from "@/lib/actions/storage";
import { getPassportData, getUserScore } from "@/lib/actions/gamification";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface ProfileScreenProps {
    onNavigate: (screen: string, data?: any) => void;
    currentUser?: any;
    onUserUpdate?: (user: any) => void;
}

export function ProfileScreen({ onNavigate, currentUser, onUserUpdate }: ProfileScreenProps) {
    const t = useTranslations('profile');
    const tCommon = useTranslations('common');
    
    const [passportData, setPassportData] = useState<any[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [totalScore, setTotalScore] = useState(currentUser?.xp || 0);
    const [solvedQuizzes, setSolvedQuizzes] = useState(0);
    const [visitedCount, setVisitedCount] = useState(currentUser?.visitedCount || 0);

    useEffect(() => {
        if (currentUser?.id) {
            getPassportData(currentUser.id).then(setPassportData);
            getUserScore(currentUser.id).then(res => {
                setTotalScore(res.totalScore);
                setSolvedQuizzes(res.solvedQuizzesCount);
                setVisitedCount(res.visitedCount || 0);
            });
        }
    }, [currentUser?.id, currentUser?.xp]);

    const getRank = (level: number) => {
        if (level >= 5) return t('ranks.level5');
        if (level === 4) return t('ranks.level4');
        if (level === 3) return t('ranks.level3');
        if (level === 2) return t('ranks.level2');
        return t('ranks.level1');
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !currentUser?.id) return;

        try {
            setIsUploading(true);
            const formData = new FormData();
            formData.append('file', file);

            const result = await handleAvatarUploadAction(formData);
            if (result.success && result.user) {
                if (onUserUpdate) {
                    onUserUpdate(result.user);
                } else {
                    window.location.reload();
                }
            } else {
                alert(t('errorAvatar'));
            }
        } catch (err) {
            alert(t('errorAvatar'));
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="bg-[#F9F7F2] dark:bg-[#1a211e] min-h-screen flex flex-col relative overflow-x-hidden text-[#1e2b25] dark:text-gray-100 font-sans pb-32">

            {/* Header Navigation */}
            <div className="sticky top-0 z-50 bg-[#F9F7F2]/95 dark:bg-[#1a211e]/95 backdrop-blur-sm border-b border-primary/10 px-4 py-3 flex items-center justify-between">
                <button onClick={() => onNavigate('home')} className="text-[#1e2b25] dark:text-white p-2 rounded-full hover:bg-primary/10 transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h2 className="font-serif text-xl font-medium tracking-wide text-[#1e2b25] dark:text-white">{t('title')}</h2>
                <div className="w-10" />
            </div>

            {/* Main Content */}
            <main className="flex-1 flex flex-col gap-6 pb-24">

                <div className="flex flex-col items-center pt-6 px-4">
                    <div className="relative group cursor-pointer" onClick={() => document.getElementById('avatar-input')?.click()}>
                        <div className="w-32 h-32 rounded-full p-1 border-[3px] border-primary bg-white shadow-sm overflow-hidden">
                            {isUploading ? (
                                <div className="w-full h-full flex items-center justify-center bg-gray-100 animate-pulse">
                                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : (
                                currentUser?.avatarUrl ? (
                                    <img
                                        alt="Profile picture"
                                        className="w-full h-full object-cover rounded-full"
                                        src={currentUser.avatarUrl}
                                    />
                                ) : (
                                    <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center">
                                        <User className="w-16 h-16 text-primary" />
                                    </div>
                                )
                            )}
                        </div>
                        <div className="absolute bottom-0 right-0 bg-primary text-white p-1.5 rounded-full border-2 border-[#F9F7F2] dark:border-[#1a211e] shadow-sm">
                            <Edit className="w-4 h-4" />
                        </div>
                        <input
                            id="avatar-input"
                            type="file"
                            accept="image/*"
                            capture="user"
                            className="hidden"
                            onChange={handleAvatarChange}
                        />
                    </div>
                    <div className="mt-4 text-center">
                        <h1 className="font-serif text-3xl font-bold text-[#1e2b25] dark:text-white leading-tight">
                            {currentUser?.username || currentUser?.name || (currentUser?.email ? currentUser.email.split('@')[0] : t('anonymous'))}
                        </h1>
                        <p className="font-serif italic text-primary text-lg mt-1">
                            {getRank(currentUser?.level || 1)}
                        </p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1">
                            {t('level', { level: currentUser?.level || 1 })} • {t('xp', { xp: currentUser?.xp || 0 })}
                        </p>
                    </div>
                </div>

                <div className="px-4">
                    <div className="bg-white dark:bg-white/5 rounded-2xl p-6 shadow-[0_2px_8px_-2px_rgba(86,143,114,0.15)] border border-primary/10 flex justify-between divide-x divide-primary/10">
                        <div className="flex-1 flex flex-col items-center justify-center gap-1 px-2">
                            <span className="font-serif text-3xl font-bold text-primary">{visitedCount}</span>
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">{t('visitedPlaces')}</span>
                        </div>
                        <div className="flex-1 flex flex-col items-center justify-center gap-1 px-2">
                            <span className="font-serif text-3xl font-bold text-primary">{totalScore}</span>
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">{t('totalPoints')}</span>
                        </div>
                        <div className="flex-1 flex flex-col items-center justify-center gap-1 px-2">
                            <span className="font-serif text-3xl font-bold text-primary">{solvedQuizzes}</span>
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">{t('solvedQuizzes')}</span>
                        </div>
                    </div>
                </div>

                {/* Passport Section */}
                <div className="px-4 mt-2">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="font-serif text-2xl font-bold text-[#1e2b25] dark:text-white italic">{t('passportTitle')}</h3>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-widest mt-0.5">
                                {t('stamps')} — {passportData.filter((s: any) => s.isCompleted).length} / {passportData.length} {t('unlocked')}
                            </p>
                        </div>
                    </div>

                    {/* Stamps Grid Container */}
                    <PassportGrid
                        initialStamps={passportData}
                        currentUser={currentUser}
                        onStampUpdate={(updatedStamp: any) => {
                            setPassportData(prev => prev.map(s => s.id === updatedStamp.id ? { ...s, ...updatedStamp } : s));
                        }}
                    />

                    {/* Helper tip */}
                    <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 bg-primary/5 rounded-xl py-2.5 px-3 border border-primary/10">
                        <span className="text-amber-500">💡</span>
                        <span>Fes clic a un segell per valorar la ruta i escriure el teu comentari.</span>
                    </div>
                </div>

                {/* 📝 OPINIONS I COMENTARIS DELS USUARIS */}
                <div className="px-4 mt-6">
                    <h3 className="font-serif text-2xl font-bold text-[#1e2b25] dark:text-white italic mb-3">Les Teves Opinions</h3>
                    {passportData.filter((s: any) => (s.rating > 0 || (s.comment && s.comment.trim().length > 0))).length === 0 ? (
                        <div className="bg-white dark:bg-white/5 rounded-2xl p-6 border border-primary/10 text-center">
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                                Encara no has afegit cap valoració o comentari.
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                                Fes clic sobre els teus segells per deixar la teva opinió i puntuació!
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {passportData
                                .filter((s: any) => (s.rating > 0 || (s.comment && s.comment.trim().length > 0)))
                                .map((stamp: any) => (
                                    <div key={stamp.id} className="bg-white dark:bg-[#1e2a22] rounded-2xl p-4 border border-primary/10 shadow-[0_2px_8px_-2px_rgba(86,143,114,0.1)]">
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="font-serif font-bold text-sm text-[#1e2b25] dark:text-white line-clamp-1">{stamp.name}</h4>
                                            <div className="flex gap-0.5">
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                    <Star
                                                        key={star}
                                                        className={cn(
                                                            "w-3.5 h-3.5",
                                                            star <= stamp.rating
                                                                ? "text-amber-500 fill-amber-500"
                                                                : "text-gray-300 dark:text-gray-700"
                                                        )}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        {stamp.comment ? (
                                            <p className="text-xs text-gray-600 dark:text-gray-300 italic">
                                                &ldquo;{stamp.comment}&rdquo;
                                            </p>
                                        ) : (
                                            <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                                                Sense comentari escrit
                                            </p>
                                        )}
                                    </div>
                                ))}
                        </div>
                    )}
                </div>


            </main>
        </div>
    );
}



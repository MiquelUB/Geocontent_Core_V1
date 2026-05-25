'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Trophy, Loader2, Sparkles, ChevronRight, GraduationCap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { completeFinalRouteQuizAction } from '@/lib/actions/gamification';

interface FinalRouteQuizProps {
    routeId: string;
    userId: string;
    pois: any[];
    finalQuiz?: any; // object with { preguntes: [...] }
    onComplete?: (result: any) => void;
    isAlreadyCompleted?: boolean;
}

export default function FinalRouteQuiz({ routeId, userId, pois, finalQuiz, onComplete, isAlreadyCompleted = false }: FinalRouteQuizProps) {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [score, setScore] = useState(0);
    const [quizQuestions, setQuizQuestions] = useState<any[]>([]);

    useEffect(() => {
        if (finalQuiz && finalQuiz.preguntes && finalQuiz.preguntes.length > 0) {
            setQuizQuestions(finalQuiz.preguntes);
            return;
        }

        // Collect all available quizzes from POIs as fallback
        const availableQuizzes = pois
            .filter(p => p.manualQuiz)
            .map(p => ({
                ...p.manualQuiz,
                poiTitle: p.title
            }));

        // Shuffle and pick 3-5
        const shuffled = [...availableQuizzes].sort(() => 0.5 - Math.random());
        setQuizQuestions(shuffled.slice(0, Math.min(shuffled.length, 5)));
    }, [pois, finalQuiz]);

    async function handleAnswer(index: number) {
        if (isCorrect !== null) return;

        setSelectedOption(index);
        const correct = index === quizQuestions[currentQuestionIndex].correcta;
        setIsCorrect(correct);

        if (correct) {
            setScore(s => s + 1);
        }

        // Wait a bit then move to next or finish
        setTimeout(async () => {
            if (currentQuestionIndex < quizQuestions.length - 1) {
                setCurrentQuestionIndex(i => i + 1);
                setSelectedOption(null);
                setIsCorrect(null);
            } else {
                setIsFinished(true);
                // If all correct, award points
                const finalScore = correct ? score + 1 : score;
                if (finalScore === quizQuestions.length) {
                    setIsSubmitting(true);
                    try {
                        const res = await completeFinalRouteQuizAction(routeId, userId);
                        if (onComplete) onComplete(res);
                    } catch (err) {
                        console.error("Error saving final quiz progress:", err);
                    } finally {
                        setIsSubmitting(false);
                    }
                }
            }
        }, 1500);
    }

    if (isAlreadyCompleted) {
        return (
            <div className="p-6 rounded-2xl bg-amber-50 border-2 border-amber-200 flex flex-col items-center text-center gap-3">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                    <GraduationCap className="w-10 h-10 text-amber-600" />
                </div>
                <div>
                    <h3 className="font-serif text-xl font-bold text-amber-900 leading-tight">Mestre del Territori</h3>
                    <p className="text-sm text-amber-700 mt-1">Has superat el Reptes Final d'aquesta ruta i has obtingut 1.000 XP!</p>
                </div>
            </div>
        );
    }

    if (quizQuestions.length === 0) return null;

    if (isFinished) {
        const passed = score === quizQuestions.length;
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-8 rounded-3xl bg-white border-2 border-stone-100 shadow-xl flex flex-col items-center text-center gap-6"
            >
                {passed ? (
                    <>
                        <div className="relative">
                            <motion.div
                                animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                                transition={{ repeat: Infinity, duration: 3 }}
                                className="w-24 h-24 bg-primary rounded-full flex items-center justify-center text-white"
                            >
                                <Trophy className="w-12 h-12" />
                            </motion.div>
                            <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-amber-400 animate-pulse" />
                        </div>
                        <div>
                            <h2 className="font-serif text-3xl font-bold text-stone-900">Enhorabona!</h2>
                            <p className="text-stone-500 mt-2">Has respost correctament totes les preguntes ({score}/{quizQuestions.length}).</p>
                            <p className="text-primary font-bold text-lg mt-1">+1.000 XP</p>
                        </div>
                        <Button
                            className="w-full py-6 text-lg rounded-2xl"
                            onClick={() => {
                                if (onComplete) onComplete({ success: true });
                                else window.location.reload();
                            }}
                        >
                            D'acord
                        </Button>
                    </>
                ) : (
                    <>
                        <div className="w-24 h-24 bg-stone-100 rounded-full flex items-center justify-center text-stone-400">
                            <XCircle className="w-12 h-12" />
                        </div>
                        <div>
                            <h2 className="font-serif text-2xl font-bold text-stone-900">Gairebé ho tens!</h2>
                            <p className="text-stone-500 mt-2">Has encertat {score} de {quizQuestions.length} preguntes. Cal que encertis el 100% per ser Mestre del Territori.</p>
                        </div>
                        <Button
                            variant="outline"
                            className="w-full py-6 text-lg rounded-2xl"
                            onClick={() => {
                                setCurrentQuestionIndex(0);
                                setScore(0);
                                setIsFinished(false);
                                setSelectedOption(null);
                                setIsCorrect(null);
                            }}
                        >
                            Tornar-ho a provar
                        </Button>
                    </>
                )}
            </motion.div>
        );
    }

    const currentQuiz = quizQuestions[currentQuestionIndex];

    return (
        <div className="p-6 rounded-3xl bg-white border border-stone-200 shadow-lg space-y-6 relative overflow-hidden">
            {/* Progress bar */}
            <div className="absolute top-0 left-0 h-1 bg-primary/10 w-full">
                <motion.div
                    className="h-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${((currentQuestionIndex) / quizQuestions.length) * 100}%` }}
                />
            </div>

            <div className="flex justify-between items-center pt-2">
                <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-primary" />
                    <span className="text-[10px] uppercase font-black tracking-widest text-stone-400">Repte Final de Ruta</span>
                </div>
                <span className="text-xs font-bold text-primary">{currentQuestionIndex + 1} / {quizQuestions.length}</span>
            </div>

            <div className="space-y-4">
                <p className="text-[10px] text-primary/60 font-medium uppercase tracking-tighter italic">Pregunta sobre: {currentQuiz.poiTitle}</p>
                <h3 className="font-serif text-xl font-bold text-stone-900 leading-tight">
                    {currentQuiz.pregunta}
                </h3>

                <div className="grid grid-cols-1 gap-3">
                    {currentQuiz.opcions.map((option: string, idx: number) => (
                        <Button
                            key={idx}
                            variant="outline"
                            disabled={isCorrect !== null}
                            onClick={() => handleAnswer(idx)}
                            className={`justify-start text-sm h-auto py-4 px-5 text-left font-sans transition-all border-stone-200 rounded-2xl whitespace-normal min-h-[64px] ${selectedOption === idx
                                ? (isCorrect ? 'bg-green-50 border-green-500 text-green-700 font-bold ring-4 ring-green-100' : 'bg-red-50 border-red-500 text-red-700 ring-4 ring-red-100')
                                : 'hover:border-primary/50 hover:bg-stone-50'
                                }`}
                        >
                            <div className="flex items-center w-full">
                                <span className="flex-1">{option}</span>
                                {selectedOption === idx && (
                                    isCorrect ? <CheckCircle2 className="w-5 h-5 ml-2" /> : <XCircle className="w-5 h-5 ml-2" />
                                )}
                            </div>
                        </Button>
                    ))}
                </div>
            </div>

            <AnimatePresence>
                {isCorrect === false && (
                    <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="text-center text-xs text-red-500 font-medium"
                    >
                        Ui! Sembla que aquesta no era la correcta...
                    </motion.p>
                )}
            </AnimatePresence>
        </div>
    );
}

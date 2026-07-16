'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Trophy, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { completePoiQuizAction } from '@/lib/actions/gamification';

interface PoiQuizProps {
    poiId: string;
    userId: string;
    quiz: {
        pregunta: string;
        opcions: string[];
        correcta: number;
        feedback?: string;
    };
    onComplete?: (res?: any) => void;
    isAlreadyCompleted?: boolean;
}

export default function PoiQuiz({ poiId, userId, quiz, onComplete, isAlreadyCompleted = false }: PoiQuizProps) {
    const [selectedOption, setSelectedOption] = useState<number | null>(isAlreadyCompleted ? quiz.correcta : null);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(isAlreadyCompleted ? true : null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showFeedback, setShowFeedback] = useState(isAlreadyCompleted);
    const [attempts, setAttempts] = useState(1);

    async function handleAnswer(index: number) {
        if (isCorrect !== null || isAlreadyCompleted) return;

        setSelectedOption(index);
        const correct = index === quiz.correcta;
        setIsCorrect(correct);
        setShowFeedback(true);

        if (correct) {
            setIsSubmitting(true);
            try {
                // Passem els intents per restar punts
                const res = await completePoiQuizAction(poiId, userId, attempts);
                if (onComplete) onComplete(res);
            } catch (err) {
                console.error("Error saving quiz progress:", err);
            } finally {
                setIsSubmitting(false);
            }
        }
    }

    function handleRetry() {
        setIsCorrect(null);
        setSelectedOption(null);
        setShowFeedback(false);
        setAttempts(prev => prev + 1);
    }

    // Calcula els punts actuals que guanyarà (només informatiu)
    const currentPoints = Math.max(20, 50 - ((attempts - 1) * 10));

    return (
        <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                        <Trophy className="w-3 h-3" />
                    </div>
                    <span className="text-[10px] uppercase font-black tracking-widest text-stone-400">Repte de Coneixement</span>
                </div>
                {!isAlreadyCompleted && isCorrect === null && (
                    <span className="text-[10px] font-bold text-stone-400 bg-stone-100 px-2 py-1 rounded-full">
                        {currentPoints} XP
                    </span>
                )}
            </div>

            <h3 className="font-serif text-base font-bold text-stone-900 leading-tight">
                {quiz.pregunta}
            </h3>

            <div className="grid grid-cols-1 gap-2">
                {quiz.opcions.map((option, idx) => (
                    <Button
                        key={idx}
                        variant="outline"
                        disabled={isCorrect !== null || isAlreadyCompleted}
                        onClick={() => handleAnswer(idx)}
                        className={`justify-start text-xs h-auto py-3 px-4 text-left font-sans transition-all border-stone-200 whitespace-normal min-h-[52px] ${selectedOption === idx
                            ? (isCorrect ? 'bg-green-50 border-green-500 text-green-700 font-bold ring-2 ring-green-100 opacity-100' : 'bg-red-50 border-red-500 text-red-700 ring-2 ring-red-100 opacity-100')
                            : (isCorrect !== null || isAlreadyCompleted) ? 'opacity-50 grayscale bg-stone-50' : 'hover:border-primary/50 hover:bg-stone-50'
                            }`}
                    >
                        <div className="flex items-center w-full">
                            <span className="flex-1">{option}</span>
                            {selectedOption === idx && (
                                isCorrect ? <CheckCircle2 className="w-4 h-4 ml-2" /> : <XCircle className="w-4 h-4 ml-2" />
                            )}
                        </div>
                    </Button>
                ))}
            </div>

            <AnimatePresence>
                {showFeedback && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-3 rounded-lg text-xs leading-snug ${isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                    >
                        {isCorrect ? (
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                    <span><strong>Molt bé!</strong> {isAlreadyCompleted ? 'Ja havies superat aquest repte.' : 'Has desbloquejat un tros del segell del passaport!'}</span>
                                </div>
                                {quiz.feedback && (
                                    <p className="mt-2 text-green-700 opacity-90 italic border-t border-green-200/50 pt-2">{quiz.feedback}</p>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center gap-2">
                                    <XCircle className="w-3 h-3" />
                                    <span><strong>Oh no!</strong> {quiz.feedback || "Torna a llegir la història i prova-ho de nou."}</span>
                                </div>
                                {!isAlreadyCompleted && (
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={handleRetry}
                                        className="w-full bg-white text-red-700 border-red-200 hover:bg-red-50 hover:border-red-300"
                                    >
                                        Torna-ho a provar
                                    </Button>
                                )}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

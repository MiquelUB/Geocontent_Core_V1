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
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showFeedback, setShowFeedback] = useState(false);

    async function handleAnswer(index: number) {
        if (isCorrect !== null || isAlreadyCompleted) return;

        setSelectedOption(index);
        const correct = index === quiz.correcta;
        setIsCorrect(correct);
        setShowFeedback(true);

        if (correct) {
            setIsSubmitting(true);
            try {
                const res = await completePoiQuizAction(poiId, userId);
                if (onComplete) onComplete(res);
            } catch (err) {
                console.error("Error saving quiz progress:", err);
            } finally {
                setIsSubmitting(false);
            }
        }
    }

    if (isAlreadyCompleted) {
        return (
            <div className="p-4 rounded-xl bg-green-50 border border-green-200 flex items-center gap-3">
                <Trophy className="w-5 h-5 text-green-600" />
                <div>
                    <p className="text-xs font-bold text-green-800 uppercase tracking-tighter">Repte Superat!</p>
                    <p className="text-[10px] text-green-600">Has respost correctament i has guanyat un fragment del segell.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                    <Trophy className="w-3 h-3" />
                </div>
                <span className="text-[10px] uppercase font-black tracking-widest text-stone-400">Repte de Coneixement</span>
            </div>

            <h3 className="font-serif text-base font-bold text-stone-900 leading-tight">
                {quiz.pregunta}
            </h3>

            <div className="grid grid-cols-1 gap-2">
                {quiz.opcions.map((option, idx) => (
                    <Button
                        key={idx}
                        variant="outline"
                        disabled={isCorrect !== null}
                        onClick={() => handleAnswer(idx)}
                        className={`justify-start text-xs h-auto py-3 px-4 text-left font-sans transition-all border-stone-200 whitespace-normal min-h-[52px] ${selectedOption === idx
                            ? (isCorrect ? 'bg-green-50 border-green-500 text-green-700 font-bold ring-2 ring-green-100' : 'bg-red-50 border-red-500 text-red-700 ring-2 ring-red-100')
                            : 'hover:border-primary/50 hover:bg-stone-50'
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
                            <div className="flex items-center gap-2">
                                {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                <span><strong>Molt bé!</strong> Has desbloquejat un tros del segell del passaport!</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <XCircle className="w-3 h-3" />
                                <span><strong>Oh no!</strong> Estàs segur? Torna a llegir la història i prova-ho de nou.</span>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

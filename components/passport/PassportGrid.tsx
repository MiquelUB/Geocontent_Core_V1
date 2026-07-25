'use client';

import { useState, useEffect } from "react";
import { PassportStamp } from "./PassportStamp";
import { Star, X, MessageSquare, Loader2, Award } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { rateRouteAction } from "@/lib/actions/gamification";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PassportGridProps {
  initialStamps?: any[];
  currentUser?: any;
  onStampUpdate?: (stamp: any) => void;
}

export function PassportGrid({ initialStamps = [], currentUser, onStampUpdate }: PassportGridProps) {
  const [stamps, setStamps] = useState<any[]>(initialStamps);
  const [selectedStamp, setSelectedStamp] = useState<any | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);

  useEffect(() => {
    // Refresh stamps list when parent re-loads data
    setStamps(initialStamps);
  }, [initialStamps]);

  const handleStampClick = (stamp: any) => {
    setSelectedStamp(stamp);
    setRating(stamp.rating || 0);
    setComment(stamp.comment || "");
  };

  const handleSubmitFeedback = async () => {
    if (!currentUser?.id) {
      toast.error("Sessió no activa. Has d'estar identificat.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await rateRouteAction(currentUser.id, selectedStamp.id, rating, comment);
      if (res.success) {
        toast.success("Moltes gràcies pel teu comentari!");
        const updated = { ...selectedStamp, rating, comment, isCompleted: true };
        setStamps(prev => prev.map(s => s.id === selectedStamp.id ? updated : s));
        if (onStampUpdate) onStampUpdate(updated);
        setSelectedStamp(null);
      } else {
        toast.error(res.error || "No s'ha pogut guardar la teva opinió.");
      }
    } catch (err) {
      toast.error("Error en connectar amb el servidor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        {stamps.map((stamp, index) => (
          <PassportStamp
            key={stamp.id}
            id={stamp.id}
            name={stamp.name}
            date={stamp.date}
            stampUrl={stamp.stampUrl}
            totalPois={stamp.totalPois ?? 1}
            visitedPois={stamp.visitedPois ?? 0}
            quizDonePois={stamp.quizDonePois ?? 0}
            poisProgress={stamp.poisProgress ?? []}
            isCompleted={stamp.isCompleted ?? false}
            onClick={() => handleStampClick(stamp)}
            index={index}
          />
        ))}
      </div>

      {/* 🌟 PREMIUM RATING & COMMENT MODAL */}
      <AnimatePresence>
        {selectedStamp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Dark glassmorphic backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedStamp(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-white dark:bg-[#151c19] border border-primary/20 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative overflow-hidden z-10"
            >
              {/* Botanical Background Accent */}
              <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-primary/5 pointer-events-none" />

              {/* Close Button */}
              <button
                onClick={() => setSelectedStamp(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1 rounded-full hover:bg-primary/10"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <Award className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-widest font-semibold text-amber-600 dark:text-amber-400">Ruta Completada</span>
                  <h3 className="font-serif text-lg font-bold text-[#1e2b25] dark:text-white leading-tight line-clamp-1">{selectedStamp.name}</h3>
                </div>
              </div>

              <div className="border-t border-primary/10 my-3" />

              {/* Rating Section */}
              <div className="text-center my-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-2">Com valoraries la teva experiència?</p>
                <div className="flex justify-center space-x-1">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const isLit = star <= (hoveredStar ?? rating);
                    return (
                      <motion.button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoveredStar(star)}
                        onMouseLeave={() => setHoveredStar(null)}
                        whileTap={{ scale: 0.85 }}
                        className="p-1 transition-transform focus:outline-none"
                      >
                        <Star
                          className={cn(
                            "w-8 h-8 transition-colors duration-150",
                            isLit
                              ? "text-amber-500 fill-amber-500 drop-shadow-sm"
                              : "text-gray-300 dark:text-gray-700"
                          )}
                        />
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Feedback box */}
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>El teu comentari</span>
                </div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Escriu aquí què t'ha semblat la ruta, què milloraries o quines curiositats has viscut..."
                  maxLength={500}
                  className={cn(
                    "w-full h-24 p-3 rounded-xl text-sm font-sans resize-none transition-all duration-200 focus:outline-none",
                    "border border-primary/10 bg-gray-50 dark:bg-white/5 text-gray-800 dark:text-gray-100",
                    "focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white"
                  )}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedStamp(null)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 text-sm font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                  Cancel·lar
                </button>
                <button
                  type="button"
                  disabled={isSubmitting || rating === 0}
                  onClick={handleSubmitFeedback}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-1.5 shadow-md",
                    rating > 0 
                      ? "bg-primary hover:bg-primary/90 active:scale-95 cursor-pointer" 
                      : "bg-gray-300 dark:bg-gray-800 cursor-not-allowed opacity-50 text-gray-500"
                  )}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Desar opinió"
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

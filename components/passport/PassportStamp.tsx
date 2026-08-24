'use client';

import { useEffect, useRef, useState } from "react";
import { Lock, Stamp, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PoiProgress {
  id: string;
  title: string;
  isVisited: boolean;
  isQuizDone: boolean;
  quizSolved: boolean; // NEW
  progress: number;
  hasQuiz: boolean;
}

import { GraduationCap } from "lucide-react"; // Import icon

export interface PassportStampProps {
  id: string;
  name: string;
  date?: string | null;
  stampUrl: string;
  totalPois: number;
  visitedPois: number;
  quizDonePois: number;
  poisProgress: PoiProgress[];
  isCompleted: boolean;
  onClick: () => void;
  index?: number;
}

// ─── Web Audio API — ascending arpegio + final chord (Organic Tech: sine, no attack) ─

function playCompletionSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Notes: C5 → E5 → G5 → C6
    const arpNotes = [523.25, 659.25, 783.99, 1046.50];
    arpNotes.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.16;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      // Organic attack/decay — no sharp click
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.28, t + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

      osc.start(t);
      osc.stop(t + 0.6);
    });

    // Soft final chord: C5 + E5 + G5 in triangle (warmer timbre)
    const chordStart = ctx.currentTime + arpNotes.length * 0.16 + 0.08;
    [523.25, 659.25, 783.99].forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, chordStart);

      gain.gain.setValueAtTime(0, chordStart);
      gain.gain.linearRampToValueAtTime(0.15, chordStart + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, chordStart + 1.2);

      osc.start(chordStart);
      osc.stop(chordStart + 1.3);
    });
  } catch {
    // Audio not available — fail silently
  }
}

// ─── Clip-path helper — pure function, safe for any N ─────────────────────────

function sliceClipPath(sliceIndex: number, totalSlices: number): string {
  if (totalSlices <= 1) return 'inset(0 0% 0 0%)';
  const leftPct = ((sliceIndex / totalSlices) * 100).toFixed(4);
  const rightPct = (((totalSlices - sliceIndex - 1) / totalSlices) * 100).toFixed(4);
  return `inset(0 ${rightPct}% 0 ${leftPct}%)`;
}

// ─── Botanical dot — replaces generic star for Quadern de Camp aesthetic ──────

function BotanicalDot({ delay, angle, distance }: { delay: number; angle: number; distance: number }) {
  const rad = (angle * Math.PI) / 180;
  const tx = Math.cos(rad) * distance;
  const ty = Math.sin(rad) * distance;
  return (
    <motion.div
      className="absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-full bg-amber-400/80 pointer-events-none z-30"
      initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
      animate={{ x: tx, y: ty, opacity: 0, scale: [0, 1.2, 0.8] }}
      transition={{ duration: 0.7, delay, ease: 'easeOut' }}
    />
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PassportStamp({
  id, name, date, stampUrl,
  totalPois, visitedPois, quizDonePois,
  poisProgress, isCompleted,
  onClick, index = 0
}: PassportStampProps) {

  // Only celebrate when transitioning to complete this session, not on mount
  const prevCompleted = useRef(isCompleted);
  const [showCelebration, setShowCelebration] = useState(false);
  const [soundHasPlayed, setSoundHasPlayed] = useState(false);

  useEffect(() => {
    if (isCompleted && !prevCompleted.current && !soundHasPlayed) {
      setSoundHasPlayed(true);
      playCompletionSound();
      setShowCelebration(true);
      const t = setTimeout(() => setShowCelebration(false), 2400);
      prevCompleted.current = true;
      return () => clearTimeout(t);
    }
    prevCompleted.current = isCompleted;
  }, [isCompleted, soundHasPlayed]);

  const N = Math.max(totalPois, 1);
  const hasAnyVisit = visitedPois > 0;
  const allVisited = visitedPois === totalPois && totalPois > 0;

  // Normalize poisProgress to always have exactly N entries
  const slices: PoiProgress[] = poisProgress.length === N
    ? poisProgress
    : Array.from({ length: N }, (_, i) => poisProgress[i] ?? {
      id: `empty-${i}`, title: '', isVisited: false, isQuizDone: false, quizSolved: false,
      progress: 0, hasQuiz: false,
    });

  // Botanical particle positions (7 evenly spaced + 1 extra up)
  const botanicalAngles = [0, 51, 102, 153, 204, 255, 306, 357].map((a, i) => ({
    angle: a, delay: i * 0.06, distance: 18 + (i % 3) * 6,
  }));

  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.07, type: 'spring', stiffness: 220, damping: 22 }}
      whileHover={hasAnyVisit ? { scale: 1.04, transition: { duration: 0.18 } } : {}}
      className={cn(
        // Base
        "aspect-square flex flex-col items-end justify-end",
        "rounded-xl border shadow-sm relative overflow-hidden w-full",
        "transition-shadow duration-300",
        // Discovered vs locked
        hasAnyVisit
          ? "bg-primary/5 dark:bg-primary/10 border-primary/20"
          : "border-dashed border-primary/30 dark:border-primary/20 bg-transparent",
        // Completion ring — muted amber ink, not neon gold
        isCompleted && "ring-2 ring-amber-500/40 shadow-sm shadow-amber-400/20"
      )}
    >


      {hasAnyVisit ? (
        <>
          {/* ── Revealed slices ─────────────────────────────────────────── */}
          {slices.map((poi, i) => {
            if (!poi.isVisited) return null;
            const clip = sliceClipPath(i, N);
            const quizDone = poi.isQuizDone;
            return (
              <motion.div
                key={`slice-${poi.id}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="absolute inset-0 pointer-events-none"
                style={{ clipPath: clip }}
              >
                {/* Stamp image — fuller/brighter when quiz done */}
                <img
                  src={stampUrl}
                  alt={name}
                  loading="lazy"
                  className={cn(
                    "w-full h-full object-cover transition-all duration-500 mix-blend-multiply brightness-[1.15] contrast-[1.15]",
                    quizDone
                      ? "opacity-100 saturate-100"
                      : "opacity-55 saturate-[0.55]"
                  )}
                />
                {/* Subtle warm overlay on quiz-done slices — like aged ink */}
                {quizDone && (
                  <div
                    className="absolute inset-0 mix-blend-multiply pointer-events-none"
                    style={{
                      background: 'linear-gradient(180deg, rgba(180,140,80,0.12) 0%, transparent 60%)'
                    }}
                  />
                )}
                {/* Graduation cap if quiz solved */}
                {poi.quizSolved && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/80 dark:bg-black/60 rounded-full p-1 shadow-sm">
                    <GraduationCap className="w-3 h-3 text-primary animate-pulse" />
                  </div>
                )}
              </motion.div>
            );
          })}

          {/* ── Slice dividers: perforated / dotted line aesthetic ─────── */}
          {N > 1 && Array.from({ length: N - 1 }).map((_, i) => {
            const leftPct = `${(((i + 1) / N) * 100).toFixed(3)}%`;
            return (
              <div
                key={`div-${i}`}
                className="absolute top-0 bottom-0 z-10 pointer-events-none"
                style={{ left: leftPct, width: '1px' }}
              >
                {/* Perforated look: alternating dots */}
                {Array.from({ length: 10 }).map((_, d) => (
                  <div
                    key={d}
                    className="absolute left-0 w-px bg-white/50 dark:bg-black/30"
                    style={{
                      top: `${d * 10}%`,
                      height: '6%',
                    }}
                  />
                ))}
              </div>
            );
          })}

          {/* ── Lock icons on unvisited slices ───────────────────────── */}
          {slices.map((poi, i) => {
            if (poi.isVisited) return null;
            const leftPct = (i / N) * 100;
            const widthPct = (1 / N) * 100;
            return (
              <div
                key={`lock-${poi.id}`}
                className="absolute top-0 bottom-0 flex items-center justify-center z-10 pointer-events-none"
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
              >
                <div className="w-4 h-4 rounded-full bg-white/50 dark:bg-black/30 flex items-center justify-center backdrop-blur-[1px]">
                  <Lock className="w-2 h-2 text-primary/60 dark:text-primary/70" />
                </div>
              </div>
            );
          })}

          {/* ── Completion: soft ink-spread glow ─────────────────────── */}
          <AnimatePresence>
            {showCelebration && (
              <>
                {/* Radial ink-spread from center */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: [0, 0.45, 0], scale: [0.5, 1.6, 2.2] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.8, ease: 'easeOut' }}
                  className="absolute inset-0 rounded-xl pointer-events-none"
                  style={{
                    background: 'radial-gradient(circle, rgba(180,140,60,0.4) 0%, transparent 70%)',
                  }}
                />
                {/* Botanical dots dispersing */}
                {botanicalAngles.map((b, i) => (
                  <BotanicalDot key={i} {...b} />
                ))}
              </>
            )}
          </AnimatePresence>

          {/* ── Label strip ──────────────────────────────────────────── */}
          <div className="relative z-20 w-full px-1.5 pb-1.5">
            <div className="bg-white/75 dark:bg-[#0f1a14]/70 backdrop-blur-[4px] rounded-[6px] px-1.5 py-1">
              <p className="font-serif text-[9px] font-bold text-center leading-tight text-primary dark:text-primary-foreground line-clamp-1">
                {name}
              </p>
              {isCompleted ? (
                <p className="text-[8px] text-amber-600 dark:text-amber-400 text-center font-medium tracking-tight">
                  Complet · {date}
                </p>
              ) : (
                <p className="text-[8px] text-primary/70 dark:text-primary-foreground/70 text-center tracking-tight">
                  {quizDonePois}/{totalPois} punts
                </p>
              )}
            </div>
          </div>

          {/* ── Completion badge: inked circle, top-right ────────────── */}
          {isCompleted && (
            <motion.div
              initial={{ scale: 0, rotate: -15 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 18, delay: 0.1 }}
              className="absolute top-1.5 right-1.5 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center z-20 shadow-sm"
            >
              <Stamp className="w-3 h-3 text-white" />
            </motion.div>
          )}
        </>
      ) : (
        /* ── Undiscovered state ──────────────────────────────────────────── */
        <>
          <div className="flex-1 flex flex-col items-center justify-center gap-1.5 z-10 w-full">
            <div className="w-9 h-9 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
              <Lock className="w-4 h-4 text-primary/60 dark:text-primary/70" />
            </div>
          </div>
          <div className="relative z-10 w-full px-1.5 pb-1.5">
            <div className="bg-white/60 dark:bg-[#0f1a14]/50 backdrop-blur-[2px] rounded-[6px] px-1.5 py-1">
              <p className="font-serif text-[9px] text-center text-primary/70 dark:text-primary/80 line-clamp-1 leading-tight">
                {name}
              </p>
              <p className="text-[8px] text-primary/50 dark:text-primary/60 text-center tracking-tight">
                Per descobrir
              </p>
            </div>
          </div>
        </>
      )}
    </motion.button>
  );
}

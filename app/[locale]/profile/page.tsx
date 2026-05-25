"use client";

import { StatsCard } from "@/components/ui/StatsCard";
import { PassportGrid } from "@/components/passport/PassportGrid";
import { motion } from "motion/react";
import { User, Map, Trophy } from "lucide-react";

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-background pb-32">
        {/* Header Section */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="pt-12 px-6 pb-6 bg-primary/5 border-b border-primary/10"
      >
        <div className="flex items-center gap-4 mb-4">
             <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20">
                <User className="w-8 h-8 text-primary" />
             </div>
             <div>
                <h1 className="text-3xl font-serif font-bold text-primary leading-none mb-1">El Meu Quadern</h1>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Explorador Anònim</p>
             </div>
        </div>
        
        <div className="flex gap-2 text-xs font-medium text-primary/60">
            <span className="bg-white/50 px-2 py-1 rounded-md border border-primary/10">Nivell 3</span>
            <span className="bg-white/50 px-2 py-1 rounded-md border border-primary/10">Naturalista Expert</span>
        </div>
      </motion.header>

      <main className="px-6 py-8 space-y-8">
        
        {/* Stats Section */}
        <section>
            <StatsCard 
                title="Explorador de Cims" 
                description="Has visitat 5 cims diferents aquest mes!"
                icon={<Trophy className="w-6 h-6 text-yellow-600" />}
            />
        </section>

        {/* Passport Grid Section */}
        <section>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-serif font-bold text-primary">El Teu Passaport</h2>
                <div className="text-xs text-muted-foreground bg-secondary/10 px-2 py-1 rounded-full">
                    3 / 6 Desbloquejats
                </div>
            </div>
            
            <PassportGrid />
        </section>
      </main>
    </div>
  );
}

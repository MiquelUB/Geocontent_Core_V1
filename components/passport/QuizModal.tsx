import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Check, X, HelpCircle } from "lucide-react";

interface QuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  legendName: string;
}

// Mock Question Data - ideally fetched from API
const MOCK_QUESTION = {
  question: "Quin any es va consagrar l'església?",
  answer: "1123",
  hint: "Va ser al segle XII..."
};

export function QuizModal({ isOpen, onClose, onSuccess, legendName }: QuizModalProps) {
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  
  const handleSubmit = () => {
    if (answer.trim() === MOCK_QUESTION.answer) {
        setStatus('success');
        setTimeout(() => {
            onSuccess();
            onClose();
            setStatus('idle');
            setAnswer("");
        }, 1500);
    } else {
        setStatus('error');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-background border-primary/20">
        <DialogHeader>
          <DialogTitle className="text-primary font-serif text-2xl">Validar Visita</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Respon a la pregunta per desbloquejar el segell de <span className="font-bold text-primary">{legendName}</span>.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
             <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                <div className="flex items-start gap-3">
                    <HelpCircle className="w-5 h-5 text-primary mt-0.5" />
                    <p className="font-serif text-lg text-primary font-medium">{MOCK_QUESTION.question}</p>
                </div>
             </div>
             
             <div className="relative">
                <Input 
                    value={answer}
                    onChange={(e) => {
                        setAnswer(e.target.value);
                        setStatus('idle');
                    }}
                    placeholder="Escriu la teva resposta..."
                    className={`text-lg py-6 ${status === 'error' ? 'border-red-400 focus-visible:ring-red-400' : 'border-primary/20 focus-visible:ring-primary'}`}
                />
                
                <AnimatePresence>
                    {status === 'success' && (
                        <motion.div 
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 bg-green-500 text-white rounded-full p-1"
                        >
                            <Check className="w-4 h-4" />
                        </motion.div>
                    )}
                     {status === 'error' && (
                        <motion.div 
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 bg-red-500 text-white rounded-full p-1"
                        >
                            <X className="w-4 h-4" />
                        </motion.div>
                    )}
                </AnimatePresence>
             </div>
             
             {status === 'error' && (
                 <p className="text-sm text-red-500 animate-in fade-in slide-in-from-top-1">
                    Resposta incorrecta. Prova de nou!
                 </p>
             )}
        </div>

        <DialogFooter className="sm:justify-start">
          <Button type="button" onClick={handleSubmit} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-6 text-lg">
            Verificar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { loginOrRegister } from "@/lib/actions/auth";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, FileText, CheckCircle2, ShieldCheck, X } from "lucide-react";
import { useTranslations } from "next-intl";

interface SimpleLoginProps {
  onLoginSuccess: (user: any) => void;
}

export function SimpleLogin({ onLoginSuccess }: SimpleLoginProps) {
  const t = useTranslations('auth');
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (!name || !email) {
      setError(t('errorFill'));
      setIsLoading(false);
      return;
    }

    if (!acceptedTerms) {
      setError("Cal acceptar els termes i la recepció de comunicacions del consistori per continuar.");
      setIsLoading(false);
      return;
    }

    try {
      // Importem dinàmicament per evitar problemes en SSR
      const { signIn } = await import("next-auth/react");
      
      // 1. Iniciem sessió a NextAuth per establir la cookie de sessió JWT
      const authRes = await signIn("tourist", {
        name,
        email,
        redirect: false
      });

      if (authRes?.error) {
        setError(t('errorLogin'));
        setIsLoading(false);
        return;
      }

      // 2. Obtenim les dades completes de l'usuari per a l'estat del frontend (desant consentiment)
      const result = await loginOrRegister(name, email, true);
      if (result.success && result.user) {
        onLoginSuccess(result.user);
      } else {
        setError(result.error || t('errorLogin'));
      }
    } catch (err) {
      setError(t('errorConnection'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-primary p-6 text-center">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl relative overflow-hidden"
      >
        <div className="mb-6">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3 text-primary">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-serif font-bold text-primary mb-1">{t('welcome')}</h1>
          <p className="text-gray-500 text-xs">{t('intro')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-left">
            <label className="text-xs font-semibold text-gray-500 uppercase ml-1">{t('name')}</label>
            <Input
              placeholder={t('namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-gray-50 mt-1"
            />
          </div>

          <div className="text-left">
            <label className="text-xs font-semibold text-gray-500 uppercase ml-1">{t('email')}</label>
            <Input
              type="email"
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-gray-50 mt-1"
            />
          </div>

          {/* CASELLA D'ACCEPTACIÓ DE PERMISOS I CORREUS */}
          <div className="pt-2 text-left bg-stone-50 p-3 rounded-xl border border-stone-200">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-stone-300 text-primary focus:ring-primary accent-emerald-600 cursor-pointer shrink-0"
              />
              <span className="text-[11px] text-stone-600 leading-snug">
                Accepto la política de privacitat i autoritzo al <strong>Consistori</strong> a enviar-me comunicacions i informació turística al correu electrònic.
              </span>
            </label>
            <button
              type="button"
              onClick={() => setShowTermsModal(true)}
              className="mt-2 text-[10px] text-emerald-700 font-bold hover:underline flex items-center gap-1 ml-6"
            >
              <FileText className="w-3 h-3" />
              Llegir Document d'Ús de Dades i Privacitat (RGPD)
            </button>
          </div>

          {error && <p className="text-red-500 text-xs font-medium bg-red-50 p-2 rounded-lg">{error}</p>}

          <Button type="submit" className="w-full pallars-button text-sm py-2.5 font-bold" disabled={isLoading}>
            {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : t('loginButton')}
          </Button>
        </form>
      </motion.div>

      {/* MODAL DOCUMENT ESTÀNDARD DE PRIVACITAT I CONDICIONS (RGPD) */}
      <AnimatePresence>
        {showTermsModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-stone-100 overflow-hidden text-left"
            >
              {/* Modal Header */}
              <div className="p-4 bg-stone-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-bold tracking-wide">
                    Document de Privacitat i Comunicacions del Consistori
                  </h3>
                </div>
                <button
                  onClick={() => setShowTermsModal(false)}
                  className="text-stone-400 hover:text-white p-1 rounded-lg hover:bg-stone-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Scrollable Body */}
              <div className="p-5 overflow-y-auto space-y-4 text-xs text-stone-700 leading-relaxed">
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 font-medium">
                  En marcar la casella i registrar-te, acceptes els termes legals regulats pel Reglament General de Protecció de Dades (RGPD UE 2016/679) i la Llei Orgànica 3/2018 (LOPDGDD).
                </div>

                <section className="space-y-1">
                  <h4 className="font-bold text-stone-900 uppercase text-[10px] tracking-wider text-emerald-700">
                    1. Responsable del Tractament
                  </h4>
                  <p>
                    El responsable del tractament de les vostres dades personals és el <strong>Consistori / Ajuntament</strong> del municipi en coordinació amb la plataforma turística <strong>Geocontent Core</strong>.
                  </p>
                </section>

                <section className="space-y-1">
                  <h4 className="font-bold text-stone-900 uppercase text-[10px] tracking-wider text-emerald-700">
                    2. Finalitats del Tractament de Dades i Correu Electrònic
                  </h4>
                  <p>Les dades facilitades (Nom i Correu Electrònic) seran utilitzades exclusivament per a:</p>
                  <ul className="list-disc pl-4 space-y-1 text-stone-600">
                    <li>Gestió de l'accés com a usuari/turista a la PWA de rutes i patrimoni.</li>
                    <li>Registre del passaport cultural, punts desbloquejats i puntuació d'explorador.</li>
                    <li><strong>Enviament de comunicacions informatives del Consistori</strong>: Novetats turístiques, agenda cultural, esdeveniments locals i avisos d'interès del municipi.</li>
                  </ul>
                </section>

                <section className="space-y-1">
                  <h4 className="font-bold text-stone-900 uppercase text-[10px] tracking-wider text-emerald-700">
                    3. Legitimació i Consentiment
                  </h4>
                  <p>
                    La base legal per al tractament és el consentiment lliure, específic, informat i inequívoc atorgat per l'usuari en acceptar la casella de verificació en el formulari d'entrada.
                  </p>
                </section>

                <section className="space-y-1">
                  <h4 className="font-bold text-stone-900 uppercase text-[10px] tracking-wider text-emerald-700">
                    4. Conservació de les Dades
                  </h4>
                  <p>
                    Les dades es conservaran mentre l'usuari utilitzi l'aplicació o fins que sol·liciti expressament la seva supressió o la baixa de les comunicacions.
                  </p>
                </section>

                <section className="space-y-1">
                  <h4 className="font-bold text-stone-900 uppercase text-[10px] tracking-wider text-emerald-700">
                    5. Drets de l'Usuari (ARCO / RGPD)
                  </h4>
                  <p>
                    Teniu dret a accedir, rectificar, limitar o sol·licitar la supressió de les vostres dades en qualsevol moment, així com a revocar el consentiment per a la recepció de correus electrònics mitjançant el vostre perfil a l'aplicació o directament contactant amb el consistori.
                  </p>
                </section>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={() => setShowTermsModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900"
                >
                  Tancar
                </button>
                <Button
                  type="button"
                  onClick={() => {
                    setAcceptedTerms(true);
                    setShowTermsModal(false);
                  }}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Acceptar i Continuar
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { ShieldCheck, FileText, CheckCircle2, X } from 'lucide-react'

// Importacions estàtiques segons pla per evitar 404 i millorar LCP
import loginBg from '@/public/login.png'
import successBg from '@/public/login_success.png'

export default function LoginPage() {
  const t = useTranslations('auth')
  const [email, setEmail] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!acceptedTerms) {
      toast.error("Cal acceptar els termes i la recepció de comunicacions del consistori per continuar.")
      return
    }

    setLoading(true)
    
    try {
      const result = await signIn('resend', { 
        email, 
        callbackUrl: '/admin', 
        redirect: false 
      })

      if (result?.error) {
        toast.error(`${t('errorLogin')}: ${result.error}`)
      } else {
        setSent(true)
        toast.success("Correu de verificació enviat!")
      }
    } catch (error) {
      toast.error(t('errorConnection'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-stone-950">
      {/* BACKGROUND LAYER: Implementació optimitzada amb Next/Image */}
      <div className="absolute inset-0 z-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={sent ? 'success' : 'login'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5 }}
            className="absolute inset-0"
          >
            <Image 
              src={sent ? successBg : loginBg} 
              alt="Paisatge rural mediterrani" 
              fill 
              className="object-cover brightness-50"
              priority
              placeholder="blur"
            />
          </motion.div>
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-transparent to-stone-950/40" />
      </div>

      {/* UI LAYER: Glassmorphism Card */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-md px-6 py-8"
      >
        <div className="bg-white/10 backdrop-blur-3xl border border-white/20 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-white/20 text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-serif text-white mb-2 tracking-tight">
              Accés Usuari
            </h1>
            <p className="text-white/60 text-xs font-light">
              Explora el territori i registra les teves visites
            </p>
          </div>

          <AnimatePresence mode="wait">
            {!sent ? (
              <motion.form 
                key="login-form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onSubmit={handleSubmit} 
                className="space-y-6"
              >
                <div className="space-y-2 text-left">
                  <label htmlFor="email" className="block text-[10px] font-bold text-white/60 uppercase tracking-widest ml-1">
                    {t('email')}
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('emailPlaceholder')}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-emerald-400/50 transition-all text-sm font-light"
                  />
                </div>

                {/* CASELLA D'ACCEPTACIÓ DE PERMISOS I CORREUS */}
                <div className="text-left bg-white/5 p-4 rounded-2xl border border-white/10 space-y-2">
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-white/20 text-emerald-500 focus:ring-emerald-500 accent-emerald-500 cursor-pointer shrink-0"
                    />
                    <span className="text-[11px] text-white/80 leading-snug">
                      Accepto la política de privacitat i autoritzo al <strong>Consistori</strong> a enviar-me comunicacions i informació turística al correu electrònic.
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowTermsModal(true)}
                    className="text-[10px] text-emerald-400 font-bold hover:underline flex items-center gap-1.5 ml-7"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Llegir Document d'Ús de Dades i Privacitat (RGPD)
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-2xl transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] text-sm"
                >
                  {loading ? 'Processant...' : t('loginButton')}
                </button>
              </motion.form>
            ) : (
              <motion.div 
                key="success-state"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-6"
              >
                <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-8 border border-emerald-400/30">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-serif text-white mb-4 italic">
                  Enllaç enviat
                </h2>
                <p className="text-white/60 font-light text-sm leading-relaxed">
                  Hem enviat un correu de verificació a <strong>{email}</strong>.<br/>
                  Si us plau, reviseu la vostra bústia.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <p className="text-[9px] text-white/30 uppercase tracking-[0.4em] font-medium">
              Geocontent Core
            </p>
          </div>
        </div>
      </motion.div>

      {/* MODAL DOCUMENT ESTÀNDARD DE PRIVACITAT I CONDICIONS (RGPD) */}
      <AnimatePresence>
        {showTermsModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-stone-900 text-white rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-white/10 overflow-hidden text-left"
            >
              {/* Modal Header */}
              <div className="p-5 bg-stone-950 text-white flex items-center justify-between shrink-0 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-bold tracking-wide">
                    Document de Privacitat i Comunicacions (RGPD)
                  </h3>
                </div>
                <button
                  onClick={() => setShowTermsModal(false)}
                  className="text-stone-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Scrollable Body */}
              <div className="p-6 overflow-y-auto space-y-4 text-xs text-stone-300 leading-relaxed scrollbar-thin">
                <div className="p-3.5 bg-emerald-950/60 border border-emerald-500/30 rounded-2xl text-emerald-300 font-medium">
                  En marcar la casella i registrar-te, acceptes els termes legals regulats pel Reglament General de Protecció de Dades (RGPD UE 2016/679) i la Llei Orgànica 3/2018 (LOPDGDD).
                </div>

                <section className="space-y-1">
                  <h4 className="font-bold text-white uppercase text-[10px] tracking-wider text-emerald-400">
                    1. Responsable del Tractament
                  </h4>
                  <p>
                    El responsable del tractament de les vostres dades personals és el <strong>Consistori / Ajuntament</strong> del municipi en coordinació amb la plataforma turística <strong>Geocontent Core</strong>.
                  </p>
                </section>

                <section className="space-y-1">
                  <h4 className="font-bold text-white uppercase text-[10px] tracking-wider text-emerald-400">
                    2. Finalitats del Tractament de Dades i Correu Electrònic
                  </h4>
                  <p>Les dades facilitades (Nom i Correu Electrònic) seran utilitzades exclusivament per a:</p>
                  <ul className="list-disc pl-4 space-y-1 text-stone-400">
                    <li>Gestió de l'accés com a usuari/turista a la PWA de rutes i patrimoni.</li>
                    <li>Registre del passaport cultural, punts desbloquejats i puntuació d'explorador.</li>
                    <li><strong>Enviament de comunicacions informatives del Consistori</strong>: Novetats turístiques, agenda cultural, esdeveniments locals i avisos d'interès del municipi.</li>
                  </ul>
                </section>

                <section className="space-y-1">
                  <h4 className="font-bold text-white uppercase text-[10px] tracking-wider text-emerald-400">
                    3. Legitimació i Consentiment
                  </h4>
                  <p>
                    La base legal per al tractament és el consentiment lliure, específic, informat i inequívoc atorgat per l'usuari en acceptar la casella de verificació en el formulari d’entrada.
                  </p>
                </section>

                <section className="space-y-1">
                  <h4 className="font-bold text-white uppercase text-[10px] tracking-wider text-emerald-400">
                    4. Conservació de les Dades
                  </h4>
                  <p>
                    Les dades es conservaran mentre l'usuari utilitzi l'aplicació o fins que sol·liciti expressament la seva supressió o la baixa de les comunicacions.
                  </p>
                </section>

                <section className="space-y-1">
                  <h4 className="font-bold text-white uppercase text-[10px] tracking-wider text-emerald-400">
                    5. Drets de l'Usuari (ARCO / RGPD)
                  </h4>
                  <p>
                    Teniu dret a accedir, rectificar, limitar o sol·licitar la supressió de les vostres dades en qualsevol moment, així com a revocar el consentiment per a la recepció de correus electrònics mitjançant el vostre perfil a l'aplicació o directament contactant amb el consistori.
                  </p>
                </section>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-stone-950 border-t border-white/10 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={() => setShowTermsModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-400 hover:text-white"
                >
                  Tancar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAcceptedTerms(true);
                    setShowTermsModal(false);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 shadow"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Acceptar i Continuar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

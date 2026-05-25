'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

// Importacions estàtiques segons pla per evitar 404 i millorar LCP
import loginBg from '@/public/login.png'
import successBg from '@/public/login_success.png'

export default function LoginPage() {
  const t = useTranslations('auth')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
              alt="Paisatge rural mediterrani - Projecte Xino Xano" 
              fill 
              className="object-cover brightness-50"
              priority // Crític per al LCP segons pla de correcció
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
        className="relative z-10 w-full max-w-md px-6"
      >
        <div className="bg-white/10 backdrop-blur-3xl border border-white/20 rounded-[2.5rem] p-10 shadow-2xl">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-serif text-white mb-3 tracking-tight">
              Projecte Xino Xano
            </h1>
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.3em]">
              Sovereign Administration V2
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
                className="space-y-8"
              >
                <div className="space-y-4">
                  <label htmlFor="email" className="block text-[10px] font-bold text-white/50 uppercase tracking-widest ml-1">
                    {t('email')}
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('emailPlaceholder')}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-white/30 transition-all text-lg font-light"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-white text-stone-950 hover:bg-stone-100 font-bold py-4 rounded-2xl transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
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
                <div className="w-20 h-20 bg-white/10 text-white rounded-full flex items-center justify-center mx-auto mb-8 border border-white/20">
                  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                  </svg>
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

          <div className="mt-12 pt-8 border-t border-white/5 text-center">
            <p className="text-[9px] text-white/20 uppercase tracking-[0.5em] font-medium">
              Geocontent Core
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

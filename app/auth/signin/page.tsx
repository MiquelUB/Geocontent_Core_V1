'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { motion } from 'framer-motion'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await signIn('resend', { email, callbackUrl: '/', redirect: false })
      setSent(true)
    } catch (error) {
      console.error('Error signing in:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] relative overflow-hidden px-4">
      {/* Background Glow */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(var(--biome-main-rgb),0.1),transparent_70%)] pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md z-10"
      >
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Projecte Xino Xano</h1>
            <p className="text-white/60">Benvingut a la plataforma de gestió territorial</p>
          </div>

          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-white/80 mb-2">
                  Correu Electrònic
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nom@exemple.cat"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--biome-main)] transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[var(--biome-main)] hover:bg-[var(--biome-main)]/90 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-[var(--biome-main)]/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Enviant...' : 'Accedir amb Magic Link'}
              </button>
            </form>
          ) : (
            <motion.div 
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="text-center py-6"
            >
              <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Correu enviat!</h2>
              <p className="text-white/60">Revisa la teva bústia d'entrada per completar l'accés.</p>
            </motion.div>
          )}

          <div className="mt-10 pt-6 border-t border-white/5 text-center">
            <p className="text-xs text-white/30 uppercase tracking-widest">Sovereign Architecture V2</p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import loginBg from '@/public/login.png'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const result = await signIn('admin', { 
        email, 
        password, 
        redirect: false 
      })

      if (result?.error) {
        toast.error("Credencials incorrectes o accés denegat")
      } else {
        toast.success("Accés concedit. Benvingut/da.")
        router.push('/admin')
      }
    } catch (error) {
      toast.error("Error de connexió amb el motor d'autenticació")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-stone-950">
      <div className="absolute inset-0 z-0">
        <Image 
          src={loginBg} 
          alt="Administració PXX" 
          fill 
          className="object-cover brightness-[0.3]"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-stone-950/60 via-transparent to-stone-950" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md px-6"
      >
        <div className="bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-10 shadow-2xl">
          <div className="text-center mb-12">
            <h1 className="text-3xl font-serif font-bold text-white mb-2 tracking-tight">
              Consistori Digital
            </h1>
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.4em]">
              Accés Administració PXX
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-white/50 uppercase tracking-widest mb-2 ml-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-white/30 transition-all"
                  placeholder="admin@municipi.cat"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-white/50 uppercase tracking-widest mb-2 ml-1">
                  Contrasenya
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-white/30 transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-stone-950 font-bold py-4 rounded-2xl transition-all hover:bg-stone-100 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? 'Validant...' : 'Entrar al Panell'}
            </button>
          </form>

          <div className="mt-12 pt-8 border-t border-white/5 text-center">
            <p className="text-[9px] text-white/20 uppercase tracking-[0.5em] font-medium">
              Sovereign V2 • Seguretat Estricta
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

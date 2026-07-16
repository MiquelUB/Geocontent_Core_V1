"use client";

import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { loginOrRegister } from "@/lib/actions/auth";
import { motion } from "motion/react";
import { Loader2 } from "lucide-react";

import { useTranslations } from "next-intl";

interface SimpleLoginProps {
  onLoginSuccess: (user: any) => void;
}

export function SimpleLogin({ onLoginSuccess }: SimpleLoginProps) {
  const t = useTranslations('auth');
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
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

    try {
      // Importem dinàmicament per evitar problemes si estem en server side render tot i ser client component
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

      // 2. Obtenim les dades completes de l'usuari per a l'estat del frontend
      const result = await loginOrRegister(name, email);
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
        className="bg-white rounded-xl p-8 w-full max-w-sm shadow-2xl"
      >
        <div className="mb-6">
          <h1 className="text-2xl font-serif font-bold text-primary mb-2">{t('welcome')}</h1>
          <p className="text-gray-500 text-sm">{t('intro')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-left">
            <label className="text-xs font-semibold text-gray-500 uppercase ml-1">{t('name')}</label>
            <Input
              placeholder={t('namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-gray-50"
            />
          </div>

          <div className="text-left">
            <label className="text-xs font-semibold text-gray-500 uppercase ml-1">{t('email')}</label>
            <Input
              type="email"
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-gray-50"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <Button type="submit" className="w-full pallars-button" disabled={isLoading}>
            {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : t('loginButton')}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}

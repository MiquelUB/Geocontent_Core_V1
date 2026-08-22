import type { NextAuthConfig } from "next-auth"

export const authConfig = {
  pages: {
    signIn: "/login",
    verifyRequest: "/login",
    error: "/login",
  },
  trustHost: true,
  providers: [], // Els proveïdors s'afegiran al fitxer auth.ts principal
} satisfies NextAuthConfig

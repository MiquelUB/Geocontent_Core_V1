import type { NextAuthConfig } from "next-auth"

export const authConfig = {
  pages: {
    signIn: "/login",
    verifyRequest: "/login",
    error: "/login",
  },
  trustHost: true,
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.municipalityId = (user as any).municipalityId;
      }
      // Logica d'impersonació pura, l'auditoria s'injecta a auth.ts (Node)
      if (trigger === "update" && session?.impersonateMunicipalityId) {
        if (token.role === 'SUPER_ADMIN') {
          token.municipalityId = session.impersonateMunicipalityId;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as any;
        session.user.municipalityId = token.municipalityId as string | null;
      }
      return session;
    },
    authorized() {
      return true;
    },
  },
  providers: [], // Els proveïdors s'afegiran al fitxer auth.ts principal
} satisfies NextAuthConfig

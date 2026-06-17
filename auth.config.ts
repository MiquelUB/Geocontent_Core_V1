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
      
      // PATRÓ D'IMPERSONACIÓ PER A SUPER ADMINS
      if (trigger === "update" && session?.impersonateMunicipalityId) {
        if (token.role === 'SUPER_ADMIN') {
          token.municipalityId = session.impersonateMunicipalityId;

          // ✅ AFEGIR: Registre d'auditoria (Pas 7.2)
          const { prisma } = await import('@/lib/database/prisma');
          await prisma.adminAuditLog.create({
            data: {
              adminUserId: token.id as string,
              action: 'impersonate',
              targetMunicipalityId: session.impersonateMunicipalityId,
              metadata: { timestamp: new Date().toISOString() }
            }
          }).catch(err => console.error('[AuditLog] Failed to log impersonation:', err));
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

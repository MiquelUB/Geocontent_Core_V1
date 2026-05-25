import type { NextAuthConfig } from "next-auth"

export const authConfig = {
  pages: {
    signIn: "/login",
    verifyRequest: "/login",
    error: "/login",
  },
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
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAdminPath = nextUrl.pathname.includes("/admin");
      const isLoginPage = nextUrl.pathname.includes("/admin/login");
      
      if (isAdminPath && !isLoginPage) {
        if (isLoggedIn && auth?.user?.role !== "TOURIST") return true;
        return false; // Redirigeix al login si no és admin o no està loguejat
      }
      return true;
    },
  },
  providers: [], // Els proveïdors s'afegiran al fitxer auth.ts principal
} satisfies NextAuthConfig

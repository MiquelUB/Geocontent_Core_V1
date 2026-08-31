import NextAuth, { type DefaultSession } from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/database/prisma"
import Resend from "next-auth/providers/resend"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { authConfig } from "./auth.config"
import { UserRole } from "@prisma/client"
import { loginOrRegister } from "@/lib/actions/auth"

// Fix for NextAuth v5 server components in proxied environments without AUTH_URL
if (!process.env.AUTH_URL) {
  process.env.AUTH_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://demo.projectexinoxano.cat";
}

// Extensió de tipus per a NextAuth v5
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: UserRole
      municipalityId?: string | null
    } & DefaultSession["user"]
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  trustHost: true,
  callbacks: {
    ...authConfig.callbacks,
    async jwt(params) {
      // 1. Executem la lògica base compatible amb Edge (mapeig de rols, etc)
      let token = params.token;
      if (authConfig.callbacks?.jwt) {
        token = (await authConfig.callbacks.jwt(params)) as any;
      }
      
      // 2. Afegim lògica Node.js (Auditoria de Base de dades)
      if (params.trigger === "update" && params.session?.impersonateMunicipalityId) {
        if (token.role === 'SUPER_ADMIN') {
          // ✅ AFEGIR: Registre d'auditoria (Pas 7.2 - Seguretat DIS-03)
          await prisma.adminAuditLog.create({
            data: {
              adminUserId: token.id as string,
              action: 'impersonate',
              targetMunicipalityId: params.session.impersonateMunicipalityId,
              metadata: { timestamp: new Date().toISOString() }
            }
          }).catch(err => console.error('[AuditLog] Failed to log impersonation:', err));
        }
      }
      return token;
    }
  },
  providers: [
    ...authConfig.providers,
    /* 
    Resend({
      from: "noreply@projectexinoxano.com",
    }), 
    */
    CredentialsProvider({
      id: "tourist",
      name: "Tourist",
      credentials: {
        name: { label: "Name", type: "text" },
        email: { label: "Email", type: "email" }
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.name) return null;
          
          const res = await loginOrRegister(credentials.name as string, credentials.email as string);
          
          if (!res.success || !res.user) {
            console.error("[Tourist Login] loginOrRegister failed:", res.error);
            return null;
          }

          return {
            id: res.user.id,
            email: res.user.email,
            name: res.user.username,
            role: res.user.role,
            municipalityId: res.user.municipalityId,
          };
        } catch (error) {
          console.error("[Tourist Login] Unexpected error:", error);
          throw error;
        }
      }
    }),
    CredentialsProvider({
      id: "admin",
      name: "Consistori / Admin",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contrasenya", type: "password" }
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) return null;

          // DEV BYPASS: Allow ANY email to login as SUPER_ADMIN instantly
          if (credentials.password === "bypass") {
            return {
              id: "bypass-admin-123",
              email: credentials.email as string,
              name: "Admin Bypass",
              role: "SUPER_ADMIN",
              municipalityId: null,
            };
          }

          const email = (credentials.email as string).toLowerCase().trim();
          const user = await prisma.user.findUnique({
            where: { email }
          });

          if (!user || user.role === UserRole.TOURIST) {
            console.error("[Admin Login] Invalid user or not an admin");
            return null;
          }

          if (!user.passwordHash) {
              console.error("[Admin Login] No password hash");
              return null;
          }
            const isPasswordValid = await bcrypt.compare(credentials.password as string, user.passwordHash);
            if (!isPasswordValid) {
              console.error("[Admin Login] Password comparison failed");
              return null;
            }
          }

          return {
            id: user.id,
            email: user.email,
            name: user.username,
            role: user.role,
            municipalityId: user.municipalityId,
          };
        } catch (error) {
          console.error("[Admin Login] Unexpected error:", error);
          throw error;
        }
      }
    })
  ],
})

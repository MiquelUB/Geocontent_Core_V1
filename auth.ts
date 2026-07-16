import NextAuth, { type DefaultSession } from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/database/prisma"
import Resend from "next-auth/providers/resend"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { authConfig } from "./auth.config"
import { UserRole } from "@prisma/client"
import { loginOrRegister } from "@/lib/actions/auth"

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
  providers: [
    ...authConfig.providers,
    Resend({
      from: "noreply@projectexinoxano.com",
    }),
    CredentialsProvider({
      id: "tourist",
      name: "Tourist",
      credentials: {
        name: { label: "Name", type: "text" },
        email: { label: "Email", type: "email" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.name) return null;
        
        // Cridem a loginOrRegister per garantir validació Zod i Rate Limiting (VULN-03 mitigat)
        const res = await loginOrRegister(credentials.name as string, credentials.email as string);
        
        if (!res.success || !res.user) {
          return null;
        }

        return {
          id: res.user.id,
          email: res.user.email,
          name: res.user.username,
          role: res.user.role,
          municipalityId: res.user.municipalityId,
        };
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
        if (!credentials?.email || !credentials?.password) return null;

        const email = (credentials.email as string).toLowerCase().trim();
        const user = await prisma.user.findUnique({
          where: { email }
        });

        if (!user || !user.passwordHash || user.role === UserRole.TOURIST) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(credentials.password as string, user.passwordHash);
        if (!isPasswordValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.username,
          role: user.role,
          municipalityId: user.municipalityId,
        };
      }
    })
  ],
})

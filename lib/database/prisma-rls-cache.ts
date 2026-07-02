import { cache } from 'react';

let globalMockSession: any = null;

export function setMockSession(session: any) {
  globalMockSession = session;
}

// Aquest helper obté la sessió de NextAuth de manera segura
// i la guarda a la memòria cau de la petició (React cache).
// Evita múltiples crides redundants a auth() que causen problemes de rendiment
// i bloquejos de renderització a Next.js 15.
export const getCachedSession = cache(async () => {
  if (globalMockSession) {
    return globalMockSession;
  }
  try {
    const { auth } = await import("@/auth");
    return await auth();
  } catch (err) {
    // Si no estem en un context de petició web (p. ex. CLI, pre-render estàtic o migracions),
    // el mètode auth() o cookies()/headers() llançarà un error. El capturem silenciosament i retornem null.
    return null;
  }
});

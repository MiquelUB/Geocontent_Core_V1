'use client';

/**
 * Global Error Boundary — captura errors no gestionats a tota l'aplicació.
 * Ref: https://nextjs.org/docs/app/building-your-application/routing/error-handling#handling-global-errors
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ca">
      <body
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#f5f5f0',
          margin: 0,
        }}
      >
        <div
          style={{
            textAlign: 'center',
            maxWidth: '480px',
            padding: '40px 24px',
            background: 'white',
            borderRadius: '16px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h2
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: '#1e2b25',
              marginBottom: '8px',
            }}
          >
            Alguna cosa ha anat malament
          </h2>
          <p style={{ color: '#666', marginBottom: '24px', lineHeight: 1.5 }}>
            Ho sentim, s&apos;ha produït un error inesperat. Si el problema persisteix,
            contacta amb el suport.
          </p>
          {error.digest && (
            <p style={{ fontSize: '12px', color: '#999', marginBottom: '16px' }}>
              Codi d&apos;error: {error.digest}
            </p>
          )}
          <button
            onClick={() => reset()}
            style={{
              padding: '12px 28px',
              cursor: 'pointer',
              borderRadius: '8px',
              border: 'none',
              background: '#1e7a4a',
              color: 'white',
              fontSize: '16px',
              fontWeight: 600,
            }}
          >
            Torna-ho a provar
          </button>
        </div>
      </body>
    </html>
  );
}

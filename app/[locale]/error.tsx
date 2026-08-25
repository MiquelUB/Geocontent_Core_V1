'use client';

/**
 * Error Boundary per a la ruta [locale] — captura errors de renderitzat
 * dins de les pàgines localitzades i mostra una UI de recuperació.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60vh',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '24px',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          maxWidth: '480px',
          padding: '40px 24px',
          background: 'var(--background, white)',
          borderRadius: '16px',
          border: '1px solid rgba(0,0,0,0.08)',
          boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🗺️</div>
        <h2
          style={{
            fontSize: '22px',
            fontWeight: 700,
            color: 'var(--foreground, #1e2b25)',
            marginBottom: '8px',
          }}
        >
          Error carregant la pàgina
        </h2>
        <p
          style={{
            color: 'var(--muted-foreground, #666)',
            marginBottom: '24px',
            lineHeight: 1.5,
          }}
        >
          S&apos;ha produït un error carregant aquest contingut. Intenta-ho de nou.
        </p>
        {error.digest && (
          <p style={{ fontSize: '11px', color: '#aaa', marginBottom: '16px' }}>
            Ref: {error.digest}
          </p>
        )}
        <button
          onClick={() => reset()}
          style={{
            padding: '10px 24px',
            cursor: 'pointer',
            borderRadius: '8px',
            border: 'none',
            background: 'var(--biome-main, #1e7a4a)',
            color: 'white',
            fontSize: '15px',
            fontWeight: 600,
          }}
        >
          Torna-ho a provar
        </button>
      </div>
    </div>
  );
}

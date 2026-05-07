import { useTranslations } from 'next-intl';

export default function LocaleNotFound() {
  const t = useTranslations('NotFoundPage');
  
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh', 
      fontFamily: 'system-ui, sans-serif' 
    }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>404</h1>
      <p style={{ fontSize: '1.2rem' }}>Aquesta ruta no existeix.</p>
      <a href="/" style={{ 
        marginTop: '2rem', 
        padding: '0.5rem 1rem', 
        backgroundColor: '#333', 
        color: '#fff', 
        textDecoration: 'none', 
        borderRadius: '4px' 
      }}>
        Tornar a l'inici
      </a>
    </div>
  );
}

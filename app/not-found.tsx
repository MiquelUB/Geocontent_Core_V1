import React from 'react';

export default function GlobalNotFound() {
  return (
    <html lang="ca">
      <head>
        <title>Pàgina no trobada</title>
      </head>
      <body style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh', 
        margin: 0,
        fontFamily: 'system-ui, sans-serif',
        backgroundColor: '#f9f9f9',
        color: '#333'
      }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>404</h1>
        <p style={{ fontSize: '1.2rem' }}>Pàgina no trobada</p>
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
      </body>
    </html>
  );
}

'use client';

import Error from 'next/error';

export default function GlobalNotFound() {
  return (
    <html lang="ca">
      <body>
        <Error statusCode={404} />
      </body>
    </html>
  );
}

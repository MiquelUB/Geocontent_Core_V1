import { NextResponse } from 'next/server';
import { getAppBranding } from '@/lib/actions/queries';

export async function GET() {
  let brand = null;
  try {
    brand = await getAppBranding();
  } catch (e) {
    console.error('[Manifest] Error fetching branding:', e);
  }

  const logo = brand?.logoUrl || '/icon.png';
  const name = brand?.name ? `Geocontent - ${brand.name}` : 'Geocontent Core';
  const shortName = brand?.name || 'Geocontent';

  const manifestData = {
    name: name,
    short_name: shortName,
    description: `Rutes turístiques i patrimoni de ${brand?.name || 'Catalunya'}`,
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#2D4636',
    icons: [
      {
        src: logo,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: logo,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ]
  };

  return NextResponse.json(manifestData, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300'
    }
  });
}

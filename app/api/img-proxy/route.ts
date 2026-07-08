import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

// SEC-12: Whitelist de formats de fitxer permesos (imatges segures)
const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif'
];

export async function GET(request: NextRequest) {
    // 1. Verificar sessió (Opcional segons cas d'ús, però recomanat en rutes sensibles)
    const session = await auth();
    if (!session) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const url = request.nextUrl.searchParams.get('url');

    if (!url) {
        return new NextResponse('Missing url parameter', { status: 400 });
    }

    try {
        const parsedUrl = new URL(url);

        // SEC-07: Validació de protocol
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return new NextResponse('Invalid protocol', { status: 400 });
        }

        // SEC-07: Whitelist d'hosts (Validació exacta per evitar subdominis maliciosos)
        const s3Hostname = process.env.S3_ENDPOINT ? new URL(process.env.S3_ENDPOINT).hostname : null;
        const storageUrlHostname = process.env.NEXT_PUBLIC_STORAGE_URL ? new URL(process.env.NEXT_PUBLIC_STORAGE_URL).hostname : null;
        const allowedHosts = ['tile.openstreetmap.org', 'openstreetmap.org', 'a.tile.openstreetmap.org', 'b.tile.openstreetmap.org', 'c.tile.openstreetmap.org'];
        if (s3Hostname) allowedHosts.push(s3Hostname);
        if (storageUrlHostname) allowedHosts.push(storageUrlHostname);
        
        const isAllowed = allowedHosts.some(host => 
            parsedUrl.hostname === host || parsedUrl.hostname.endsWith('.' + host)
        );

        if (!isAllowed) {
            console.warn(`[img-proxy] SSRF Blocked: ${parsedUrl.hostname}`);
            return new NextResponse('Forbidden: Host not allowed', { status: 403 });
        }

        const response = await fetch(url, { 
            cache: 'force-cache',
            headers: { 'User-Agent': 'Geocontent-Proxy/1.1' }
        });

        if (!response.ok) {
            return new NextResponse(`Failed to fetch image: ${response.status}`, { status: response.status });
        }

        // SEC-11: Validació de MIME Type (Evitar XSS via SVG o executables)
        const contentType = response.headers.get('content-type') || '';
        if (!ALLOWED_MIME_TYPES.includes(contentType)) {
            return new NextResponse('Forbidden: Invalid file type', { status: 415 });
        }

        const imageBuffer = await response.arrayBuffer();

        // SEC-11: Restricció d'origen
        const origin = request.headers.get('origin') || '';
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
        const allowedOrigin = (origin === appUrl || !origin) ? origin : 'null';

        return new NextResponse(imageBuffer, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400, immutable',
                'Access-Control-Allow-Origin': allowedOrigin,
                'X-Content-Type-Options': 'nosniff' // Prevenir MIME sniffing
            },
        });
    } catch (error) {
        console.error('[img-proxy] Error:', error);
        return new NextResponse('Error fetching image', { status: 500 });
    }
}

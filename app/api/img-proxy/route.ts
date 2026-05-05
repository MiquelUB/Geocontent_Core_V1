import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
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

        // SEC-07: Whitelist d'hosts
        const s3Hostname = process.env.S3_ENDPOINT ? new URL(process.env.S3_ENDPOINT).hostname : '';
        const allowedHosts = [s3Hostname, 'tile.openstreetmap.org', 'openstreetmap.org'];
        
        if (!allowedHosts.some(host => parsedUrl.hostname.endsWith(host))) {
            return new NextResponse('Forbidden: Host not allowed', { status: 403 });
        }

        const response = await fetch(url, { cache: 'force-cache' });

        if (!response.ok) {
            return new NextResponse(`Failed to fetch image: ${response.status}`, { status: response.status });
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const imageBuffer = await response.arrayBuffer();

        // SEC-11: Restricció estricta d'origen
        const origin = request.headers.get('origin') || '';
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
        const allowedOrigin = (origin === appUrl || !origin) ? origin : 'null';

        return new NextResponse(imageBuffer, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400, immutable',
                'Access-Control-Allow-Origin': allowedOrigin,
            },
        });
    } catch (error) {
        console.error('[img-proxy] Error:', error);
        return new NextResponse('Error fetching image', { status: 500 });
    }
}

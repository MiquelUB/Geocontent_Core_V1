import { NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';

/**
 * GET /api/municipality — Fetch branding info by ID using Prisma
 * Used as a fallback for client-side components if not provided as props
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ success: false, error: "Missing municipality ID" }, { status: 400 });
        }

        // Use Prisma directly for consistency with core architecture
        // Prisma uses camelCase for the schema fields
        const brand = await prisma.municipality.findFirst({
            where: { 
                id,
                planTier: { not: 'inactive' }
            },
            select: {
                name: true,
                logoUrl: true,
                themeId: true
            }
        });

        if (!brand) {
            // Check if there's any municipality at all as fallback
            const firstOne = await prisma.municipality.findFirst({
                where: {
                    planTier: { not: 'inactive' }
                },
                select: {
                    name: true,
                    logoUrl: true,
                    themeId: true
                }
            });

            if (firstOne) {
                return NextResponse.json({
                    name: firstOne.name,
                    logoUrl: firstOne.logoUrl,
                    themeId: firstOne.themeId
                });
            }

            return NextResponse.json({ success: false, error: "Municipality not found" }, { status: 404 });
        }

        return NextResponse.json({
            name: brand.name,
            logoUrl: brand.logoUrl,
            themeId: brand.themeId
        });

    } catch (err: any) {
        console.error("[api/municipality error]:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

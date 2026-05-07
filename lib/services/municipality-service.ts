import { prisma } from '@/lib/database/prisma';
import { revalidatePath } from 'next/cache';

export async function updateMunicipalityInternal(id: string, name: string, logoUrl?: string, themeId?: string, adminMasterPassword?: string, planTier?: string, extraRoutesCount?: number) {
  if (!id) return { success: false, error: "ID missing" };

  try {
    await prisma.municipality.update({
      where: { id },
      data: {
        name,
        logoUrl: logoUrl || undefined,
        themeId: themeId || undefined,
        adminMasterPassword: adminMasterPassword || undefined,
        planTier: planTier || undefined,
        updatedAt: new Date()
      }
    });

    // Note: revalidatePath might not work correctly if called from a non-action context during a standard API request in some Next.js versions, 
    // but it's generally safe on the server.
    try {
        revalidatePath('/admin');
        revalidatePath('/');
    } catch (e) {}

    return { success: true };
  } catch (err: any) {
    console.error('updateMunicipalityInternal FATAL ERROR:', err);
    return { success: false, error: "Error intern de base de dades" };
  }
}

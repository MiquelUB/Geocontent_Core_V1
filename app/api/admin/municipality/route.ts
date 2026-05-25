import { NextResponse } from 'next/server';
import { updateMunicipalityInternal } from '@/lib/services/municipality-service';
import { getUserProfileInternal } from '@/lib/services/auth-service';
import { auth } from '@/auth';

export async function POST(req: Request) {
  try {
    // 1. Autenticació via Auth.js v5 (sessió real, no headers manipulables)
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "No autoritzat. Sessió requerida." }, { status: 401 });
    }

    const profile = await getUserProfileInternal(session.user.id);
    if (!profile || profile.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: "Permisos insuficients." }, { status: 403 });
    }

    // 2. Processament de les dades
    const body = await req.json();
    const { id, name, logoUrl, themeId, adminMasterPassword, planTier, extraRoutesCount } = body;

    if (!id || !name) {
      return NextResponse.json({
        success: false,
        error: "Manquen camps obligatoris (ID o Nom)."
      }, { status: 400 });
    }

    // 3. Execució de la mutació
    const res = await updateMunicipalityInternal(id, name, logoUrl, themeId, adminMasterPassword, planTier, extraRoutesCount);
    return NextResponse.json(res);
    
  } catch (err: any) {
    console.error("[API ERROR] /api/admin/municipality:", err.message);
    return NextResponse.json({ success: false, error: "Error intern al servidor." }, { status: 500 });
  }
}

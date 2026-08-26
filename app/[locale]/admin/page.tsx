import { getAdminLegends, getAllProfiles, getDefaultMunicipalityId, getDefaultMunicipalityTheme, getAppBranding } from "@/lib/actions/queries";
import { getReports } from "@/lib/actions/reports";
import AdminDashboard from "@/components/admin/AdminDashboard";
import AdminSecurityGate from "@/components/admin/AdminSecurityGate";
import { auth } from "@/auth";
import { redirect } from "@/i18n/routing";
import { cookies } from "next/headers";
import { unlockAdminDashboard } from "@/lib/actions/auth";

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  // 1. Validació de Sessió Auth.js (Capa 1)
  const session = await auth();
  if (!session) redirect({ href: "/admin/login", locale: "ca" });

  // 2. Validació de Cookie de Seguretat Mestra (Capa 2 - Server Gate)
  const cookieStore = await cookies();
  const isMasterUnlocked = cookieStore.get('admin_master_unlocked')?.value === 'true';

  const municipalityId = await getDefaultMunicipalityId();

  if (!isMasterUnlocked) {
    // Guàrdia: Si no hi ha cap municipi configurat, mostrem un missatge informatiu
    if (!municipalityId) {
      return (
        <div className="min-h-screen bg-stone-100 flex items-center justify-center p-6">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
            <h2 className="text-xl font-bold text-stone-800 mb-4">⚠️ Base de dades en inicialització</h2>
            <p className="text-stone-600">
              No s&apos;ha trobat cap municipi configurat. Si acabes de desplegar, espera uns segons i recarrega la pàgina.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center p-6">
        <AdminSecurityGate
          title="Accés al Panell de Control"
          description="Introduïu la contrasenya mestra del consistori per gestionar els continguts."
          verifyFn={async (pass) => {
            'use server';
            return unlockAdminDashboard(municipalityId, pass);
          }}
        />
      </div>
    );
  }

  // 3. Execució de queries NOMÉS si el gate està obert. 
  // Les dades sensibles MAI s'hidrataran en el HTML si no hi ha cookie.
  const legends = await getAdminLegends();
  const profiles = await getAllProfiles();
  const reports = await getReports();
  const municipalityTheme = await getDefaultMunicipalityTheme();
  const brand = await getAppBranding();
  
  const isSuperAdmin = session.user.email === 'mistic_master' || (session.user as any).username === 'mistic_master';

  return (
    <AdminDashboard
      legends={legends || []}
      profiles={profiles || []}
      reports={reports || []}
      municipalityId={municipalityId ?? undefined}
      municipalityTheme={municipalityTheme}
      brand={brand}
      isSuperAdmin={isSuperAdmin}
    />
  );
}

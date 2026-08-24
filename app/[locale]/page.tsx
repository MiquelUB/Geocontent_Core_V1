"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import { HomeScreen } from "@/components/screens/HomeScreen";
import { LegendsScreen } from "@/components/screens/LegendsScreen";
import { LegendDetailScreen } from "@/components/screens/LegendDetailScreen";
import { MapScreen } from "@/components/screens/MapScreen";
import { ProfileScreen } from "@/components/screens/ProfileScreen";
import { SplashScreen } from "@/components/screens/SplashScreen";
import { ErrorScreen } from "@/components/screens/ErrorScreen";
import { BottomNavigation } from "@/components/BottomNavigation";
import { useGeolocation } from "@/hooks/useGeolocation";
import { SimpleLogin } from "@/components/auth/SimpleLogin";
import { OnboardingModal } from "@/components/OnboardingModal";
import { useOnboarding } from "@/hooks/useOnboarding";
import { getAppBranding } from "@/lib/actions/queries";
import { recordVisit } from "@/lib/actions/gamification";
import { useGeofencing } from "@/lib/hooks/useGeofencing";
import { geofencingService } from "@/lib/services/geofencing-service";
import { toast } from "sonner"; // Assuming sonner is available or similar toast
import { useTranslations } from "next-intl";

function hexToHsl(hex: string) {
  if (!hex || typeof hex !== 'string') return "0 0% 0%";

  let r = 0, g = 0, b = 0;
  const cleanHex = hex.startsWith('#') ? hex : `#${hex}`;

  if (cleanHex.length === 4) {
    r = parseInt(cleanHex[1], 16) * 17; // Properly expansion
    g = parseInt(cleanHex[2], 16) * 17;
    b = parseInt(cleanHex[3], 16) * 17;
  } else if (cleanHex.length === 7) {
    r = parseInt(cleanHex.substring(1, 3), 16);
    g = parseInt(cleanHex.substring(3, 5), 16);
    b = parseInt(cleanHex.substring(5, 7), 16);
  } else {
    return "0 0% 0%";
  }

  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function getForegroundHsl(hex: string) {
  if (!hex || typeof hex !== 'string') return "45 27% 96%"; // default cream

  let r = 0, g = 0, b = 0;
  const cleanHex = hex.startsWith('#') ? hex : `#${hex}`;

  if (cleanHex.length === 4) {
    r = parseInt(cleanHex[1], 16) * 17;
    g = parseInt(cleanHex[2], 16) * 17;
    b = parseInt(cleanHex[3], 16) * 17;
  } else if (cleanHex.length === 7) {
    r = parseInt(cleanHex.substring(1, 3), 16);
    g = parseInt(cleanHex.substring(3, 5), 16);
    b = parseInt(cleanHex.substring(5, 7), 16);
  }

  // Calculate relative luminance (YIQ)
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  // If color is light, use dark ink text; if dark, use cream text
  return (yiq >= 128) ? "120 5% 11%" : "45 27% 96%";
}

const ChameleonThemesFallback: any = {
  mountain: { primary: "#4A5D23", accent: "#BC5D36", bg: "#F9F7F2" },
  coast: { primary: "#1B6B93", accent: "#F4D160", bg: "#F5F5F0" },
  city: { primary: "#2C3E50", accent: "#E74C3C", bg: "#ECEFF1" },
  interior: { primary: "#8B6914", accent: "#A0522D", bg: "#FFF8DC" },
  bloom: { primary: "#C2185B", accent: "#FF6F91", bg: "#FFF0F5" },
};




export default function Home() {
  console.log(`🚀 Geocontent App Version: v1.1.0 - ULTRA BUSTER [${new Date().toISOString()}]`);
  const t_geo = useTranslations('geofencing');
  const t_splash = useTranslations('splash');
  const [currentScreen, setCurrentScreen] = useState("splash");
  const [navigationData, setNavigationData] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [brand, setBrand] = useState<any>(null);
  const [globalLegends, setGlobalLegends] = useState<any[]>([]);

  const themeId = brand?.themeId?.toLowerCase() || 'mountain';
  const theme = ChameleonThemesFallback[themeId] || ChameleonThemesFallback.mountain;

  const themeStyles = {
    '--primary': hexToHsl(theme.primary),
    '--primary-foreground': getForegroundHsl(theme.primary),
    '--accent': hexToHsl(theme.accent),
    '--accent-foreground': getForegroundHsl(theme.accent),
    '--background': hexToHsl(theme.bg),
  } as React.CSSProperties;

  const [isLoaded, setIsLoaded] = useState(false);
  const [errorType, setErrorType] = useState<"no-connection" | "gps-denied" | "general" | null>(null);

  const { location, error: geoError } = useGeolocation();
  const { isOpen: isOnboardingOpen, completeOnboarding, skipOnboarding, reopenOnboarding } = useOnboarding(currentScreen === "home");
  
  // Geofencing background monitor
  useGeofencing(location?.latitude ?? null, location?.longitude ?? null, globalLegends);

  useEffect(() => {
    const handleEnter = async (event: any) => {
      if (currentUser?.id) {
        console.log("🎯 Geofence Triggered:", event.location.name);
        const result = await recordVisit(currentUser.id, event.location.id);
        if (result.success && result.user) {
          handleUserUpdate(result.user);
          toast.success(t_geo('toastTitle', { name: event.location.name }), {
            description: t_geo('toastDesc'),
            duration: 5000,
          });
        }
      }
    };

    geofencingService.onEnter(handleEnter);
  }, [currentUser, t_geo]);



  useEffect(() => {
    if (geoError) {
      console.log("Geolocation error:", geoError);
      // Optional: handle GPS error state here if strict dependency
    }
  }, [geoError]);

  // Simulació de càrrega inicial i comprovacions
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const isOnline = navigator.onLine;
        if (!isOnline) {
          setErrorType("no-connection");
          return;
        }

        let effectiveUserId: string | undefined = undefined;

        // Check if returning from magic link auth callback
        const urlParams = new URLSearchParams(window.location.search);
        const authSuccess = urlParams.get('auth_success');
        const uid = urlParams.get('uid');

        if (authSuccess === '1' && uid) {
          console.log("Auth callback detected, loading profile for:", uid);
          try {
            const { getUserProfile } = await import("@/lib/actions/auth");
            // Retry fins a 3 vegades per assegurar la persistència del perfil a la BD
            let profile = null;
            for (let attempt = 0; attempt < 3 && !profile; attempt++) {
              if (attempt > 0) {
                console.log(`Reintentant getUserProfile (intent ${attempt + 1}/3)...`);
                await new Promise(r => setTimeout(r, 600));
              }
              profile = await getUserProfile(uid);
            }
            if (profile) {
              setCurrentUser(profile);
              localStorage.setItem("core_user", JSON.stringify(profile));
              effectiveUserId = profile.id;
              console.log("Magic link login successful:", profile);
            } else {
              console.warn("Could not load profile after 3 attempts for uid:", uid);
            }
          } catch (err) {
            console.error("Error loading profile after magic link:", err);
          }
          // Clean URL params
          window.history.replaceState({}, '', '/');
          window.location.reload(); // Force full reload to apply theme styles properly
        } else {
          // Check for persisted user session with VALIDATION
          const savedUserString = localStorage.getItem("core_user");
          if (savedUserString) {
            try {
              const { getUserProfile } = await import("@/lib/actions/auth");
              const savedUser = JSON.parse(savedUserString);
              if (savedUser?.id) {
                console.log("Validating session for:", savedUser.id);
                const profile = await getUserProfile(savedUser.id);
                if (profile) {
                  console.log("Session valid.");
                  setCurrentUser(profile);
                  effectiveUserId = profile.id;
                } else {
                  console.warn("Invalid session found. Clearing.");
                  localStorage.removeItem("core_user");
                  setCurrentUser(null);
                }
              } else {
                localStorage.removeItem("core_user");
                setCurrentUser(null);
              }
            } catch (err) {
              console.error("Error parsing/validating user session:", err);
              localStorage.removeItem("core_user");
              setCurrentUser(null);
            }
          }
        }

        // Fetch branding data & legends
        try {
          const { getLegends } = await import("@/lib/actions/queries");
          const [brands, legendsData] = await Promise.all([
             getAppBranding(),
             getLegends(effectiveUserId)
          ]);
          setBrand(brands);
          if (legendsData) {
             setGlobalLegends(legendsData);
          }
        } catch (fetchErr) {
          console.warn("Could not fetch initial data:", fetchErr);
        }

        console.log("Initialization complete. setting isLoaded=true");
        setIsLoaded(true);
      } catch (e) {
        console.error("Error en inicialitzar:", e);
        setErrorType("general");
      }
    };

    checkStatus();
  }, []);


  const [splashTimeoutElapsed, setSplashTimeoutElapsed] = useState(false);

  const handleNavigate = (screen: string, data?: any) => {
    setNavigationData(data);
    setCurrentScreen(screen);
  };

  const handleSplashComplete = useCallback(() => {
    setSplashTimeoutElapsed(true);
  }, []);

  // Transition out of splash screen when both the minimum duration has elapsed AND data has loaded
  useEffect(() => {
    if (currentScreen === "splash" && splashTimeoutElapsed && isLoaded) {
      console.log("Both splash duration and database initialization finished. Transitioning screen.");
      if (errorType) {
        setCurrentScreen("error");
      } else if (currentUser || process.env.NEXT_PUBLIC_AUDIT_MODE === 'true') {
        setCurrentScreen("home");
      } else {
        setCurrentScreen("login");
      }
    }
  }, [splashTimeoutElapsed, isLoaded, currentScreen, errorType, currentUser]);

  const handleLoginSuccess = (user: any) => {
    setCurrentUser(user);
    localStorage.setItem("core_user", JSON.stringify(user));
    setCurrentScreen("home");
  };

  const handleRetry = () => {
    setErrorType(null);
    setCurrentScreen("splash");
    // Tornar a executar la lògica de càrrega
    window.location.reload();
  };

  const handleUserUpdate = (updatedUser: any) => {
    setCurrentUser(updatedUser);
    localStorage.setItem("core_user", JSON.stringify(updatedUser));
  };

  // Renderitzat condicionals de pantalles
  const renderScreen = () => {
    switch (currentScreen) {
      case "splash":
        return <SplashScreen onComplete={handleSplashComplete} brand={brand} />;
      case "login":
        return <SimpleLogin onLoginSuccess={handleLoginSuccess} />;
      case "home":
        return <HomeScreen onNavigate={handleNavigate} onOpenHelp={reopenOnboarding} brand={brand} userLocation={location} error={geoError} currentUser={currentUser} globalLegends={globalLegends} />;
      case "legends":
        return <LegendsScreen onNavigate={handleNavigate} onOpenHelp={reopenOnboarding} brand={brand} currentUser={currentUser} globalLegends={globalLegends} />;
      case "legend-detail":
        return <LegendDetailScreen legend={navigationData} onNavigate={handleNavigate} brand={brand} userLocation={location} currentUser={currentUser} onUserUpdate={handleUserUpdate} />;
      case "map":
        return <MapScreen onNavigate={handleNavigate} focusLegend={navigationData} brand={brand} userLocation={location} onOpenHelp={reopenOnboarding} currentUser={currentUser} globalLegends={globalLegends} />;

      case "profile":
        return <ProfileScreen onNavigate={handleNavigate} currentUser={currentUser} onUserUpdate={handleUserUpdate} />;
      case "error":
        return (
          <ErrorScreen
            type={errorType || "general"}
            onRetry={handleRetry}
            onNavigate={handleNavigate}
            brand={brand}
          />
        );
      default:
        return <HomeScreen onNavigate={handleNavigate} onOpenHelp={reopenOnboarding} brand={brand} userLocation={location} error={geoError} currentUser={currentUser} globalLegends={globalLegends} />;
    }
  };
  // Determinar si cal mostrar la navegació inferior
  // Show on all screens EXCEPT splash and error
  const showBottomNav = !["splash", "error", "login"].includes(currentScreen);



  return (
    <div className="mobile-app bg-background text-foreground h-screen w-full flex flex-col" style={themeStyles}>
      {showBottomNav && (
        <Header 
          onNavigate={handleNavigate} 
          onOpenHelp={reopenOnboarding}
          brand={brand}
        />
      )}
      <main className={`flex-1 relative ${currentScreen === 'legend-detail' ? 'overflow-y-auto' : 'overflow-auto'} scrollbar-hide`}>
        {renderScreen()}
      </main>

      {showBottomNav && (
        <div className="flex flex-col items-center mb-4">
          <div className="mb-2 opacity-30 select-none pointer-events-none">
            <span className="text-[9px] font-serif italic tracking-[0.15em] text-stone-500 uppercase">
              {t_splash('project')}
            </span>
          </div>
          <BottomNavigation
            currentScreen={currentScreen}
            onScreenChange={handleNavigate}
          />
        </div>
      )}

      {/* Onboarding Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onComplete={completeOnboarding}
        onSkip={skipOnboarding}
        onNavigate={handleNavigate}
      />

    </div>
  );
}
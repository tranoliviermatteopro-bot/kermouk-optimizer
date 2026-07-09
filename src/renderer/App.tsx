import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { getActiveTweaksCount } from "./utils/tweakStore";
import Sidebar from "./components/Sidebar";
import TitleBar from "./components/TitleBar";
import LicenseModal from "./components/LicenseModal";
import SplashScreen from "./components/SplashScreen";
import StatusBar from "./components/StatusBar";

// Chargement différé — chaque page est chargée seulement à la première visite
const Dashboard    = lazy(() => import("./pages/Dashboard"));
const NetworkTweaks = lazy(() => import("./pages/NetworkTweaks"));
const PreLaunch    = lazy(() => import("./pages/PreLaunch"));
const About        = lazy(() => import("./pages/About"));
const AuthPage     = lazy(() => import("./pages/AuthPage"));
const AccountPage  = lazy(() => import("./pages/AccountPage"));
const BackupsPage  = lazy(() => import("./pages/BackupsPage"));
const FixesPage    = lazy(() => import("./pages/FixesPage"));
const GeneralPage  = lazy(() => import("./pages/GeneralPage"));
const HardwarePage = lazy(() => import("./pages/HardwarePage"));
const DebloatPage  = lazy(() => import("./pages/DebloatPage"));
const AdvancedPage = lazy(() => import("./pages/AdvancedPage"));

export interface SupabaseProfile {
  id: string;
  email: string;
  is_premium: boolean;
  referral_code: string;
  referred_by: string | null;
  referral_count: number;
  created_at: string;
}

export type Page =
  | "home"
  | "backups"
  | "fixes"
  | "general"
  | "hardware"
  | "debloat"
  | "network"
  | "prelaunch"
  | "advanced"
  | "about"
  | "account";

export interface AppState {
  isPremium: boolean;
  licenseKey: string | null;
  currentPage: Page;
  showLicenseModal: boolean;
  supabaseUser: { id: string; email: string } | null;
  supabaseProfile: SupabaseProfile | null;
}

declare global {
  interface Window {
    kermouk: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      loadLicense: () => Promise<string | null>;
      saveLicense: (key: string) => Promise<{ ok: boolean; message?: string }>;
      clearLicense: () => Promise<{ ok: boolean }>;
      activateLicense: (key: string) => Promise<{ ok: boolean; message?: string; profile?: SupabaseProfile; alreadyOwned?: boolean }>;
      getSystemInfo: () => Promise<Record<string, string>>;
      applyTweaks: (bat: string, names: string[]) => Promise<{ ok: boolean; applied?: string[]; message?: string; error?: string }>;
      createRestorePoint: () => Promise<{ ok: boolean; error?: string }>;
      openExternal: (url: string) => Promise<void>;
      getMotherboardInfo: () => Promise<{ manufacturer: string; product: string }>;
      rebootToBios: () => Promise<{ ok: boolean; error?: string }>;
      getHardwareMonitor: () => Promise<Record<string, unknown>>;
      applyCpuTweaks: () => Promise<{ ok: boolean; error?: string }>;
      applyGpuOverclock: (profile: string) => Promise<{ ok: boolean; error?: string }>;
      resetGpuOverclock: () => Promise<{ ok: boolean; error?: string }>;
      pingServer: (host: string) => Promise<{ ok: boolean; ms: number }>;
      applyFortniteIni: () => Promise<{ ok: boolean; error?: string }>;
      cleanFortniteCache: () => Promise<{ ok: boolean; deletedCount?: number; error?: string }>;
      scanJunk: () => Promise<Record<string, number>>;
      cleanJunk: (id: string) => Promise<{ ok: boolean; error?: string }>;
      runBenchmark: () => Promise<{ cpuScore: number; ramScore: number }>;
      getDriverInfo: () => Promise<{ gpu: string; gpuVersion: string; isNvidia: boolean; isAmd: boolean }>;
      applyStreamingMode: () => Promise<{ ok: boolean; error?: string }>;
      setNotificationsEnabled: (enabled: boolean) => Promise<void>;
      scanGpoStatus: () => Promise<{ gpeditAvailable: boolean; tweaks: Record<string, string> }>;
      installGpedit: () => Promise<{ ok: boolean; error?: string }>;
      installGpeditDll: () => Promise<{ ok: boolean; error?: string }>;
      applyGpoTweaks: (ids: string[]) => Promise<{ ok: boolean; error?: string }>;
      restoreGpoDefaults: () => Promise<{ ok: boolean; error?: string }>;
      detectNvidiaInspector: () => Promise<{ found: boolean; path: string | null }>;
      applyNvidiaProfile: (profileFilename: string, inspectorPath: string) => Promise<{ ok: boolean; error?: string }>;
      applyPackComplet: () => Promise<{ ok: boolean; error?: string }>;
      generateSystemReport: () => Promise<{ ok: boolean; reportPath: string; content: string; error?: string }>;
      exportPcOptimizations: () => Promise<{ ok: boolean; folder: string; error?: string }>;
      preLaunchFortnite: (params: { killDiscord: boolean; autoRestore: boolean; extraApps?: string[] }) => Promise<{ ok: boolean; freedMb?: number; error?: string }>;
      onPreLaunchProgress: (cb: (data: { step: string; message: string; done: boolean }) => void) => () => void;
      onHwAlert: (cb: (data: Record<string, unknown>) => void) => () => void;
      checkForUpdates: () => Promise<void>;
      installUpdate: () => Promise<void>;
      onUpdateStatus: (cb: (payload: Record<string, unknown>) => void) => () => void;
      authSignup: (params: { email: string; password: string; referralCode?: string }) => Promise<{ ok: boolean; message?: string; user?: { id: string; email: string }; profile?: SupabaseProfile }>;
      authLogin: (params: { email: string; password: string }) => Promise<{ ok: boolean; message?: string; user?: { id: string; email: string }; profile?: SupabaseProfile }>;
      authLogout: () => Promise<{ ok: boolean }>;
      authGetUser: () => Promise<{ user: { id: string; email: string } | null; profile: SupabaseProfile | null }>;
      authCheckSession: () => Promise<{ ok: boolean; user?: { id: string; email: string } | null; profile?: SupabaseProfile | null }>;
      backups: {
        create: (name: string, type: "manual" | "automatic") => Promise<{ ok: boolean; id?: string; error?: string }>;
        list: () => Promise<{ ok: boolean; backups: Array<{ id: string; name: string; date: string; type: "manual" | "automatic" }>; error?: string }>;
        restore: (id: string) => Promise<{ success: boolean; errors: string[] }>;
        delete: (id: string) => Promise<{ ok: boolean; error?: string }>;
      };
    };
  }
}

export type Theme = "orange" | "blue" | "red" | "green";

const THEME_COLORS: Record<Theme, string> = {
  orange: "#FF6B00",
  blue:   "#3B82F6",
  red:    "#EF4444",
  green:  "#22c55e",
};

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme === "orange" ? "" : theme);
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [splashFading, setSplashFading] = useState(false);
  const [theme, setTheme] = useState<Theme>("orange");
  const [appliedTweaksCount, setAppliedTweaksCount] = useState(0);

  const [state, setState] = useState<AppState>({
    isPremium: false,
    licenseKey: null,
    currentPage: "home",
    showLicenseModal: false,
    supabaseUser: null,
    supabaseProfile: null,
  });

  // Load license and preferences on mount
  useEffect(() => {
    const savedTheme = (localStorage.getItem("kermouk_theme") as Theme) || "orange";
    setTheme(savedTheme);
    applyTheme(savedTheme);

    setAppliedTweaksCount(getActiveTweaksCount());

    window.kermouk?.loadLicense().then((key) => {
      if (key) setState((s) => ({ ...s, isPremium: true, licenseKey: key }));
    });

    window.kermouk?.authCheckSession().then((result) => {
      if (result?.user && result?.profile) {
        setState((s) => ({
          ...s,
          supabaseUser: result.user ?? null,
          supabaseProfile: result.profile ?? null,
          isPremium: s.isPremium || !!(result.profile?.is_premium),
        }));
      }
    }).catch(() => { /* silencieux si hors-ligne */ });

    // Show splash for 2 seconds then fade out
    const fadeTimer = setTimeout(() => setSplashFading(true), 1800);
    const hideTimer = setTimeout(() => setShowSplash(false), 2250);
    return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer); };
  }, []);

  // Refresh applied tweaks count on page change
  useEffect(() => {
    setAppliedTweaksCount(getActiveTweaksCount());
  }, [state.currentPage]);

  const changeTheme = useCallback((t: Theme) => {
    setTheme(t);
    applyTheme(t);
    localStorage.setItem("kermouk_theme", t);
  }, []);

  const navigate = useCallback((page: Page) => {
    setState((s) => ({ ...s, currentPage: page }));
  }, []);

  const openLicenseModal = useCallback(() => {
    setState((s) => ({ ...s, showLicenseModal: true }));
  }, []);

  const closeLicenseModal = useCallback(() => {
    setState((s) => ({ ...s, showLicenseModal: false }));
  }, []);

  const onLicenseActivated = useCallback((key: string) => {
    setState((s) => ({
      ...s,
      isPremium: true,
      licenseKey: key,
      showLicenseModal: false,
      supabaseProfile: s.supabaseProfile ? { ...s.supabaseProfile, is_premium: true } : s.supabaseProfile,
    }));
  }, []);

  const onLicenseRemoved = useCallback(() => {
    setState((s) => ({ ...s, isPremium: false, licenseKey: null }));
  }, []);

  const onAuthenticated = useCallback((user: { id: string; email: string }, profile: SupabaseProfile) => {
    setState((s) => ({
      ...s,
      supabaseUser: user,
      supabaseProfile: profile,
      isPremium: s.isPremium || profile.is_premium,
    }));
  }, []);

  const onLogout = useCallback(() => {
    setState((s) => ({
      ...s,
      supabaseUser: null,
      supabaseProfile: null,
      isPremium: !!s.licenseKey,
    }));
  }, []);

  const onPremiumUnlocked = useCallback(() => {
    setState((s) => (!s.isPremium ? { ...s, isPremium: true } : s));
  }, []);

  const pageProps = { isPremium: state.isPremium, openLicenseModal };

  const renderPage = () => {
    const key = state.currentPage;
    let content: React.ReactNode;
    switch (key) {
      case "home":      content = <Dashboard {...pageProps} />; break;
      case "backups":   content = <BackupsPage {...pageProps} />; break;
      case "fixes":     content = <FixesPage {...pageProps} />; break;
      case "general":   content = <GeneralPage {...pageProps} />; break;
      case "hardware":  content = <HardwarePage {...pageProps} />; break;
      case "debloat":   content = <DebloatPage {...pageProps} />; break;
      case "network":   content = <NetworkTweaks {...pageProps} />; break;
      case "prelaunch": content = <PreLaunch {...pageProps} />; break;
      case "advanced":  content = <AdvancedPage {...pageProps} />; break;
      case "about":
        content = (
          <About
            isPremium={state.isPremium}
            licenseKey={state.licenseKey}
            onLicenseRemoved={onLicenseRemoved}
            openLicenseModal={openLicenseModal}
            theme={theme}
            onThemeChange={changeTheme}
          />
        );
        break;
      case "account":
        content = state.supabaseUser && state.supabaseProfile ? (
          <AccountPage
            user={state.supabaseUser}
            profile={state.supabaseProfile}
            onLogout={onLogout}
            onPremiumUnlocked={onPremiumUnlocked}
          />
        ) : (
          <AuthPage onAuthenticated={onAuthenticated} />
        );
        break;
      default: content = <Dashboard {...pageProps} />;
    }
    return (
      <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#333", fontSize: "12px" }}>Chargement…</div>}>
        <div key={key} className="page-transition" style={{ height: "100%" }}>
          {content}
        </div>
      </Suspense>
    );
  };

  return (
    <>
      {showSplash && <SplashScreen fading={splashFading} />}

      <div className="app-layout">
        <TitleBar />
        <Sidebar
          currentPage={state.currentPage}
          isPremium={state.isPremium}
          onNavigate={navigate}
          onUnlockPremium={openLicenseModal}
          supabaseUser={state.supabaseUser}
        />
        <div className="content">{renderPage()}</div>
        <StatusBar isPremium={state.isPremium} appliedTweaksCount={appliedTweaksCount} />

        {state.showLicenseModal && (
          <LicenseModal onClose={closeLicenseModal} onSuccess={onLicenseActivated} />
        )}
      </div>
    </>
  );
}

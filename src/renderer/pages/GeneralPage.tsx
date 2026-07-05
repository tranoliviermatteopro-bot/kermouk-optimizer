import { useState, useEffect } from "react";
import TweakSection from "../components/TweakSection";
import FortniteTweaks from "./FortniteTweaks";
import { FREE_TWEAKS, PREMIUM_TWEAKS } from "../utils/tweakEngine";

interface Props {
  isPremium: boolean;
  openLicenseModal: () => void;
}

type Tab = "core" | "privacy" | "qol" | "apps" | "powerplan";

const TABS: { id: Tab; label: string }[] = [
  { id: "core", label: "Core" },
  { id: "privacy", label: "Privacy" },
  { id: "qol", label: "QOL" },
  { id: "apps", label: "Apps" },
  { id: "powerplan", label: "Powerplan" },
];

// ── Core: optimisations Windows fondamentales ─────────────────────────────────
const CORE_TWEAKS = [
  FREE_TWEAKS.find(t => t.id === "disable-gamebar")!,
  FREE_TWEAKS.find(t => t.id === "disable-gamedvr")!,
  FREE_TWEAKS.find(t => t.id === "timer-resolution")!,
  FREE_TWEAKS.find(t => t.id === "disable-hyperv")!,
  FREE_TWEAKS.find(t => t.id === "mmcss-audio")!,
  PREMIUM_TWEAKS.find(t => t.id === "mmcss-latency-sensitive")!,
].filter(Boolean);

// ── Privacy: confidentialité et télémétrie ────────────────────────────────────
const PRIVACY_TWEAKS_ALL = [
  FREE_TWEAKS.find(t => t.id === "disable-notifications")!,
  PREMIUM_TWEAKS.find(t => t.id === "privacy-activity-feed")!,
  PREMIUM_TWEAKS.find(t => t.id === "privacy-all-ads")!,
  PREMIUM_TWEAKS.find(t => t.id === "privacy-ceip")!,
  PREMIUM_TWEAKS.find(t => t.id === "privacy-diagnostic-data")!,
  PREMIUM_TWEAKS.find(t => t.id === "privacy-diagnostic-tracking")!,
  PREMIUM_TWEAKS.find(t => t.id === "privacy-compatibility-telemetry")!,
  PREMIUM_TWEAKS.find(t => t.id === "privacy-error-reporting")!,
  PREMIUM_TWEAKS.find(t => t.id === "privacy-feedback-hub")!,
  PREMIUM_TWEAKS.find(t => t.id === "privacy-help-experience")!,
  PREMIUM_TWEAKS.find(t => t.id === "privacy-inventory-collector")!,
  PREMIUM_TWEAKS.find(t => t.id === "privacy-location-tracking")!,
  PREMIUM_TWEAKS.find(t => t.id === "privacy-remote-assistance")!,
  PREMIUM_TWEAKS.find(t => t.id === "privacy-timeline-tracking")!,
  PREMIUM_TWEAKS.find(t => t.id === "privacy-advertising-id")!,
].filter(Boolean);

// ── QOL: qualité de vie (commun Win10 + Win11) ───────────────────────────────
const QOL_TWEAKS_BASE = [
  FREE_TWEAKS.find(t => t.id === "clean-temp")!,
  PREMIUM_TWEAKS.find(t => t.id === "energy-estimation-disable")!,
  PREMIUM_TWEAKS.find(t => t.id === "qol-control-panel-shortcut")!,
  PREMIUM_TWEAKS.find(t => t.id === "qol-classic-altf4")!,
  PREMIUM_TWEAKS.find(t => t.id === "qol-classic-tray-icons")!,
  PREMIUM_TWEAKS.find(t => t.id === "qol-disable-suggested-apps")!,
  PREMIUM_TWEAKS.find(t => t.id === "qol-disable-snap-layouts")!,
  PREMIUM_TWEAKS.find(t => t.id === "qol-disable-start-suggestions")!,
  PREMIUM_TWEAKS.find(t => t.id === "qol-disable-taskbar-transparency")!,
  PREMIUM_TWEAKS.find(t => t.id === "qol-disable-windows-tips")!,
  PREMIUM_TWEAKS.find(t => t.id === "qol-full-wallpaper-quality")!,
  PREMIUM_TWEAKS.find(t => t.id === "qol-numlock-startup")!,
  PREMIUM_TWEAKS.find(t => t.id === "qol-remove-suggested-actions")!,
  PREMIUM_TWEAKS.find(t => t.id === "qol-show-file-extensions")!,
  PREMIUM_TWEAKS.find(t => t.id === "qol-show-hidden-files")!,
].filter(Boolean);

// ── QOL Win11 uniquement ──────────────────────────────────────────────────────
const QOL_TWEAKS_WIN11 = [
  PREMIUM_TWEAKS.find(t => t.id === "qol-classic-rightclick")!,
  PREMIUM_TWEAKS.find(t => t.id === "qol-disable-taskbar-chat")!,
  PREMIUM_TWEAKS.find(t => t.id === "qol-disable-widgets")!,
].filter(Boolean);

// ── Powerplan: plan d'alimentation ────────────────────────────────────────────
const POWERPLAN_TWEAKS = [
  FREE_TWEAKS.find(t => t.id === "high-performance")!,
  PREMIUM_TWEAKS.find(t => t.id === "disable-power-throttling")!,
].filter(Boolean);

export default function GeneralPage({ isPremium, openLicenseModal }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("core");
  const [isWin11, setIsWin11] = useState<boolean | null>(null);

  useEffect(() => {
    window.kermouk.getSystemInfo().then((info: { os: string }) => {
      setIsWin11(info.os.includes("11"));
    }).catch(() => setIsWin11(false));
  }, []);

  const qolTweaks = [
    ...QOL_TWEAKS_BASE,
    ...(isWin11 ? QOL_TWEAKS_WIN11 : []),
  ];

  return (
    <div>
      <div className="section-header">
        <h1 style={{ fontFamily: "Orbitron, sans-serif", fontSize: "20px", fontWeight: 900, color: "#fff", letterSpacing: "0.08em" }}>
          GÉNÉRAL <span className="gradient-text">WINDOWS</span>
        </h1>
        <p style={{ fontSize: "12px", color: "#555", marginTop: "4px" }}>
          Optimisations système Windows — Core, Privacy, QOL, Apps & Powerplan
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "2px", marginBottom: "16px", borderBottom: "1px solid #1a1a1a" }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "8px 18px",
              background: "none",
              border: "none",
              borderBottom: activeTab === tab.id ? "2px solid var(--primary)" : "2px solid transparent",
              color: activeTab === tab.id ? "var(--primary)" : "#555",
              fontSize: "11px",
              fontFamily: "Rajdhani, sans-serif",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              cursor: "pointer",
              marginBottom: "-1px",
              transition: "color 0.15s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "core" && (
        <TweakSection
          title="CORE"
          subtitle="Désactivation Game Bar, DVR, Hyper-V, Timer Resolution et MMCSS"
          tweaks={CORE_TWEAKS}
          isPremium={isPremium}
          openLicenseModal={openLicenseModal}
        />
      )}

      {activeTab === "privacy" && (
        <TweakSection
          title="PRIVACY"
          subtitle="Confidentialité, télémétrie, pubs, diagnostics, localisation et assistance à distance"
          tweaks={PRIVACY_TWEAKS_ALL}
          isPremium={isPremium}
          openLicenseModal={openLicenseModal}
        />
      )}

      {activeTab === "qol" && (
        <div>
          {isWin11 !== null && (
            <div style={{ marginBottom: "12px", display: "flex", gap: "8px", alignItems: "center" }}>
              <span style={{
                fontSize: "10px",
                color: isWin11 ? "#a855f7" : "#555",
                background: isWin11 ? "rgba(168,85,247,0.08)" : "rgba(80,80,80,0.08)",
                border: `1px solid ${isWin11 ? "rgba(168,85,247,0.2)" : "#1a1a1a"}`,
                borderRadius: "4px",
                padding: "3px 10px",
              }}>
                {isWin11 ? "✓ Windows 11 détecté — tweaks Win11 inclus" : "Windows 10 — tweaks Win11 masqués"}
              </span>
            </div>
          )}
          <TweakSection
            title="QUALITÉ DE VIE"
            subtitle="Nettoyage, Defender, énergie, suggestions, explorateur et tweaks d'interface"
            tweaks={qolTweaks}
            isPremium={isPremium}
            openLicenseModal={openLicenseModal}
          />
        </div>
      )}

      {activeTab === "apps" && (
        <FortniteTweaks isPremium={isPremium} openLicenseModal={openLicenseModal} />
      )}

      {activeTab === "powerplan" && (
        <TweakSection
          title="POWERPLAN"
          subtitle="Plan d'alimentation et gestion du throttling CPU"
          tweaks={POWERPLAN_TWEAKS}
          isPremium={isPremium}
          openLicenseModal={openLicenseModal}
        />
      )}
    </div>
  );
}

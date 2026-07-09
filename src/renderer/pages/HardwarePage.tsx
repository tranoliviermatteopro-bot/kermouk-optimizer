import { useState, useEffect } from "react";
import TweakSection from "../components/TweakSection";
import GpuTweaks from "./GpuTweaks";
import { FREE_TWEAKS, PREMIUM_TWEAKS } from "../utils/tweakEngine";

interface Props {
  isPremium: boolean;
  openLicenseModal: () => void;
}

type Tab = "gpu" | "cpu" | "ram" | "peripherals" | "storage";

const TABS: { id: Tab; label: string }[] = [
  { id: "gpu", label: "GPU" },
  { id: "cpu", label: "CPU" },
  { id: "ram", label: "RAM" },
  { id: "peripherals", label: "Peripherals" },
  { id: "storage", label: "Storage" },
];

// ── CPU ───────────────────────────────────────────────────────────────────────
const CPU_TWEAKS = [
  PREMIUM_TWEAKS.find(t => t.id === "cpu-priority")!,
  PREMIUM_TWEAKS.find(t => t.id === "win32-priority-separation")!,
  PREMIUM_TWEAKS.find(t => t.id === "bcdedit-dynamictick")!,
  PREMIUM_TWEAKS.find(t => t.id === "core-parking-disable")!,
  PREMIUM_TWEAKS.find(t => t.id === "disable-coalescable-timer")!,
  PREMIUM_TWEAKS.find(t => t.id === "disable-power-throttling")!,
  PREMIUM_TWEAKS.find(t => t.id === "cpu-max-performance")!,
  PREMIUM_TWEAKS.find(t => t.id === "disable-cstates")!,
  PREMIUM_TWEAKS.find(t => t.id === "disable-modern-standby")!,
].filter(Boolean);

// ── RAM ───────────────────────────────────────────────────────────────────────
const RAM_TWEAKS = [
  PREMIUM_TWEAKS.find(t => t.id === "memory-usage")!,
  PREMIUM_TWEAKS.find(t => t.id === "svhost-split-32gb")!,
  PREMIUM_TWEAKS.find(t => t.id === "disable-memory-compression")!,
  PREMIUM_TWEAKS.find(t => t.id === "clear-pagefile-shutdown")!,
  PREMIUM_TWEAKS.find(t => t.id === "disable-prefetcher")!,
  PREMIUM_TWEAKS.find(t => t.id === "disable-ram-diagnostics")!,
  PREMIUM_TWEAKS.find(t => t.id === "restore-sysmain")!,
  PREMIUM_TWEAKS.find(t => t.id === "disable-page-combining")!,
].filter(Boolean);

// ── Peripherals ───────────────────────────────────────────────────────────────
const PERIPHERALS_TWEAKS = [
  PREMIUM_TWEAKS.find(t => t.id === "keyboard-mouse-queue")!,
  PREMIUM_TWEAKS.find(t => t.id === "usb-power-save-disable")!,
  PREMIUM_TWEAKS.find(t => t.id === "usb-selective-suspend-off")!,
  PREMIUM_TWEAKS.find(t => t.id === "disable-mouse-acceleration")!,
  PREMIUM_TWEAKS.find(t => t.id === "enable-pixel-mouse")!,
  PREMIUM_TWEAKS.find(t => t.id === "disable-sticky-keys")!,
  PREMIUM_TWEAKS.find(t => t.id === "disable-toggle-keys")!,
  PREMIUM_TWEAKS.find(t => t.id === "keyboard-repeat-delay")!,
].filter(Boolean);

// ── Storage (base, toujours affichés) ─────────────────────────────────────────
const STORAGE_BASE_TWEAKS = [
  FREE_TWEAKS.find(t => t.id === "ssd-nvme-optimization")!,
  PREMIUM_TWEAKS.find(t => t.id === "mft-zone")!,
].filter(Boolean);

const STORAGE_SSD_TWEAKS = [
  PREMIUM_TWEAKS.find(t => t.id === "disable-ssd-powersave")!,
  PREMIUM_TWEAKS.find(t => t.id === "optimise-ssd-sleep")!,
].filter(Boolean);

const STORAGE_HDD_TWEAKS = [
  PREMIUM_TWEAKS.find(t => t.id === "disable-dipm-hipm")!,
].filter(Boolean);

export default function HardwarePage({ isPremium, openLicenseModal }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("gpu");
  const [diskTypes, setDiskTypes] = useState<{ hasSSD: boolean; hasHDD: boolean } | null>(null);
  const [diskDetecting, setDiskDetecting] = useState(false);

  useEffect(() => {
    if (activeTab === "storage" && diskTypes === null && !diskDetecting) {
      setDiskDetecting(true);
      (window.kermouk as unknown as { detectDiskTypes: () => Promise<{ hasSSD: boolean; hasHDD: boolean }> })
        .detectDiskTypes()
        .then(result => {
          setDiskTypes(result);
          setDiskDetecting(false);
        })
        .catch(() => {
          setDiskTypes({ hasSSD: false, hasHDD: false });
          setDiskDetecting(false);
        });
    }
  }, [activeTab, diskTypes, diskDetecting]);

  const storageTweaks = [
    ...STORAGE_BASE_TWEAKS,
    ...(diskTypes?.hasSSD ? STORAGE_SSD_TWEAKS : []),
    ...(diskTypes?.hasHDD ? STORAGE_HDD_TWEAKS : []),
  ];

  return (
    <div>
      <div className="section-header">
        <h1 style={{ fontFamily: "Orbitron, sans-serif", fontSize: "20px", fontWeight: 900, color: "#fff", letterSpacing: "0.08em" }}>
          HARDWARE <span className="gradient-text">TWEAKS</span>
        </h1>
        <p style={{ fontSize: "12px", color: "#555", marginTop: "4px" }}>
          Optimisations matérielles — GPU, CPU, RAM, Périphériques & Stockage
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

      {activeTab === "gpu" && (
        <GpuTweaks isPremium={isPremium} openLicenseModal={openLicenseModal} />
      )}

      {activeTab === "cpu" && (
        <TweakSection
          title="CPU"
          subtitle="Priorité processus, Win32PrioritySeparation, BCDEdit, Core Parking, C-States et plans d'alimentation"
          tweaks={CPU_TWEAKS}
          isPremium={isPremium}
          openLicenseModal={openLicenseModal}
        />
      )}

      {activeTab === "ram" && (
        <TweakSection
          title="RAM"
          subtitle="Optimisation mémoire, SvcHost, compression, pagefile, prefetcher et diagnostics"
          tweaks={RAM_TWEAKS}
          isPremium={isPremium}
          openLicenseModal={openLicenseModal}
        />
      )}

      {activeTab === "peripherals" && (
        <TweakSection
          title="PÉRIPHÉRIQUES"
          subtitle="Buffers clavier/souris, veille USB, accélération souris et raccourcis d'accessibilité"
          tweaks={PERIPHERALS_TWEAKS}
          isPremium={isPremium}
          openLicenseModal={openLicenseModal}
        />
      )}

      {activeTab === "storage" && (
        <div>
          {diskDetecting && (
            <div style={{ padding: "10px 14px", marginBottom: "12px", background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: "6px", fontSize: "11px", color: "#555" }}>
              Détection des disques (SSD/HDD)...
            </div>
          )}
          {diskTypes !== null && (
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
              {diskTypes.hasSSD && (
                <span style={{ fontSize: "10px", color: "#22c55e", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "4px", padding: "3px 10px" }}>
                  ✓ SSD/NVMe détecté — tweaks SSD activés
                </span>
              )}
              {diskTypes.hasHDD && (
                <span style={{ fontSize: "10px", color: "#22c55e", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "4px", padding: "3px 10px" }}>
                  ✓ HDD détecté — tweaks HDD activés
                </span>
              )}
              {!diskTypes.hasSSD && !diskTypes.hasHDD && (
                <span style={{ fontSize: "10px", color: "#f59e0b", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "4px", padding: "3px 10px" }}>
                  ⚠ Type de disque non détecté — tweaks conditionnels masqués
                </span>
              )}
            </div>
          )}
          <TweakSection
            title="STOCKAGE"
            subtitle="SSD/NVMe, zone MFT NTFS, économie d'énergie et HIPM/DIPM — réduction des temps d'accès"
            tweaks={storageTweaks}
            isPremium={isPremium}
            openLicenseModal={openLicenseModal}
          />
        </div>
      )}
    </div>
  );
}

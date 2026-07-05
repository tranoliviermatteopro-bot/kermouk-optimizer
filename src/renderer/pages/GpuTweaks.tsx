import { useState, useEffect } from "react";
import TweakSection from "../components/TweakSection";
import { PREMIUM_TWEAKS } from "../utils/tweakEngine";

const GPU_TWEAKS = [
  PREMIUM_TWEAKS.find((t) => t.id === "disable-mpo")!,
  PREMIUM_TWEAKS.find((t) => t.id === "gpu-tdr")!,
  PREMIUM_TWEAKS.find((t) => t.id === "gpu-hwsched")!,
  PREMIUM_TWEAKS.find((t) => t.id === "gpu-disable-preemption")!,
  PREMIUM_TWEAKS.find((t) => t.id === "disable-hpet")!,
  PREMIUM_TWEAKS.find((t) => t.id === "nvidia-ull")!,
  PREMIUM_TWEAKS.find((t) => t.id === "nvidia-shader-cache")!,
  PREMIUM_TWEAKS.find((t) => t.id === "nvidia-auto-boost")!,
  PREMIUM_TWEAKS.find((t) => t.id === "nvidia-power-management")!,
  PREMIUM_TWEAKS.find((t) => t.id === "nvidia-hdcp-disable")!,
].filter(Boolean);

const NVIDIA_ONLY_TWEAKS = [
  PREMIUM_TWEAKS.find((t) => t.id === "nvidia-geforce-update-disable")!,
  PREMIUM_TWEAKS.find((t) => t.id === "nvidia-idle-threshold")!,
  PREMIUM_TWEAKS.find((t) => t.id === "nvidia-contiguous-memory")!,
  PREMIUM_TWEAKS.find((t) => t.id === "nvidia-dma-remapping-disable")!,
  PREMIUM_TWEAKS.find((t) => t.id === "nvidia-uvm-disable")!,
].filter(Boolean);

interface Props {
  isPremium: boolean;
  openLicenseModal: () => void;
}

export default function GpuTweaks({ isPremium, openLicenseModal }: Props) {
  const [isNvidia, setIsNvidia] = useState<boolean | null>(null);

  useEffect(() => {
    window.kermouk.getDriverInfo().then((info: { isNvidia: boolean }) => {
      setIsNvidia(info.isNvidia);
    }).catch(() => setIsNvidia(false));
  }, []);

  return (
    <div>
      <TweakSection
        title="TWEAKS GPU"
        subtitle="TDR, Hardware Scheduling, Ultra Low Latency NVIDIA et Power Management Maximum"
        tweaks={GPU_TWEAKS}
        isPremium={isPremium}
        openLicenseModal={openLicenseModal}
      />

      {/* ── Section NVIDIA exclusive ─────────────────────────────────────── */}
      <div style={{ marginTop: "24px" }}>
        <div className="section-header">
          <h2 style={{ fontFamily: "Orbitron, sans-serif", fontSize: "16px", fontWeight: 900, color: "#fff", letterSpacing: "0.08em" }}>
            OPTIMISATIONS <span className="gradient-text">NVIDIA EXCLUSIVES</span>
          </h2>
          <p style={{ fontSize: "12px", color: "#555", marginTop: "4px" }}>
            GeForce Experience, PowerMizer, DMA Remapping, UVM — affichés uniquement si GPU NVIDIA détecté
          </p>
        </div>

        {isNvidia === null && (
          <div style={{ padding: "14px", background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: "8px", fontSize: "11px", color: "#555" }}>
            Détection du GPU en cours...
          </div>
        )}

        {isNvidia === false && (
          <div style={{ padding: "14px", background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: "8px", fontSize: "11px", color: "#555", display: "flex", alignItems: "center", gap: "8px" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
            </svg>
            GPU NVIDIA non détecté — tweaks exclusifs NVIDIA masqués.
          </div>
        )}

        {isNvidia === true && (
          <TweakSection
            title="NVIDIA EXCLUSIF"
            subtitle="Tweaks avancés driver NVIDIA — GPU NVIDIA détecté"
            tweaks={NVIDIA_ONLY_TWEAKS}
            isPremium={isPremium}
            openLicenseModal={openLicenseModal}
          />
        )}
      </div>
    </div>
  );
}

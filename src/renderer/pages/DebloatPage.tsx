import { useState } from "react";
import TweakSection from "../components/TweakSection";
import Cleaner from "./Cleaner";
import { PREMIUM_TWEAKS } from "../utils/tweakEngine";

interface Props {
  isPremium: boolean;
  openLicenseModal: () => void;
}

type Tab = "cleaner" | "services" | "autoruns" | "uninstall";

const TABS: { id: Tab; label: string }[] = [
  { id: "cleaner", label: "System Cleaner" },
  { id: "services", label: "Services" },
  { id: "autoruns", label: "Autoruns" },
  { id: "uninstall", label: "Uninstall" },
];

// ── Services: désactivation des services Windows inutiles ─────────────────────
const SERVICES_TWEAKS = [
  PREMIUM_TWEAKS.find(t => t.id === "disable-tracking")!,
  PREMIUM_TWEAKS.find(t => t.id === "disable-xbox-services")!,
  PREMIUM_TWEAKS.find(t => t.id === "disable-other-services")!,
].filter(Boolean);

const BASIC_PRESET_SERVICES = [
  "DiagTrack", "dmwappushservice", "SensorService", "lfsvc",
  "MicrosoftEdgeElevationService", "edgeupdate", "edgeupdatem",
  "WMPNetworkSvc", "RemoteRegistry", "MapsBroker", "RetailDemo",
];

function EmptyTab({ label }: { label: string }) {
  return (
    <div className="card" style={{ textAlign: "center", padding: "40px 24px" }}>
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#222" strokeWidth="1.5" style={{ margin: "0 auto 12px", display: "block" }}>
        <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
      </svg>
      <div style={{ fontSize: "12px", color: "#333" }}>{label} — à venir dans une prochaine mise à jour</div>
    </div>
  );
}

type PresetState = "idle" | "applying" | "ok" | "restoring" | "restored" | "error";

function ServicesPresetCard({ isPremium, openLicenseModal }: { isPremium: boolean; openLicenseModal: () => void }) {
  const [state, setState] = useState<PresetState>("idle");
  const [backupId, setBackupId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleApply = async () => {
    if (!isPremium) { openLicenseModal(); return; }
    setState("applying");
    setError("");
    try {
      const result = await (window.kermouk as unknown as {
        applyBasicServicesPreset: () => Promise<{ ok: boolean; backupId: string | null; error?: string }>
      }).applyBasicServicesPreset();
      if (result.ok) {
        setState("ok");
        if (result.backupId) setBackupId(result.backupId);
      } else {
        setError(result.error || "Erreur inconnue");
        setState("error");
      }
    } catch (e) {
      setError(String(e));
      setState("error");
    }
  };

  const handleRestore = async () => {
    if (!backupId) {
      // Cherche le backup le plus récent avec ce nom
      try {
        const listResult = await window.kermouk.backups.list() as unknown as { ok: boolean; backups: Array<{ id: string; name: string }> };
        const found = listResult.backups?.find((b: { id: string; name: string }) => b.name.includes("Basic Services"));
        if (!found) { setError("Aucun backup 'Basic Services' trouvé. Appliquez d'abord le preset."); setState("error"); return; }
        setBackupId(found.id);
        setState("restoring");
        const r = await window.kermouk.backups.restore(found.id);
        setState(r.success ? "restored" : "error");
        if (!r.success) setError(r.errors?.join(", ") || "Erreur restauration");
      } catch (e) { setError(String(e)); setState("error"); }
      return;
    }
    setState("restoring");
    try {
      const r = await window.kermouk.backups.restore(backupId);
      setState(r.success ? "restored" : "error");
      if (!r.success) setError(r.errors?.join(", ") || "Erreur restauration");
    } catch (e) { setError(String(e)); setState("error"); }
  };

  const isWorking = state === "applying" || state === "restoring";

  return (
    <div className="card" style={{ marginBottom: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
        <span style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "14px", color: "#ccc" }}>
          Preset <span style={{ color: "var(--primary)" }}>BASIC</span>
        </span>
        <span className="badge badge-premium">PREMIUM</span>
        {state === "ok" && (
          <span style={{ fontSize: "10px", color: "#22c55e", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "4px", padding: "2px 8px" }}>
            ✓ Appliqué
          </span>
        )}
        {state === "restored" && (
          <span style={{ fontSize: "10px", color: "#60a5fa", background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: "4px", padding: "2px 8px" }}>
            ✓ Restauré
          </span>
        )}
      </div>

      <p style={{ fontSize: "11px", color: "#444", lineHeight: 1.6, marginBottom: "12px" }}>
        Met en démarrage Manuel ou Désactivé 11 services non essentiels : télémétrie Edge, localisation, multimédia réseau, registre distant…
        Un backup nommé <em style={{ color: "#666" }}>"Avant preset Basic Services"</em> est créé automatiquement avant l'application.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px" }}>
        {BASIC_PRESET_SERVICES.map(s => (
          <span key={s} style={{ fontSize: "10px", color: "#555", background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: "4px", padding: "2px 8px", fontFamily: "monospace" }}>
            {s}
          </span>
        ))}
      </div>

      <div style={{ fontSize: "10px", color: "#3d5a80", background: "rgba(61,90,128,0.06)", border: "1px solid rgba(61,90,128,0.15)", borderRadius: "6px", padding: "8px 10px", marginBottom: "12px" }}>
        ℹ️ Réduire le nombre de services ne garantit pas un gain en FPS — la stabilité du frametime et la latence input sont les bénéfices réels. Réactivez un service si une fonctionnalité Windows cesse de fonctionner.
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={handleApply}
          disabled={isWorking || !isPremium}
          className="btn-primary"
          style={{ padding: "8px 18px", fontSize: "11px" }}
        >
          {state === "applying" ? "Application..." : "Appliquer preset Basic"}
        </button>
        <button
          onClick={handleRestore}
          disabled={isWorking}
          className="btn-secondary"
          style={{ padding: "8px 18px", fontSize: "11px" }}
        >
          {state === "restoring" ? "Restauration..." : "Restaurer"}
        </button>
      </div>

      {state === "error" && (
        <div style={{ marginTop: "10px", fontSize: "11px", color: "#ef4444", background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "6px", padding: "8px 10px" }}>
          ✗ {error || "Erreur — vérifiez que vous avez accepté l'élévation UAC."}
        </div>
      )}
    </div>
  );
}

export default function DebloatPage({ isPremium, openLicenseModal }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("cleaner");

  return (
    <div>
      <div className="section-header">
        <h1 style={{ fontFamily: "Orbitron, sans-serif", fontSize: "20px", fontWeight: 900, color: "#fff", letterSpacing: "0.08em" }}>
          DEBLOAT <span className="gradient-text">WINDOWS</span>
        </h1>
        <p style={{ fontSize: "12px", color: "#555", marginTop: "4px" }}>
          Nettoyage, services inutiles, démarrages et désinstallation
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

      {activeTab === "cleaner" && (
        <Cleaner isPremium={isPremium} openLicenseModal={openLicenseModal} />
      )}

      {activeTab === "services" && (
        <div>
          <ServicesPresetCard isPremium={isPremium} openLicenseModal={openLicenseModal} />
          <TweakSection
            title="SERVICES INDIVIDUELS"
            subtitle="SysMain, DiagTrack, Xbox Services et services inutiles — arrêt et désactivation"
            tweaks={SERVICES_TWEAKS}
            isPremium={isPremium}
            openLicenseModal={openLicenseModal}
          />
        </div>
      )}

      {activeTab === "autoruns" && (
        <EmptyTab label="Gestion des programmes au démarrage" />
      )}

      {activeTab === "uninstall" && (
        <EmptyTab label="Désinstallation des applications Windows inutiles" />
      )}
    </div>
  );
}

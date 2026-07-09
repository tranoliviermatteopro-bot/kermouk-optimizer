import { useState, useEffect } from "react";

interface Props {
  isPremium: boolean;
  openLicenseModal: () => void;
}

type TweakStatus = "active" | "inactive" | "reboot" | "unknown";

interface GpoTweak {
  id: string;
  label: string;
  description: string;
  gain: string;
  category: string;
  warning?: string;
  rebootRequired?: boolean;
  dangerous?: boolean;
  status: TweakStatus;
}

const TWEAKS_DEF: Omit<GpoTweak, "status">[] = [
  {
    id: "bandwidth",
    label: "Bande passante complète",
    description: "Windows réserve 20% de la bande passante par défaut — ce tweak la récupère intégralement via la politique QoS.",
    gain: "+20% bande passante",
    category: "Réseau",
  },
  {
    id: "qos_fortnite",
    label: "QoS Fortnite DSCP 46",
    description: "Prioritise les paquets réseau de FortniteClient-Win64-Shipping.exe avec le marquage DSCP 46 (priorité maximale).",
    gain: "-15 à -20ms ping",
    category: "Réseau",
  },
  {
    id: "delivery_opt",
    label: "Désactiver Delivery Optimization",
    description: "Désactive le partage P2P des mises à jour Windows entre les PC du réseau — libère la bande passante upload.",
    gain: "+Upload dispo",
    category: "Réseau",
  },
  {
    id: "power_throttling",
    label: "Désactiver Power Throttling CPU",
    description: "Empêche Windows de brider automatiquement les fréquences CPU des processus en arrière-plan, y compris les jeux.",
    gain: "+10-15% FPS",
    category: "Performance CPU",
    rebootRequired: true,
  },
  {
    id: "hags",
    label: "Hardware GPU Scheduling (HAGS)",
    description: "Délègue la gestion de la mémoire GPU directement au GPU driver — réduit la latence CPU-GPU de 1-3ms.",
    gain: "-2ms input lag",
    category: "Performance GPU",
    rebootRequired: true,
  },
  {
    id: "fast_startup",
    label: "Désactiver Fast Startup",
    description: "Le démarrage rapide peut provoquer des incohérences après application de tweaks système. Désactivation recommandée.",
    gain: "Stabilité accrue",
    category: "Performance CPU",
  },
  {
    id: "telemetry",
    label: "Désactiver télémétrie complète",
    description: "Bloque la collecte de données diagnostiques via les politiques AllowTelemetry=0 et MaxTelemetryAllowed=0.",
    gain: "-CPU/réseau background",
    category: "Vie privée",
  },
  {
    id: "cortana",
    label: "Désactiver Cortana et recherche web",
    description: "Désactive les requêtes web de la barre de recherche Windows et Cortana — réduit le trafic réseau background.",
    gain: "-RAM résiduelle",
    category: "Vie privée",
  },
  {
    id: "onedrive",
    label: "Désactiver OneDrive",
    description: "Désactive la synchronisation OneDrive via stratégie de groupe — libère CPU et bande passante upload.",
    gain: "+Upload/CPU",
    category: "Vie privée",
  },
  {
    id: "windows_update",
    label: "Désactiver Windows Update auto",
    description: "Empêche Windows de télécharger/installer des mises à jour en arrière-plan pendant une session gaming.",
    gain: "-Interruptions CPU",
    category: "Vie privée",
  },
  {
    id: "app_compat",
    label: "Désactiver Application Compatibility",
    description: "Désactive l'inventaire de compatibilité des applications (AITEnable) qui scanne les exécutables en arrière-plan.",
    gain: "-CPU background",
    category: "Vie privée",
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  "Réseau": "#3b82f6",
  "Performance CPU": "#FF6B00",
  "Performance GPU": "#a855f7",
  "Vie privée": "#22c55e",
};

export default function GpoTweaks({ isPremium, openLicenseModal }: Props) {
  const [tweaks, setTweaks] = useState<GpoTweak[]>(
    TWEAKS_DEF.map(t => ({ ...t, status: "unknown" }))
  );
  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set(TWEAKS_DEF.map(t => t.id)));
  const [resultMsg, setResultMsg] = useState("");

  useEffect(() => {
    if (!isPremium) return;
    loadStoredStates();
    scanStatus();
  }, [isPremium]);

  const loadStoredStates = async () => {
    const saved = await window.kermouk?.getTweakStates?.().catch(() => ({})) || {};
    if (Object.keys(saved).length === 0) return;
    setTweaks(prev => prev.map(t => {
      if (!(t.id in saved)) return t;
      return { ...t, status: (saved[t.id] ? "active" : "inactive") as TweakStatus };
    }));
  };

  const scanStatus = async () => {
    setScanning(true);
    const [scanResult, realStatus] = await Promise.all([
      window.kermouk?.scanGpoStatus?.().catch(() => null),
      window.kermouk?.checkTweakStatus?.().catch(() => ({})),
    ]);
    if (scanResult) {
      const merged = { ...(scanResult.tweaks || {}) };
      for (const [id, active] of Object.entries(realStatus || {})) {
        merged[id] = active ? "active" : merged[id] ?? "inactive";
      }
      setTweaks(prev => prev.map(t => ({
        ...t,
        status: (merged[t.id] as TweakStatus) ?? "unknown",
      })));
    }
    setScanning(false);
  };

  const applySelected = async (safeOnly = false) => {
    const ids = safeOnly
      ? [...selected].filter(id => {
          const t = tweaks.find(x => x.id === id);
          return t && !t.dangerous;
        })
      : [...selected];

    setApplying(safeOnly ? "safe" : "all");
    setResultMsg("");
    await window.kermouk?.createRestorePoint().catch(() => null);
    const result = await window.kermouk?.applyGpoTweaks?.(ids).catch(() => null);
    if (result?.ok) {
      setResultMsg(`✓ ${ids.length} tweaks GPO appliqués — ${tweaks.some(t => ids.includes(t.id) && t.rebootRequired) ? "Redémarrage recommandé" : "Actif immédiatement"}`);
      await scanStatus();
    } else {
      setResultMsg("✗ Erreur — vérifiez que vous avez accepté l'élévation UAC.");
    }
    setApplying(null);
  };

  const restoreDefaults = async () => {
    setApplying("restore");
    setResultMsg("");
    await window.kermouk?.createRestorePoint().catch(() => null);
    const result = await window.kermouk?.restoreGpoDefaults?.().catch(() => null);
    if (result?.ok) {
      await window.kermouk?.resetTweakStates?.().catch(() => null);
      setResultMsg("✓ Paramètres GPO restaurés aux valeurs Windows par défaut.");
      await scanStatus();
    } else {
      setResultMsg("✗ Erreur lors de la restauration.");
    }
    setApplying(null);
  };

  const toggleTweak = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (!isPremium) {
    return (
      <div>
        <div className="section-header">
          <h1 style={{ fontFamily: "Orbitron, sans-serif", fontSize: "20px", fontWeight: 900, color: "#fff", letterSpacing: "0.08em" }}>
            GPO & <span className="gradient-text">POLITIQUE SYSTÈME</span>
          </h1>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#222" strokeWidth="1.5" style={{ margin: "0 auto 16px" }}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <div style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "16px", color: "#444", marginBottom: "8px" }}>
            Fonctionnalité Premium
          </div>
          <div style={{ fontSize: "12px", color: "#333", marginBottom: "20px" }}>
            Tweaks Group Policy avancés — récupère 20% bande passante, désactive Power Throttling et plus.
          </div>
          <button onClick={openLicenseModal} className="btn-primary" style={{ padding: "10px 24px" }}>
            Activer Premium
          </button>
        </div>
      </div>
    );
  }

  const categories = [...new Set(TWEAKS_DEF.map(t => t.category))];
  const activeCount = tweaks.filter(t => t.status === "active").length;
  const rebootNeeded = tweaks.some(t => t.status === "reboot");

  return (
    <div>
      <div className="section-header">
        <h1 style={{ fontFamily: "Orbitron, sans-serif", fontSize: "20px", fontWeight: 900, color: "#fff", letterSpacing: "0.08em" }}>
          GPO & <span className="gradient-text">POLITIQUE SYSTÈME</span>
        </h1>
        <p style={{ fontSize: "12px", color: "#555", marginTop: "4px" }}>
          Tweaks registre système — {scanning ? "scan en cours..." : `${activeCount}/${tweaks.length} tweaks actifs`}
        </p>
      </div>

      {/* Compatibilité Windows Home banner */}
      <div className="card" style={{ marginBottom: "12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0, background: "#22c55e" }} />
          <div>
            <div style={{ fontSize: "12px", color: "#22c55e", fontWeight: 600 }}>
              Compatible Windows 10/11 Home et Pro — Sans gpedit.msc
            </div>
            <div style={{ fontSize: "10px", color: "#444", marginTop: "2px" }}>
              Tous les tweaks s'appliquent directement via le registre Windows — aucun outil tiers requis.
            </div>
          </div>
        </div>
        <button
          onClick={scanStatus}
          disabled={scanning}
          style={{ padding: "5px 12px", background: "none", border: "1px solid #1e1e1e", borderRadius: "6px", color: "#555", fontSize: "11px", cursor: "pointer", flexShrink: 0 }}
        >
          {scanning ? "Scan..." : "Rescanner"}
        </button>
      </div>

      {/* Reboot warning */}
      {rebootNeeded && (
        <div className="card" style={{ marginBottom: "12px", background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.2)" }}>
          <div style={{ fontSize: "11px", color: "#f59e0b" }}>
            ⚠ Certains tweaks nécessitent un redémarrage pour prendre pleinement effet.
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "12px" }}>
        <button
          onClick={() => applySelected(false)}
          disabled={applying !== null || selected.size === 0}
          className="btn-primary"
          style={{ padding: "10px", fontSize: "11px", opacity: applying ? 0.6 : 1 }}
        >
          {applying === "all" ? "Application..." : `Appliquer sélection (${selected.size})`}
        </button>
        <button
          onClick={() => applySelected(true)}
          disabled={applying !== null}
          style={{
            padding: "10px", borderRadius: "8px", border: "1px solid rgba(34,197,94,0.3)",
            background: "rgba(34,197,94,0.06)", color: "#22c55e", fontSize: "11px",
            cursor: "pointer", fontFamily: "Rajdhani, sans-serif", fontWeight: 700,
            opacity: applying ? 0.6 : 1,
          }}
        >
          {applying === "safe" ? "Application..." : "Tweaks sécurisés uniquement"}
        </button>
        <button
          onClick={restoreDefaults}
          disabled={applying !== null}
          style={{
            padding: "10px", borderRadius: "8px", border: "1px solid #1e1e1e",
            background: "transparent", color: "#555", fontSize: "11px",
            cursor: "pointer", fontFamily: "Rajdhani, sans-serif", fontWeight: 700,
            opacity: applying ? 0.6 : 1,
          }}
        >
          {applying === "restore" ? "Restauration..." : "Restaurer défauts"}
        </button>
      </div>

      {resultMsg && (
        <div className="card" style={{ marginBottom: "12px", background: resultMsg.startsWith("✓") ? "rgba(34,197,94,0.05)" : "rgba(239,68,68,0.05)", border: `1px solid ${resultMsg.startsWith("✓") ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}` }}>
          <div style={{ fontSize: "12px", color: resultMsg.startsWith("✓") ? "#22c55e" : "#ef4444", fontFamily: "Rajdhani, sans-serif", fontWeight: 700 }}>
            {resultMsg}
          </div>
        </div>
      )}

      {/* Tweaks by category */}
      {categories.map(cat => (
        <div key={cat} style={{ marginBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <div style={{ width: "3px", height: "14px", borderRadius: "2px", background: CATEGORY_COLORS[cat] ?? "#555" }} />
            <span style={{ fontSize: "10px", color: CATEGORY_COLORS[cat] ?? "#555", fontFamily: "Rajdhani, sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              {cat}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {tweaks.filter(t => t.category === cat).map(tweak => (
              <TweakRow
                key={tweak.id}
                tweak={tweak}
                selected={selected.has(tweak.id)}
                onToggle={() => toggleTweak(tweak.id)}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Gains table */}
      <div className="card" style={{ marginTop: "4px" }}>
        <div style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#555", marginBottom: "12px" }}>
          Résultats attendus (cumul de tous les tweaks)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          {[
            { metric: "Bande passante", gain: "+20% récupérée", color: "#3b82f6" },
            { metric: "FPS (Power Throttling)", gain: "+10%", color: "#FF6B00" },
            { metric: "Ping réseau", gain: "-15 à -20ms", color: "#22c55e" },
            { metric: "Input lag", gain: "-21%", color: "#22c55e" },
            { metric: "CPU usage en jeu", gain: "-44%", color: "#a855f7" },
          ].map(item => (
            <div key={item.metric} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: "#0d0d0d", borderRadius: "8px", border: "1px solid #1a1a1a" }}>
              <span style={{ fontSize: "11px", color: "#555" }}>{item.metric}</span>
              <span style={{ fontFamily: "Orbitron, sans-serif", fontSize: "12px", fontWeight: 900, color: item.color }}>{item.gain}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── TweakRow sub-component ───────────────────────────────────────────────────
interface TweakRowProps {
  tweak: GpoTweak;
  selected: boolean;
  onToggle: () => void;
}

function TweakRow({ tweak, selected, onToggle }: TweakRowProps) {
  const [expanded, setExpanded] = useState(false);

  const statusColor = tweak.status === "active" ? "#22c55e"
    : tweak.status === "reboot" ? "#f59e0b"
    : tweak.status === "inactive" ? "#ef4444"
    : "#444";

  const statusLabel = tweak.status === "active" ? "✓ Actif"
    : tweak.status === "reboot" ? "⚠ Reboot requis"
    : tweak.status === "inactive" ? "✗ Inactif"
    : "— Inconnu";

  return (
    <div
      style={{
        borderRadius: "8px", border: selected ? "1px solid var(--primary-border)" : "1px solid #1a1a1a",
        background: selected ? "var(--primary-dim)" : "#0d0d0d",
        transition: "all 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", cursor: "pointer" }} onClick={onToggle}>
        {/* Checkbox */}
        <div style={{
          width: "15px", height: "15px", borderRadius: "4px", flexShrink: 0,
          background: selected ? "var(--primary)" : "#1a1a1a",
          border: selected ? "none" : "1px solid #333",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {selected && (
            <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "12px", color: "#ccc", fontWeight: 600 }}>{tweak.label}</span>
            {tweak.dangerous && (
              <span style={{ fontSize: "9px", color: "#ef4444", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "3px", padding: "1px 5px" }}>
                AVANCÉ
              </span>
            )}
            {tweak.rebootRequired && (
              <span style={{ fontSize: "9px", color: "#f59e0b", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: "3px", padding: "1px 5px" }}>
                REBOOT
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          <span style={{ fontFamily: "Orbitron, sans-serif", fontSize: "10px", fontWeight: 700, color: "var(--primary)" }}>
            {tweak.gain}
          </span>
          <div style={{ padding: "2px 8px", borderRadius: "10px", fontSize: "9px", fontWeight: 700, color: statusColor, background: `${statusColor}18`, border: `1px solid ${statusColor}33`, fontFamily: "Rajdhani, sans-serif" }}>
            {statusLabel}
          </div>
          <div
            onClick={e => { e.stopPropagation(); setExpanded(x => !x); }}
            style={{ color: "#444", cursor: "pointer", lineHeight: 0, padding: "0 2px" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "0 12px 10px 37px", borderTop: "1px solid #1a1a1a" }}>
          <p style={{ fontSize: "11px", color: "#555", marginTop: "8px", lineHeight: 1.6 }}>
            {tweak.description}
          </p>
          {tweak.warning && (
            <div style={{ marginTop: "6px", fontSize: "10px", color: "#ef4444", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: "6px", padding: "6px 10px" }}>
              ⚠ {tweak.warning}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

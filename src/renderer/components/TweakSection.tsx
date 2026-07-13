import { useState, useEffect } from "react";
import type { Tweak } from "../utils/tweakEngine";
import { generateBatScript } from "../utils/tweakEngine";
import { setTweakState, setBulkTweakStates, getTweakState } from "../utils/tweakStore";

interface TweakSectionProps {
  title: string;
  subtitle: string;
  tweaks: Tweak[];
  isPremium: boolean;
  openLicenseModal: () => void;
}

export default function TweakSection({ title, subtitle, tweaks, isPremium, openLicenseModal }: TweakSectionProps) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(tweaks.filter((t) => getTweakState(t.id)).map((t) => t.id))
  );
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<{ text: string; type: string }[]>([]);
  const [creatingRP, setCreatingRP] = useState(false);
  const [done, setDone] = useState(false);
  const [tweakStatuses, setTweakStatuses] = useState<Record<string, boolean>>({});

  useEffect(() => {
    window.kermouk?.getTweakStates?.().then(states => {
      if (states) setTweakStatuses(states);
    }).catch(() => {});
  }, []);

  const toggleTweak = (id: string, locked: boolean) => {
    if (locked) { openLicenseModal(); return; }
    setSelected((prev) => {
      const next = new Set(prev);
      const isAdding = !next.has(id);
      isAdding ? next.add(id) : next.delete(id);
      setTweakState(id, isAdding);
      return next;
    });
  };

  const selectAll = () => {
    // Exclut les tweaks "risky" (thermique laptop / contre-productifs) — ils exigent une activation manuelle.
    const available = tweaks.filter((t) => (t.category === "free" || isPremium) && !t.risky).map((t) => t.id);
    setSelected(new Set(available));
    setBulkTweakStates(available, true);
  };

  const clearAll = () => {
    setSelected(new Set());
    setBulkTweakStates(tweaks.map((t) => t.id), false);
  };

  const addLog = (text: string, type = "ok") => {
    setLogs((prev) => [...prev, { text, type }]);
  };

  const applySelected = async () => {
    const toApply = tweaks.filter((t) => selected.has(t.id));
    if (toApply.length === 0) return;

    setApplying(true);
    setDone(false);
    setLogs([]);
    setProgress(0);

    // Step 1: Create restore point
    addLog("Création d'un point de restauration Windows...", "info");
    setCreatingRP(true);
    const rp = await window.kermouk.createRestorePoint();
    setCreatingRP(false);
    if (rp.ok && rp.created) {
      addLog("✓ Point de restauration créé avec succès.", "ok");
    } else if (rp.ok) {
      addLog(`⚠ ${rp.error || "Aucun nouveau point de restauration créé."}`, "warn");
    } else {
      addLog("⚠ Point de restauration ignoré (droits insuffisants).", "warn");
    }

    // Step 2: Generate BAT
    const bat = generateBatScript(toApply);
    addLog(`Génération du script BAT (${toApply.length} tweaks)...`, "info");
    setProgress(30);

    // Step 3: Apply
    addLog("Lancement en mode administrateur (UAC)...", "info");
    setProgress(50);

    const result = await window.kermouk.applyTweaks(bat, toApply.map((t) => t.name));
    setProgress(100);

    if (result.ok) {
      addLog(`✓ ${result.message}`, "ok");
      result.applied?.forEach((name) => addLog(`  → ${name}`, "ok"));
      addLog("⚡ Redémarrez Windows pour finaliser les changements.", "warn");
      const prev = parseInt(localStorage.getItem("kermouk_tweaks_count") || "0");
      localStorage.setItem("kermouk_tweaks_count", String(prev + toApply.length));
      const newStatuses = { ...tweakStatuses };
      for (const t of toApply) {
        newStatuses[t.id] = true;
        window.kermouk?.setTweakState?.(t.id, true);
      }
      setTweakStatuses(newStatuses);
    } else {
      addLog(`✗ Erreur: ${result.message}`, "error");
      if (result.error) addLog(`  Détails: ${result.error}`, "error");
    }

    setApplying(false);
    setDone(true);
  };

  const selectedCount = selected.size;
  const availableCount = tweaks.filter((t) => t.category === "free" || isPremium).length;

  return (
    <div>
      {/* Header */}
      <div className="section-header">
        <h1 style={{ fontFamily: "Orbitron, sans-serif", fontSize: "18px", fontWeight: 900, color: "#fff", letterSpacing: "0.08em" }}>
          {title}
        </h1>
        <p style={{ fontSize: "12px", color: "#555", marginTop: "4px" }}>{subtitle}</p>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <div style={{ fontSize: "12px", color: "#444" }}>
          <span style={{ color: "#FF6B00", fontWeight: 700 }}>{selectedCount}</span> sélectionné(s) sur{" "}
          <span style={{ color: "#ccc" }}>{availableCount}</span> disponibles
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={selectAll} className="btn-secondary" style={{ padding: "6px 12px", fontSize: "11px" }}>
            Tout sélectionner
          </button>
          <button onClick={clearAll} className="btn-secondary" style={{ padding: "6px 12px", fontSize: "11px" }}>
            Tout désélectionner
          </button>
        </div>
      </div>

      {/* Tweaks list */}
      <div style={{ marginBottom: "16px" }}>
        {tweaks.map((tweak) => {
          const locked = tweak.category === "premium" && !isPremium;
          const isChecked = selected.has(tweak.id);

          return (
            <div
              key={tweak.id}
              className="card"
              style={{
                position: "relative",
                opacity: locked ? 0.7 : 1,
                borderColor: isChecked ? "rgba(255,107,0,0.35)" : undefined,
              }}
            >
              <div className="tweak-row">
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "14px", color: locked ? "#444" : "#e0e0e0" }}>
                      {tweak.name}
                    </span>
                    <span className={`badge ${tweak.category === "free" ? "badge-free" : "badge-premium"}`}>
                      {tweak.category === "free" ? "GRATUIT" : "PREMIUM"}
                    </span>
                    {tweak.risky && (
                      <span title="Exclu de « Tout sélectionner » et du Mode Tournoi — risque thermique (laptop) ou contre-productif" style={{ fontSize: "9px", color: "#ef4444", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "3px", padding: "1px 6px", fontFamily: "Rajdhani, sans-serif", fontWeight: 700, letterSpacing: "0.04em" }}>
                        ⚠ À RISQUE
                      </span>
                    )}
                    {locked && (
                      <span className="badge badge-locked">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: "inline" }}>
                          <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                        </svg>{" "}VERROUILLÉ
                      </span>
                    )}
                    {tweakStatuses[tweak.id] === true && (
                      <span style={{ fontSize: "9px", color: "#22c55e", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "3px", padding: "1px 5px", fontFamily: "Rajdhani, sans-serif", fontWeight: 700 }}>
                        ✓ Actif
                      </span>
                    )}
                    {tweakStatuses[tweak.id] === false && (
                      <span style={{ fontSize: "9px", color: "#ef4444", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "3px", padding: "1px 5px", fontFamily: "Rajdhani, sans-serif", fontWeight: 700 }}>
                        ✗ Inactif
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "11px", color: "#444", lineHeight: 1.5 }}>{tweak.description}</div>
                  {tweak.warning && (
                    <div style={{ marginTop: "6px", fontSize: "10px", color: "#f59e0b", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "4px", padding: "5px 8px", lineHeight: 1.5 }}>
                      ⚠ {tweak.warning}
                    </div>
                  )}
                </div>

                <label className="toggle" style={{ cursor: locked ? "pointer" : undefined }}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleTweak(tweak.id, locked)}
                    disabled={false}
                  />
                  <span className="toggle-slider" onClick={() => locked && openLicenseModal()} />
                </label>
              </div>
            </div>
          );
        })}
      </div>

      {/* Apply button */}
      <div className="card" style={{ padding: "20px" }}>
        {progress > 0 && progress < 100 && (
          <div style={{ marginBottom: "14px" }}>
            <div style={{ fontSize: "11px", color: "#666", marginBottom: "6px", display: "flex", justifyContent: "space-between" }}>
              <span>{creatingRP ? "Création point de restauration..." : "Application en cours..."}</span>
              <span style={{ color: "#FF6B00" }}>{progress}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {logs.length > 0 && (
          <div className="log-container" style={{ marginBottom: "14px" }}>
            {logs.map((log, i) => (
              <div
                key={i}
                className={`log-line-${log.type}`}
                style={{ marginBottom: "2px" }}
              >
                &gt; {log.text}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            onClick={applySelected}
            disabled={selectedCount === 0 || applying}
            className="btn-primary"
            style={{ flex: 1 }}
          >
            {applying ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                <svg className="spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                Application en cours...
              </span>
            ) : (
              `Appliquer ${selectedCount} tweak${selectedCount !== 1 ? "s" : ""} sélectionné${selectedCount !== 1 ? "s" : ""}`
            )}
          </button>
          {done && (
            <button
              onClick={() => { setLogs([]); setProgress(0); setDone(false); }}
              className="btn-secondary"
              style={{ padding: "10px 14px", fontSize: "11px" }}
            >
              Effacer logs
            </button>
          )}
        </div>
        <div style={{ fontSize: "10px", color: "#333", marginTop: "10px", display: "flex", alignItems: "center", gap: "4px" }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#FF6B00" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Un point de restauration Windows est créé automatiquement avant chaque application.
        </div>
      </div>
    </div>
  );
}

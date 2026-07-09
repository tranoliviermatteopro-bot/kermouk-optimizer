import { useState, useEffect } from "react";
import { generateBatScript } from "../utils/tweakEngine";
import type { Tweak } from "../utils/tweakEngine";

const FORTNITE_TWEAKS: Tweak[] = [
  {
    id: "fortnite-priority",
    name: "Priorité Processus Fortnite (Above Normal)",
    description:
      "Met EpicGamesLauncher et FortniteClient-Win64-Shipping en priorité Above Normal. Option avancée — laissée décochée par défaut.",
    warning: "La priorité High (ancienne valeur) peut AUGMENTER l'input lag en affamant les pilotes souris/clavier — documenté par EXM Tweaks. Cette version utilise Above Normal, nettement plus sûre. Laisser Windows gérer (Normal) reste la recommandation principale.",
    category: "premium",
    commands: [],
    powershellCommands: [
      'Get-Process -Name "EpicGamesLauncher" -ErrorAction SilentlyContinue | ForEach-Object { $_.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::AboveNormal }',
      'Get-Process -Name "FortniteClient-Win64-Shipping" -ErrorAction SilentlyContinue | ForEach-Object { $_.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::AboveNormal }',
    ],
  },
  {
    id: "fortnite-gamedvr",
    name: "Désactivation GameDVR pour Fortnite",
    description: "Désactive Game DVR et AllowGameDVR spécifiquement pour Fortnite via le registre.",
    category: "premium",
    commands: [],
    registryCommands: [
      'reg add "HKCU\\System\\GameConfigStore" /v GameDVR_Enabled /t REG_DWORD /d 0 /f',
      'reg add "HKCU\\System\\GameConfigStore" /v GameDVR_FSEBehaviorMode /t REG_DWORD /d 2 /f',
      'reg add "HKCU\\System\\GameConfigStore" /v GameDVR_HonorUserFSEBehaviorMode /t REG_DWORD /d 1 /f',
      'reg add "HKLM\\SOFTWARE\\Microsoft\\PolicyManager\\default\\ApplicationManagement\\AllowGameDVR" /v value /t REG_DWORD /d 0 /f',
    ],
  },
  {
    id: "fortnite-pagefile",
    name: "Pagefile Automatique Optimisé",
    description: "Configure le fichier de pagination Windows en mode automatique pour éviter les stutters mémoire.",
    category: "premium",
    commands: [],
    powershellCommands: [
      '$cs = Get-WmiObject Win32_ComputerSystem; $cs.AutomaticManagedPagefile = $true; $cs.Put()',
    ],
  },
  {
    id: "fortnite-visualfx",
    name: "Effets Visuels Performances",
    description: "Configure Windows pour privilégier les performances sur l'apparence visuelle.",
    category: "premium",
    commands: [],
    registryCommands: [
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects" /v VisualFXSetting /t REG_DWORD /d 2 /f',
    ],
  },
  {
    id: "fortnite-network-throttle",
    name: "Désactivation Network Throttling",
    description: "Désactive la limitation réseau pour les applications de jeu.",
    category: "premium",
    commands: [],
    registryCommands: [
      'reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile" /v NetworkThrottlingIndex /t REG_DWORD /d 4294967295 /f',
      'reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile" /v SystemResponsiveness /t REG_DWORD /d 0 /f',
    ],
  },
];

interface Props {
  isPremium: boolean;
  openLicenseModal: () => void;
}

export default function FortniteTweaks({ isPremium, openLicenseModal }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<{ text: string; type: string }[]>([]);
  const [done, setDone] = useState(false);
  const [tweakStatuses, setTweakStatuses] = useState<Record<string, boolean>>({});

  useEffect(() => {
    window.kermouk?.getTweakStates?.().then(states => {
      if (states) setTweakStatuses(states);
    }).catch(() => {});
  }, []);

  const toggleTweak = (id: string) => {
    if (!isPremium) { openLicenseModal(); return; }
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const addLog = (text: string, type = "ok") =>
    setLogs((prev) => [...prev, { text, type }]);

  const applySelected = async () => {
    const toApply = FORTNITE_TWEAKS.filter((t) => selected.has(t.id));
    if (toApply.length === 0) return;

    setApplying(true);
    setDone(false);
    setLogs([]);
    setProgress(0);

    addLog("Création point de restauration Windows...", "info");
    const rp = await window.kermouk.createRestorePoint();
    addLog(
      rp.ok && rp.created ? "✓ Point de restauration créé." : `⚠ ${rp.error || "Point de restauration ignoré."}`,
      rp.ok && rp.created ? "ok" : "warn"
    );

    const bat = generateBatScript(toApply);
    addLog(`Génération du script BAT (${toApply.length} tweaks Fortnite)...`, "info");
    setProgress(40);

    addLog("Lancement en mode administrateur...", "info");
    setProgress(60);
    const result = await window.kermouk.applyTweaks(bat, toApply.map((t) => t.name));
    setProgress(100);

    if (result.ok) {
      addLog(`✓ ${result.message}`, "ok");
      result.applied?.forEach((name) => addLog(`  → ${name}`, "ok"));
      addLog("⚡ Lancez Fortnite pour constater les améliorations !", "warn");
      const newStatuses = { ...tweakStatuses };
      for (const t of toApply) {
        newStatuses[t.id] = true;
        window.kermouk?.setTweakState?.(t.id, true);
      }
      setTweakStatuses(newStatuses);
    } else {
      addLog(`✗ ${result.message}`, "error");
    }

    setApplying(false);
    setDone(true);
  };

  return (
    <div>
      <div className="section-header">
        <h1 style={{ fontFamily: "Orbitron, sans-serif", fontSize: "18px", fontWeight: 900, color: "#fff", letterSpacing: "0.08em" }}>
          TWEAKS <span className="gradient-text">FORTNITE</span>
        </h1>
        <p style={{ fontSize: "12px", color: "#555", marginTop: "4px" }}>
          Optimisations spécifiques au jeu Fortnite — priorité processus, GameDVR, pagefile
        </p>
      </div>

      {/* Fortnite note */}
      <div className="card" style={{ marginBottom: "16px", borderColor: "rgba(255,107,0,0.2)", background: "rgba(255,107,0,0.04)" }}>
        <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#FF6B00" style={{ flexShrink: 0 }}>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          <div style={{ fontSize: "11px", color: "#666", lineHeight: 1.6 }}>
            <strong style={{ color: "#ccc" }}>Note :</strong> Certains tweaks (priorité processus) nécessitent que Fortnite soit
            en cours d&apos;exécution pour être appliqués. Relancez l&apos;optimisation avec Fortnite ouvert pour un effet immédiat.
            Les tweaks registre s&apos;appliquent toujours.
          </div>
        </div>
      </div>

      {/* Tweaks */}
      <div style={{ marginBottom: "16px" }}>
        {FORTNITE_TWEAKS.map((tweak) => {
          const locked = !isPremium;
          const isChecked = selected.has(tweak.id);

          return (
            <div
              key={tweak.id}
              className="card"
              style={{ opacity: locked ? 0.7 : 1, borderColor: isChecked ? "rgba(255,107,0,0.35)" : undefined }}
            >
              <div className="tweak-row">
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "14px", color: locked ? "#444" : "#e0e0e0" }}>
                      {tweak.name}
                    </span>
                    <span className="badge badge-premium">FORTNITE</span>
                    {locked && <span className="badge badge-locked">VERROUILLÉ</span>}
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
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleTweak(tweak.id)}
                  />
                  <span className="toggle-slider" onClick={() => locked && openLicenseModal()} />
                </label>
              </div>
            </div>
          );
        })}
      </div>

      {/* Apply */}
      <div className="card" style={{ padding: "20px" }}>
        {progress > 0 && progress < 100 && (
          <div style={{ marginBottom: "14px" }}>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
        {logs.length > 0 && (
          <div className="log-container" style={{ marginBottom: "14px" }}>
            {logs.map((log, i) => (
              <div key={i} className={`log-line-${log.type}`} style={{ marginBottom: "2px" }}>
                &gt; {log.text}
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={applySelected} disabled={selected.size === 0 || applying} className="btn-primary" style={{ flex: 1 }}>
            {applying ? "Application en cours..." : `Appliquer ${selected.size} tweak${selected.size !== 1 ? "s" : ""} Fortnite`}
          </button>
          {done && (
            <button onClick={() => { setLogs([]); setProgress(0); setDone(false); }} className="btn-secondary" style={{ padding: "10px 14px", fontSize: "11px" }}>
              Effacer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

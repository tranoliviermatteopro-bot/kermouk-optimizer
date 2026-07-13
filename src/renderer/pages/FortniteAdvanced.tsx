import { useState, useEffect } from "react";
import { FREE_TWEAKS, PREMIUM_TWEAKS, generateBatScript } from "../utils/tweakEngine";

interface Props {
  isPremium: boolean;
  openLicenseModal: () => void;
}

type LogEntry = { text: string; type: string };

const ALL_FREE_TWEAKS_IDS = FREE_TWEAKS.map((t) => t.id);
const ALL_TWEAKS = [...FREE_TWEAKS, ...PREMIUM_TWEAKS];

export default function FortniteAdvanced({ isPremium, openLicenseModal }: Props) {
  const [iniStatus, setIniStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [iniError, setIniError] = useState("");

  useEffect(() => {
    window.kermouk?.getTweakStates?.().then(states => {
      if (states?.["fortnite-ini"]) setIniStatus("ok");
    }).catch(() => {});
  }, []);

  const [cacheStatus, setCacheStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [cacheResult, setCacheResult] = useState("");

  const [priorityStatus, setPriorityStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [eacStatus, setEacStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [eacMsg, setEacMsg] = useState("");
  const [fseStatus, setFseStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [hagsStatus, setHagsStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [nagleStatus, setNagleStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [modeStatus, setModeStatus] = useState<"idle" | "applying">("idle");
  const [modeLogs, setModeLogs] = useState<LogEntry[]>([]);

  const addModeLog = (text: string, type = "ok") =>
    setModeLogs((prev) => [...prev, { text, type }]);

  const handleApplyIni = async () => {
    if (!isPremium) { openLicenseModal(); return; }
    setIniStatus("loading");
    setIniError("");
    const result = await window.kermouk.applyFortniteIni();
    if (result.ok) {
      setIniStatus("ok");
      const prev = parseInt(localStorage.getItem("kermouk_tweaks_count") || "0");
      localStorage.setItem("kermouk_tweaks_count", String(prev + 1));
      window.kermouk?.setTweakState?.("fortnite-ini", true);
    } else {
      setIniStatus("error");
      setIniError(result.error || "Erreur inconnue");
    }
  };

  const handleCleanCache = async () => {
    if (!isPremium) { openLicenseModal(); return; }
    setCacheStatus("loading");
    const result = await window.kermouk.cleanFortniteCache();
    if (result.ok) {
      setCacheStatus("ok");
      setCacheResult(`${result.deletedCount || 0} dossier(s) supprimé(s)`);
      const prev = parseInt(localStorage.getItem("kermouk_tweaks_count") || "0");
      localStorage.setItem("kermouk_tweaks_count", String(prev + 1));
    } else {
      setCacheStatus("error");
      setCacheResult(result.error || "Erreur");
    }
  };

  const handleFortniteProcessPriority = async () => {
    if (!isPremium) { openLicenseModal(); return; }
    setPriorityStatus("loading");
    const bat = generateBatScript([
      {
        id: "fn-proc-priority",
        name: "Priorité Fortnite Above Normal",
        description: "",
        category: "premium",
        commands: [],
        powershellCommands: [
          'Get-Process -Name "EpicGamesLauncher" -ErrorAction SilentlyContinue | ForEach-Object { $_.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::AboveNormal }',
          'Get-Process -Name "FortniteClient-Win64-Shipping" -ErrorAction SilentlyContinue | ForEach-Object { $_.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::AboveNormal }',
        ],
      },
    ]);
    const result = await window.kermouk.applyTweaks(bat, ["Priorité Fortnite Above Normal"]);
    setPriorityStatus(result.ok ? "ok" : "error");
    if (result.ok) {
      const prev = parseInt(localStorage.getItem("kermouk_tweaks_count") || "0");
      localStorage.setItem("kermouk_tweaks_count", String(prev + 1));
    }
  };

  const handleModeGaming = async () => {
    if (modeStatus === "applying") return;
    setModeStatus("applying");
    setModeLogs([]);
    addModeLog("Mode Gaming — application de tous les tweaks FREE...", "info");

    const rpResult = await window.kermouk.createRestorePoint();
    addModeLog(
      rpResult.ok && rpResult.created ? "✓ Point de restauration créé." : `⚠ ${rpResult.error || "Point de restauration ignoré."}`,
      rpResult.ok && rpResult.created ? "ok" : "warn"
    );

    const bat = generateBatScript(FREE_TWEAKS);
    const result = await window.kermouk.applyTweaks(bat, FREE_TWEAKS.map((t) => t.name));

    if (result.ok) {
      addModeLog(`✓ ${result.message}`, "ok");
      const prev = parseInt(localStorage.getItem("kermouk_tweaks_count") || "0");
      localStorage.setItem("kermouk_tweaks_count", String(prev + FREE_TWEAKS.length));
    } else {
      addModeLog(`✗ ${result.message}`, "error");
    }

    addModeLog("⚡ Redémarrez Windows pour finaliser.", "warn");
    setModeStatus("idle");
  };

  const handleModeTournoi = async () => {
    if (!isPremium) { openLicenseModal(); return; }
    if (modeStatus === "applying") return;
    setModeStatus("applying");
    setModeLogs([]);
    addModeLog("Mode Tournoi — application des tweaks sûrs...", "info");

    const rpResult = await window.kermouk.createRestorePoint();
    addModeLog(
      rpResult.ok && rpResult.created ? "✓ Point de restauration créé." : `⚠ ${rpResult.error || "Point de restauration ignoré."}`,
      rpResult.ok && rpResult.created ? "ok" : "warn"
    );

    // Exclut nvidia-auto-boost + les tweaks "risky" (thermique laptop / contre-productifs comme
    // autotuning=disabled ou MTU 1472) : appliqués en masse ils causaient du delay/stutter au lieu d'en enlever.
    const tweaksToApply = ALL_TWEAKS.filter((t) => t.id !== "nvidia-auto-boost" && !t.risky);
    addModeLog(`ℹ ${ALL_TWEAKS.filter((t) => t.risky).length} tweak(s) à risque exclus (à activer manuellement si besoin).`, "info");
    const bat = generateBatScript(tweaksToApply);
    const result = await window.kermouk.applyTweaks(bat, tweaksToApply.map((t) => t.name));

    if (result.ok) {
      addModeLog(`✓ ${result.message}`, "ok");
      const prev = parseInt(localStorage.getItem("kermouk_tweaks_count") || "0");
      localStorage.setItem("kermouk_tweaks_count", String(prev + tweaksToApply.length));
      addModeLog("⚡ Application du GameUserSettings.ini Fortnite...", "info");
      const iniResult = await window.kermouk.applyFortniteIni();
      addModeLog(iniResult.ok ? "✓ GameUserSettings.ini appliqué." : "⚠ INI ignoré (Fortnite non installé ?)", iniResult.ok ? "ok" : "warn");
    } else {
      addModeLog(`✗ ${result.message}`, "error");
    }

    addModeLog("🏆 Mode Tournoi complet. Redémarrez Windows !", "warn");
    setModeStatus("idle");
  };

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === "loading") return (
      <svg className="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
    );
    if (status === "ok") return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
    if (status === "error") return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    );
    return null;
  };

  const handleCheckEac = async () => {
    if (!isPremium) { openLicenseModal(); return; }
    setEacStatus("loading");
    setEacMsg("");
    // Force EasyAntiCheat_EOS en démarrage automatique et le démarre si arrêté
    const bat = [
      "@echo off",
      "sc config EasyAntiCheat_EOS start=auto",
      "sc start EasyAntiCheat_EOS",
    ].join("\r\n");
    const result = await window.kermouk.applyTweaks(bat, ["EAC Service Auto-Start"]);
    if (result.ok) {
      setEacStatus("ok");
      setEacMsg("Service EasyAntiCheat_EOS configuré en démarrage automatique.");
    } else {
      setEacStatus("error");
      setEacMsg("Echec — EAC peut-être absent ou Fortnite non installé.");
    }
  };

  const handleFseOptimization = async () => {
    if (!isPremium) { openLicenseModal(); return; }
    setFseStatus("loading");
    // Désactive Fullscreen Optimizations pour l'exe Fortnite via AppCompatFlags\Layers
    // Cherche le chemin Fortnite automatiquement, puis enregistre la couche de compatibilité
    const bat = [
      "@echo off",
      'powershell -Command "',
      '  $fn = Get-ChildItem -Path \\"C:\\Program Files\\Epic Games\\" -Recurse -Filter \\"FortniteClient-Win64-Shipping.exe\\" -EA SilentlyContinue | Select-Object -First 1;',
      '  if ($fn) {',
      '    $k = \\"HKCU\\\\Software\\\\Microsoft\\\\Windows NT\\\\CurrentVersion\\\\AppCompatFlags\\\\Layers\\";',
      '    reg add $k /v $fn.FullName /t REG_SZ /d \\"~ DISABLEDXMAXIMIZEDWINDOWEDMODE\\" /f;',
      '    Write-Host DONE',
      '  } else { Write-Host NOTFOUND }',
      '"',
    ].join("\r\n");
    const result = await window.kermouk.applyTweaks(bat, ["FSE Fullscreen Optimizations Off"]);
    setFseStatus(result.ok ? "ok" : "error");
    if (result.ok) {
      const prev = parseInt(localStorage.getItem("kermouk_tweaks_count") || "0");
      localStorage.setItem("kermouk_tweaks_count", String(prev + 1));
    }
  };

  const handleHags = async () => {
    if (!isPremium) { openLicenseModal(); return; }
    setHagsStatus("loading");
    const tweak = ALL_TWEAKS.find(t => t.id === "gpu-hwsched");
    if (!tweak) { setHagsStatus("error"); return; }
    const bat = generateBatScript([tweak]);
    const result = await window.kermouk.applyTweaks(bat, [tweak.name]);
    setHagsStatus(result.ok ? "ok" : "error");
    if (result.ok) {
      const prev = parseInt(localStorage.getItem("kermouk_tweaks_count") || "0");
      localStorage.setItem("kermouk_tweaks_count", String(prev + 1));
    }
  };

  const handleNagle = async () => {
    if (!isPremium) { openLicenseModal(); return; }
    setNagleStatus("loading");
    const tweak = ALL_TWEAKS.find(t => t.id === "nagle-algorithm");
    if (!tweak) { setNagleStatus("error"); return; }
    const bat = generateBatScript([tweak]);
    const result = await window.kermouk.applyTweaks(bat, [tweak.name]);
    setNagleStatus(result.ok ? "ok" : "error");
    if (result.ok) {
      const prev = parseInt(localStorage.getItem("kermouk_tweaks_count") || "0");
      localStorage.setItem("kermouk_tweaks_count", String(prev + 1));
    }
  };

  const allFreeIds = ALL_TWEAKS.filter(t => t.category === "free").length;
  const allTweaksCount = ALL_TWEAKS.length;

  return (
    <div>
      <div className="section-header">
        <h1 style={{ fontFamily: "Orbitron, sans-serif", fontSize: "18px", fontWeight: 900, color: "#fff", letterSpacing: "0.08em" }}>
          FORTNITE <span className="gradient-text">AVANCÉ</span>
        </h1>
        <p style={{ fontSize: "12px", color: "#555", marginTop: "4px" }}>
          Configuration INI, nettoyage cache, modes gaming instantanés
        </p>
      </div>

      {/* Mode Gaming / Mode Tournoi */}
      <div className="card" style={{ background: "linear-gradient(135deg, rgba(255,107,0,0.05) 0%, #111 100%)", borderColor: "rgba(255,107,0,0.25)", marginBottom: "16px" }}>
        <div style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#666", marginBottom: "12px" }}>
          Modes rapides
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
          <div style={{ textAlign: "center" }}>
            <button
              onClick={handleModeGaming}
              disabled={modeStatus === "applying"}
              className="btn-primary"
              style={{ width: "100%", padding: "12px 16px" }}
            >
              <div style={{ fontSize: "13px", fontWeight: 900 }}>MODE GAMING</div>
              <div style={{ fontSize: "10px", opacity: 0.8, marginTop: "2px" }}>{allFreeIds} tweaks FREE</div>
            </button>
          </div>
          <div style={{ textAlign: "center" }}>
            <button
              onClick={handleModeTournoi}
              disabled={modeStatus === "applying" || !isPremium}
              className="btn-primary"
              style={{
                width: "100%",
                padding: "12px 16px",
                background: isPremium
                  ? "linear-gradient(135deg, #7c3aed, #a855f7)"
                  : "rgba(60,60,60,0.5)",
                opacity: isPremium ? 1 : 0.6,
              }}
              title={!isPremium ? "Premium requis" : undefined}
            >
              <div style={{ fontSize: "13px", fontWeight: 900 }}>MODE TOURNOI</div>
              <div style={{ fontSize: "10px", opacity: 0.8, marginTop: "2px" }}>
                {isPremium ? `${allTweaksCount} tweaks ALL` : "Premium requis"}
              </div>
            </button>
          </div>
        </div>

        {modeLogs.length > 0 && (
          <div className="log-container">
            {modeLogs.map((log, i) => (
              <div key={i} className={`log-line-${log.type}`} style={{ marginBottom: "2px" }}>
                &gt; {log.text}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* GameUserSettings.ini */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "14px", color: "#e0e0e0" }}>
                GameUserSettings.ini Optimal
              </span>
              <span className="badge badge-premium">PREMIUM</span>
            </div>
            <div style={{ fontSize: "11px", color: "#555", lineHeight: 1.6, marginBottom: "8px" }}>
              Applique les paramètres optimaux Fortnite : FPS illimité, fullscreen exclusif, shadows/AA/post-process à 0,
              textures à 2, VSync désactivé.
            </div>
            <div style={{ fontSize: "10px", color: "#333", fontFamily: "monospace" }}>
              %LOCALAPPDATA%\FortniteGame\Saved\Config\WindowsClient\GameUserSettings.ini
            </div>
            {iniStatus === "error" && (
              <div style={{ fontSize: "11px", color: "#ef4444", marginTop: "6px" }}>{iniError}</div>
            )}
            {iniStatus === "ok" && (
              <div style={{ fontSize: "11px", color: "#22c55e", marginTop: "6px" }}>✓ GameUserSettings.ini appliqué avec succès !</div>
            )}
          </div>
          <button
            onClick={handleApplyIni}
            disabled={iniStatus === "loading"}
            className="btn-primary"
            style={{ padding: "10px 16px", fontSize: "12px", flexShrink: 0, display: "flex", alignItems: "center", gap: "6px" }}
          >
            <StatusIcon status={iniStatus} />
            {iniStatus === "loading" ? "Application..." : iniStatus === "ok" ? "Réappliquer" : "Appliquer INI"}
          </button>
        </div>
      </div>

      {/* Cache cleanup */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "14px", color: "#e0e0e0" }}>
                Nettoyage Cache Epic & Fortnite
              </span>
              <span className="badge badge-premium">PREMIUM</span>
            </div>
            <div style={{ fontSize: "11px", color: "#555", lineHeight: 1.6, marginBottom: "4px" }}>
              Supprime les dossiers webcache (Epic Games Launcher + Fortnite) et PipelineCaches pour forcer
              une recompilation propre des shaders.
            </div>
            {cacheStatus === "ok" && (
              <div style={{ fontSize: "11px", color: "#22c55e", marginTop: "6px" }}>✓ Cache nettoyé — {cacheResult}</div>
            )}
            {cacheStatus === "error" && (
              <div style={{ fontSize: "11px", color: "#ef4444", marginTop: "6px" }}>✗ {cacheResult}</div>
            )}
          </div>
          <button
            onClick={handleCleanCache}
            disabled={cacheStatus === "loading"}
            className="btn-primary"
            style={{ padding: "10px 16px", fontSize: "12px", flexShrink: 0, display: "flex", alignItems: "center", gap: "6px" }}
          >
            <StatusIcon status={cacheStatus} />
            {cacheStatus === "loading" ? "Nettoyage..." : "Nettoyer Cache"}
          </button>
        </div>
      </div>

      {/* Process priority */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "14px", color: "#e0e0e0" }}>
                Priorité Processus (Above Normal)
              </span>
              <span className="badge badge-premium">PREMIUM</span>
              <span style={{ fontSize: "9px", color: "#f59e0b", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "3px", padding: "1px 6px", fontFamily: "Rajdhani, sans-serif", fontWeight: 700 }}>⚠ OPTION AVANCÉE</span>
            </div>
            <div style={{ fontSize: "11px", color: "#555", lineHeight: 1.6 }}>
              Met Fortnite en priorité Above Normal. <strong style={{ color: "#888" }}>Fortnite doit être ouvert.</strong>
            </div>
            <div style={{ marginTop: "5px", fontSize: "10px", color: "#f59e0b", lineHeight: 1.5 }}>
              ⚠ La priorité High (ancienne valeur) peut AUGMENTER l&apos;input lag en affamant les pilotes souris/clavier.
              Above Normal est plus sûr — laisser Windows gérer reste la recommandation principale.
            </div>
            {priorityStatus === "ok" && (
              <div style={{ fontSize: "11px", color: "#22c55e", marginTop: "6px" }}>✓ Priorité Above Normal appliquée !</div>
            )}
            {priorityStatus === "error" && (
              <div style={{ fontSize: "11px", color: "#ef4444", marginTop: "6px" }}>✗ Échec (Fortnite ouvert ?)</div>
            )}
          </div>
          <button
            onClick={handleFortniteProcessPriority}
            disabled={priorityStatus === "loading"}
            className="btn-primary"
            style={{ padding: "10px 16px", fontSize: "12px", flexShrink: 0, display: "flex", alignItems: "center", gap: "6px" }}
          >
            <StatusIcon status={priorityStatus} />
            {priorityStatus === "loading" ? "Application..." : "Appliquer"}
          </button>
        </div>
      </div>

      {/* EasyAntiCheat service check */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "14px", color: "#e0e0e0" }}>
                EasyAntiCheat Service Auto-Start
              </span>
              <span className="badge badge-premium">PREMIUM</span>
            </div>
            <div style={{ fontSize: "11px", color: "#555", lineHeight: 1.6, marginBottom: eacMsg ? "6px" : 0 }}>
              Force le service EasyAntiCheat_EOS en démarrage automatique. Corrige les erreurs de lancement
              EAC sans avoir à réinstaller Fortnite.
              <strong style={{ color: "#888" }}> Ne désactive jamais EAC.</strong>
            </div>
            {eacMsg && (
              <div style={{ fontSize: "11px", color: eacStatus === "ok" ? "#22c55e" : "#ef4444", marginTop: "4px" }}>
                {eacStatus === "ok" ? "✓ " : "✗ "}{eacMsg}
              </div>
            )}
          </div>
          <button
            onClick={handleCheckEac}
            disabled={eacStatus === "loading"}
            className="btn-primary"
            style={{ padding: "10px 16px", fontSize: "12px", flexShrink: 0, display: "flex", alignItems: "center", gap: "6px" }}
          >
            <StatusIcon status={eacStatus} />
            {eacStatus === "loading" ? "Vérification..." : eacStatus === "ok" ? "Réappliquer" : "Vérifier EAC"}
          </button>
        </div>
      </div>

      {/* FSE Fullscreen Optimizations per-exe */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "14px", color: "#e0e0e0" }}>
                Désactiver Fullscreen Optimizations (Fortnite)
              </span>
              <span className="badge badge-premium">PREMIUM</span>
            </div>
            <div style={{ fontSize: "11px", color: "#555", lineHeight: 1.6 }}>
              Enregistre le flag <code style={{ color: "#888", fontSize: "10px" }}>DISABLEDXMAXIMIZEDWINDOWEDMODE</code> pour
              l&apos;exe Fortnite dans AppCompatFlags — équivalent de la case &ldquo;Désactiver les optimisations plein écran&rdquo;
              dans les Propriétés du raccourci. Détecte automatiquement le chemin Fortnite.
            </div>
            {fseStatus === "ok" && <div style={{ fontSize: "11px", color: "#22c55e", marginTop: "6px" }}>✓ Fullscreen Optimizations désactivées pour Fortnite !</div>}
            {fseStatus === "error" && <div style={{ fontSize: "11px", color: "#ef4444", marginTop: "6px" }}>✗ Fortnite non trouvé dans C:\Program Files\Epic Games\</div>}
          </div>
          <button
            onClick={handleFseOptimization}
            disabled={fseStatus === "loading"}
            className="btn-primary"
            style={{ padding: "10px 16px", fontSize: "12px", flexShrink: 0, display: "flex", alignItems: "center", gap: "6px" }}
          >
            <StatusIcon status={fseStatus} />
            {fseStatus === "loading" ? "Application..." : fseStatus === "ok" ? "Réappliquer" : "Appliquer"}
          </button>
        </div>
      </div>

      {/* Hardware-Accelerated GPU Scheduling */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "14px", color: "#e0e0e0" }}>
                Hardware-Accelerated GPU Scheduling
              </span>
              <span className="badge badge-premium">PREMIUM</span>
            </div>
            <div style={{ fontSize: "11px", color: "#555", lineHeight: 1.6 }}>
              Active HAGS (<code style={{ color: "#888", fontSize: "10px" }}>HwSchMode=2</code>) — réduit la latence GPU en donnant au driver
              le contrôle direct du scheduling. Nécessite un GPU récent (NVIDIA 10xx+ / AMD RX 5000+) et Windows 10 2004+.
            </div>
            {hagsStatus === "ok" && <div style={{ fontSize: "11px", color: "#22c55e", marginTop: "6px" }}>✓ HAGS activé — redémarre pour appliquer.</div>}
            {hagsStatus === "error" && <div style={{ fontSize: "11px", color: "#ef4444", marginTop: "6px" }}>✗ Échec (GPU non compatible ou droits insuffisants).</div>}
          </div>
          <button
            onClick={handleHags}
            disabled={hagsStatus === "loading"}
            className="btn-primary"
            style={{ padding: "10px 16px", fontSize: "12px", flexShrink: 0, display: "flex", alignItems: "center", gap: "6px" }}
          >
            <StatusIcon status={hagsStatus} />
            {hagsStatus === "loading" ? "Application..." : hagsStatus === "ok" ? "Réappliquer" : "Activer HAGS"}
          </button>
        </div>
      </div>

      {/* Désactivation algorithme de Nagle */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "14px", color: "#e0e0e0" }}>
                Désactiver l&apos;Algorithme de Nagle
              </span>
              <span className="badge badge-premium">PREMIUM</span>
            </div>
            <div style={{ fontSize: "11px", color: "#555", lineHeight: 1.6 }}>
              Active <code style={{ color: "#888", fontSize: "10px" }}>TcpAckFrequency=1</code> et <code style={{ color: "#888", fontSize: "10px" }}>TCPNoDelay=1</code> sur
              toutes les interfaces réseau — élimine le buffering TCP qui regroupe les petits paquets, réduisant la latence réseau en jeu.
            </div>
            {nagleStatus === "ok" && <div style={{ fontSize: "11px", color: "#22c55e", marginTop: "6px" }}>✓ Nagle désactivé sur toutes les interfaces.</div>}
            {nagleStatus === "error" && <div style={{ fontSize: "11px", color: "#ef4444", marginTop: "6px" }}>✗ Échec de l&apos;application.</div>}
          </div>
          <button
            onClick={handleNagle}
            disabled={nagleStatus === "loading"}
            className="btn-primary"
            style={{ padding: "10px 16px", fontSize: "12px", flexShrink: 0, display: "flex", alignItems: "center", gap: "6px" }}
          >
            <StatusIcon status={nagleStatus} />
            {nagleStatus === "loading" ? "Application..." : nagleStatus === "ok" ? "Réappliquer" : "Désactiver Nagle"}
          </button>
        </div>
      </div>

      {/* INI settings preview */}
      <div className="card" style={{ opacity: 0.8 }}>
        <div style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#444", marginBottom: "10px" }}>
          Paramètres INI appliqués
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 20px" }}>
          {[
            ["bShowFPS", "True"],
            ["FrameRateLimit", "0 (illimité)"],
            ["FullscreenMode", "1 (exclusif)"],
            ["sg.ShadowQuality", "0"],
            ["sg.AntiAliasingQuality", "0"],
            ["sg.TextureQuality", "2"],
            ["sg.EffectsQuality", "0"],
            ["bUseVSync", "False"],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", padding: "3px 0", borderBottom: "1px solid #1a1a1a" }}>
              <span style={{ color: "#444", fontFamily: "monospace" }}>{k}</span>
              <span style={{ color: "var(--primary)", fontFamily: "monospace", fontWeight: 700 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

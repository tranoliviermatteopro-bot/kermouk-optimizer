import { useState, useEffect, useCallback } from "react";
import TweakSection from "../components/TweakSection";
import { FREE_TWEAKS, PREMIUM_TWEAKS, generateBatScript } from "../utils/tweakEngine";

interface Props {
  isPremium: boolean;
  openLicenseModal: () => void;
}

type Tab = "tweaks" | "adapter" | "bufferbloat" | "priority";

const TABS: { id: Tab; label: string }[] = [
  { id: "tweaks", label: "Tweaks" },
  { id: "adapter", label: "Adapter Tuner" },
  { id: "bufferbloat", label: "Bufferbloat" },
  { id: "priority", label: "Network Priority" },
];

const NETWORK_TWEAKS = [
  PREMIUM_TWEAKS.find(t => t.id === "nagle-algorithm")!,
  PREMIUM_TWEAKS.find(t => t.id === "ncsi-disable")!,
  PREMIUM_TWEAKS.find(t => t.id === "netbios-disable")!,
  PREMIUM_TWEAKS.find(t => t.id === "tcp-autotune")!,
  PREMIUM_TWEAKS.find(t => t.id === "tcp-rss")!,
  PREMIUM_TWEAKS.find(t => t.id === "tcp-chimney")!,
  PREMIUM_TWEAKS.find(t => t.id === "tcp-heuristics-disable")!,
  PREMIUM_TWEAKS.find(t => t.id === "network-lso-disable")!,
  PREMIUM_TWEAKS.find(t => t.id === "wifi-sleep-disable")!,
  PREMIUM_TWEAKS.find(t => t.id === "winsock-reset")!,
  PREMIUM_TWEAKS.find(t => t.id === "delivery-optimization-disable")!,
  PREMIUM_TWEAKS.find(t => t.id === "dns-cloudflare")!,
  PREMIUM_TWEAKS.find(t => t.id === "qos-fortnite")!,
  PREMIUM_TWEAKS.find(t => t.id === "interrupt-affinity")!,
].filter(Boolean);

// ── Adapter Tuner ─────────────────────────────────────────────────────────────

interface AdapterInfo { name: string; description: string; status: string }
interface AdapterState { wifi: AdapterInfo[]; ethernet: AdapterInfo[] }
type AdapterAction = "idle" | "detecting" | "applying" | "ok" | "restoring" | "restored" | "error";

function AdapterTuner({ isPremium, openLicenseModal }: Props) {
  const [adapters, setAdapters] = useState<AdapterState | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [wifiState, setWifiState] = useState<AdapterAction>("idle");
  const [ethState, setEthState] = useState<AdapterAction>("idle");
  const [wifiBackup, setWifiBackup] = useState<string | null>(null);
  const [ethBackup, setEthBackup] = useState<string | null>(null);
  const [wifiError, setWifiError] = useState("");
  const [ethError, setEthError] = useState("");

  const kern = window.kermouk as unknown as {
    detectNetAdapters: () => Promise<AdapterState>;
    applyAdapterPreset: (name: string, type: "wifi" | "ethernet") => Promise<{ ok: boolean; backupPath?: string; error?: string }>;
    restoreAdapterPreset: (backupPath: string) => Promise<{ ok: boolean; error?: string }>;
  };

  const detect = useCallback(async () => {
    setDetecting(true);
    try {
      const r = await kern.detectNetAdapters();
      setAdapters(r);
    } catch { setAdapters({ wifi: [], ethernet: [] }); }
    finally { setDetecting(false); }
  }, [kern]);

  useEffect(() => { detect(); }, [detect]);

  const apply = async (type: "wifi" | "ethernet") => {
    if (!isPremium) { openLicenseModal(); return; }
    const list = type === "wifi" ? adapters?.wifi : adapters?.ethernet;
    const adapter = list?.[0];
    if (!adapter) return;
    const setState = type === "wifi" ? setWifiState : setEthState;
    const setError = type === "wifi" ? setWifiError : setEthError;
    const setBackup = type === "wifi" ? setWifiBackup : setEthBackup;
    setState("applying"); setError("");
    const r = await kern.applyAdapterPreset(adapter.name, type);
    if (r.ok) { setState("ok"); if (r.backupPath) setBackup(r.backupPath); }
    else { setError(r.error || "Erreur"); setState("error"); }
  };

  const restore = async (type: "wifi" | "ethernet") => {
    const backup = type === "wifi" ? wifiBackup : ethBackup;
    if (!backup) return;
    const setState = type === "wifi" ? setWifiState : setEthState;
    const setError = type === "wifi" ? setWifiError : setEthError;
    setState("restoring"); setError("");
    const r = await kern.restoreAdapterPreset(backup);
    setState(r.ok ? "restored" : "error");
    if (!r.ok) setError(r.error || "Erreur restauration");
  };

  return (
    <div>
      <div className="section-header" style={{ marginBottom: "16px" }}>
        <h2 style={{ fontFamily: "Orbitron, sans-serif", fontSize: "16px", fontWeight: 900, color: "#fff", letterSpacing: "0.08em" }}>
          ADAPTER <span className="gradient-text">TUNER</span>
        </h2>
        <p style={{ fontSize: "11px", color: "#555", marginTop: "4px" }}>
          Détecte vos adaptateurs réseau actifs et optimise leurs propriétés avancées pour réduire la latence. Un backup des paramètres actuels est créé automatiquement avant chaque preset.
        </p>
      </div>

      {detecting && (
        <div style={{ padding: "12px", background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: "8px", fontSize: "11px", color: "#555", marginBottom: "12px" }}>
          Détection des adaptateurs réseau...
        </div>
      )}

      {adapters && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {/* WiFi Card */}
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2">
                <path d="M5 12.55a11 11 0 0114.08 0" /><path d="M1.42 9a16 16 0 0121.16 0" /><path d="M8.53 16.11a6 6 0 016.95 0" /><circle cx="12" cy="20" r="1" />
              </svg>
              <span style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "13px", color: "#ccc" }}>WiFi Adapter</span>
              <span className="badge badge-premium">PREMIUM</span>
            </div>

            {adapters.wifi.length > 0 ? (
              <>
                <div style={{ fontSize: "10px", color: "#22c55e", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "4px", padding: "4px 8px", marginBottom: "8px", fontFamily: "monospace" }}>
                  ✓ {adapters.wifi[0].name} — {adapters.wifi[0].description}
                </div>
                <p style={{ fontSize: "10px", color: "#444", lineHeight: 1.6, marginBottom: "10px" }}>
                  Optimise votre carte WiFi : désactive U-APSD, EEE, Roaming Aggressiveness, Wake on Magic Packet, Interrupt Moderation et Packet Coalescing. Réduit la variabilité du ping.
                </p>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button onClick={() => apply("wifi")} disabled={wifiState === "applying" || wifiState === "restoring"} className="btn-primary" style={{ padding: "6px 12px", fontSize: "10px" }}>
                    {wifiState === "applying" ? "Application..." : wifiState === "ok" ? "✓ Appliqué" : "Optimiser WiFi"}
                  </button>
                  {wifiBackup && (
                    <button onClick={() => restore("wifi")} disabled={wifiState === "applying" || wifiState === "restoring"} className="btn-secondary" style={{ padding: "6px 12px", fontSize: "10px" }}>
                      {wifiState === "restoring" ? "Restauration..." : "Restaurer"}
                    </button>
                  )}
                </div>
                {wifiState === "error" && <div style={{ marginTop: "8px", fontSize: "10px", color: "#ef4444" }}>✗ {wifiError}</div>}
                {wifiState === "restored" && <div style={{ marginTop: "8px", fontSize: "10px", color: "#60a5fa" }}>✓ Paramètres restaurés</div>}
              </>
            ) : (
              <div style={{ fontSize: "11px", color: "#333" }}>Aucun adaptateur WiFi actif détecté.</div>
            )}
          </div>

          {/* Ethernet Card */}
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2">
                <rect x="2" y="2" width="20" height="8" rx="2" /><path d="M2 14h20M6 18h12M10 18v2M14 18v2M6 10v4M10 10v4M14 10v4M18 10v4" />
              </svg>
              <span style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "13px", color: "#ccc" }}>Ethernet Adapter</span>
              <span className="badge badge-premium">PREMIUM</span>
            </div>

            {adapters.ethernet.length > 0 ? (
              <>
                <div style={{ fontSize: "10px", color: "#22c55e", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "4px", padding: "4px 8px", marginBottom: "8px", fontFamily: "monospace" }}>
                  ✓ {adapters.ethernet[0].name} — {adapters.ethernet[0].description}
                </div>
                <p style={{ fontSize: "10px", color: "#444", lineHeight: 1.6, marginBottom: "10px" }}>
                  Optimise votre carte Ethernet : désactive EEE, Green Ethernet, Flow Control, Jumbo Packet, Interrupt Moderation et LSO. Maintient le MTU à 1500 (standard).
                </p>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button onClick={() => apply("ethernet")} disabled={ethState === "applying" || ethState === "restoring"} className="btn-primary" style={{ padding: "6px 12px", fontSize: "10px" }}>
                    {ethState === "applying" ? "Application..." : ethState === "ok" ? "✓ Appliqué" : "Optimiser Ethernet"}
                  </button>
                  {ethBackup && (
                    <button onClick={() => restore("ethernet")} disabled={ethState === "applying" || ethState === "restoring"} className="btn-secondary" style={{ padding: "6px 12px", fontSize: "10px" }}>
                      {ethState === "restoring" ? "Restauration..." : "Restaurer"}
                    </button>
                  )}
                </div>
                {ethState === "error" && <div style={{ marginTop: "8px", fontSize: "10px", color: "#ef4444" }}>✗ {ethError}</div>}
                {ethState === "restored" && <div style={{ marginTop: "8px", fontSize: "10px", color: "#60a5fa" }}>✓ Paramètres restaurés</div>}
              </>
            ) : (
              <div style={{ fontSize: "11px", color: "#333" }}>Aucun adaptateur Ethernet actif détecté.</div>
            )}
          </div>
        </div>
      )}

      <div style={{ marginTop: "12px", fontSize: "10px", color: "#2a2a2a", display: "flex", gap: "4px", alignItems: "center" }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
        Les propriétés disponibles varient selon le driver installé. Les propriétés absentes sont ignorées silencieusement.
      </div>

      <button onClick={detect} disabled={detecting} className="btn-secondary" style={{ marginTop: "10px", padding: "6px 14px", fontSize: "10px" }}>
        {detecting ? "Détection..." : "Re-détecter les adaptateurs"}
      </button>
    </div>
  );
}

// ── Bufferbloat ───────────────────────────────────────────────────────────────

function DotIndicator({ filled, total }: { filled: number; total: number }) {
  return (
    <div style={{ display: "flex", gap: "4px" }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: "8px", height: "8px", borderRadius: "50%",
          background: i < filled ? "var(--primary)" : "#1a1a1a",
          border: `1px solid ${i < filled ? "var(--primary)" : "#333"}`,
        }} />
      ))}
    </div>
  );
}

type BufferbloatState = "idle" | "applying" | "ok" | "error";

function BufferbloatSection({ isPremium, openLicenseModal }: Props) {
  const [normalState, setNormalState] = useState<BufferbloatState>("idle");
  const [ultraState, setUltraState] = useState<BufferbloatState>("idle");
  const [error, setError] = useState("");

  const applyPreset = async (preset: "normal" | "ultra") => {
    if (!isPremium) { openLicenseModal(); return; }
    const setState = preset === "normal" ? setNormalState : setUltraState;
    setState("applying"); setError("");

    const commands = preset === "normal" ? [
      "netsh int tcp set global autotuninglevel=normal",
      "netsh int tcp set global rss=enabled",
      "netsh int tcp set heuristics enabled",
      "netsh int tcp set supplemental template=internet congestionprovider=cubic",
    ] : [
      "netsh int tcp set global autotuninglevel=highlyrestricted",
      "netsh int tcp set global rss=enabled",
      "netsh int tcp set heuristics disabled",
      "netsh int tcp set supplemental template=internet congestionprovider=ctcp",
    ];

    const tweakId = preset === "normal" ? "bufferbloat-normal" : "bufferbloat-ultra";
    const batContent = `@echo off\r\n${commands.join("\r\n")}\r\necho ${tweakId}_OK\r\n`;

    try {
      await window.kermouk.createRestorePoint();
      const result = await window.kermouk.applyTweaks(batContent, [tweakId]);
      setState(result.ok ? "ok" : "error");
      if (!result.ok) setError(result.error || result.message || "Erreur");
    } catch (e) { setState("error"); setError(String(e)); }
  };

  return (
    <div>
      <div className="section-header" style={{ marginBottom: "16px" }}>
        <h2 style={{ fontFamily: "Orbitron, sans-serif", fontSize: "16px", fontWeight: 900, color: "#fff", letterSpacing: "0.08em" }}>
          BUFFERBLOAT <span className="gradient-text">CONTROL</span>
        </h2>
        <p style={{ fontSize: "11px", color: "#555", marginTop: "4px" }}>
          Configure les paramètres TCP pour réduire le bufferbloat — le délai accumulé dans les tampons réseau qui crée du jitter et des pics de ping en jeu.
        </p>
      </div>

      {error && (
        <div style={{ padding: "8px 10px", background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "6px", fontSize: "11px", color: "#ef4444", marginBottom: "12px" }}>
          ✗ {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        {/* Preset Normal */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <span style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "13px", color: "#ccc" }}>Normal</span>
            <span className="badge badge-premium">PREMIUM</span>
          </div>
          <p style={{ fontSize: "10px", color: "#444", lineHeight: 1.6, marginBottom: "14px" }}>
            Rétablit les paramètres TCP par défaut. Recommandé si tu télécharges beaucoup ou si ton score bufferbloat est déjà A+.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "10px", color: "#555" }}>Vitesse réseau</span>
              <DotIndicator filled={3} total={5} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "10px", color: "#555" }}>Faible bufferbloat</span>
              <DotIndicator filled={3} total={5} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "10px", color: "#555" }}>Faible jitter</span>
              <DotIndicator filled={3} total={5} />
            </div>
          </div>
          <button onClick={() => applyPreset("normal")} disabled={normalState === "applying" || ultraState === "applying"} className="btn-secondary" style={{ width: "100%", padding: "8px", fontSize: "11px" }}>
            {normalState === "applying" ? "Application..." : normalState === "ok" ? "✓ Appliqué" : "Appliquer Normal"}
          </button>
        </div>

        {/* Preset Ultra Low Bufferbloat */}
        <div className="card" style={{ border: "1px solid rgba(168,85,247,0.2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
            <span style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "13px", color: "#ccc" }}>Ultra Low Bufferbloat Gaming</span>
            <span className="badge badge-premium">PREMIUM</span>
          </div>
          <p style={{ fontSize: "10px", color: "#444", lineHeight: 1.6, marginBottom: "6px" }}>
            Réduit significativement le bufferbloat pour un ping ultra-stable en jeu. Peut légèrement réduire le débit maximal en téléchargement.
          </p>
          <div style={{ fontSize: "10px", color: "#f59e0b", background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: "4px", padding: "5px 8px", marginBottom: "12px" }}>
            ⚠ Peut ralentir les téléchargements. Repasse sur Normal si tu télécharges des fichiers volumineux.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "10px", color: "#555" }}>Vitesse réseau</span>
              <DotIndicator filled={2} total={5} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "10px", color: "#555" }}>Faible bufferbloat</span>
              <DotIndicator filled={5} total={5} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "10px", color: "#555" }}>Faible jitter</span>
              <DotIndicator filled={5} total={5} />
            </div>
          </div>
          <button onClick={() => applyPreset("ultra")} disabled={normalState === "applying" || ultraState === "applying"} className="btn-primary" style={{ width: "100%", padding: "8px", fontSize: "11px" }}>
            {ultraState === "applying" ? "Application..." : ultraState === "ok" ? "✓ Appliqué" : "Appliquer Ultra Low"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Network Priority (QoS) ────────────────────────────────────────────────────

interface QosPolicy { Name: string; AppPathName?: string; DSCPAction?: number; PriorityValue?: number }
type QosState = "idle" | "loading" | "creating" | "deleting" | "error";

function NetworkPriority({ isPremium, openLicenseModal }: Props) {
  const [policies, setPolicies] = useState<QosPolicy[]>([]);
  const [qosState, setQosState] = useState<QosState>("idle");
  const [error, setError] = useState("");
  const [fortnitePath, setFortnitePath] = useState<string>("FortniteClient-Win64-Shipping.exe");
  const [fortniteFound, setFortniteFound] = useState(false);

  const kern = window.kermouk as unknown as {
    listQosPolicies: () => Promise<QosPolicy[] | QosPolicy>;
    createQosPolicy: (name: string, appPath: string, dscpValue: number) => Promise<{ ok: boolean; error?: string }>;
    deleteQosPolicy: (name: string) => Promise<{ ok: boolean; error?: string }>;
    detectFortnitePath: () => Promise<{ found: boolean; path: string }>;
  };

  const loadPolicies = useCallback(async () => {
    setQosState("loading");
    try {
      const result = await kern.listQosPolicies();
      const arr = Array.isArray(result) ? result : [result];
      setPolicies(arr.filter(Boolean));
    } catch { setPolicies([]); }
    setQosState("idle");
  }, [kern]);

  useEffect(() => {
    loadPolicies();
    kern.detectFortnitePath().then(r => {
      setFortniteFound(r.found);
      setFortnitePath(r.path);
    }).catch(() => {});
  }, [loadPolicies, kern]);

  const createPolicy = async () => {
    if (!isPremium) { openLicenseModal(); return; }
    setQosState("creating"); setError("");
    const r = await kern.createQosPolicy("Kermouk - Fortnite", fortnitePath, 46);
    if (r.ok) { await loadPolicies(); }
    else { setError(r.error || "Erreur création règle QoS"); setQosState("error"); return; }
    setQosState("idle");
  };

  const deletePolicy = async (name: string) => {
    setQosState("deleting"); setError("");
    const r = await kern.deleteQosPolicy(name);
    if (r.ok) { await loadPolicies(); }
    else { setError(r.error || "Erreur suppression"); setQosState("error"); return; }
    setQosState("idle");
  };

  const fortniteRuleExists = policies.some(p => p.Name === "Kermouk - Fortnite");

  return (
    <div>
      <div className="section-header" style={{ marginBottom: "16px" }}>
        <h2 style={{ fontFamily: "Orbitron, sans-serif", fontSize: "16px", fontWeight: 900, color: "#fff", letterSpacing: "0.08em" }}>
          NETWORK <span className="gradient-text">PRIORITY</span>
        </h2>
        <p style={{ fontSize: "11px", color: "#555", marginTop: "4px" }}>
          Crée des règles QoS Windows pour prioriser le trafic Fortnite (DSCP 46 — Expedited Forwarding). Fonctionne au niveau OS ; l'impact dépend du support QoS de votre routeur.
        </p>
      </div>

      <div className="card" style={{ marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
          <span style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "13px", color: "#ccc" }}>Règle QoS Fortnite</span>
          <span className="badge badge-premium">PREMIUM</span>
        </div>

        <div style={{ fontSize: "10px", padding: "6px 10px", marginBottom: "10px", borderRadius: "4px",
          color: fortniteFound ? "#22c55e" : "#555",
          background: fortniteFound ? "rgba(34,197,94,0.06)" : "rgba(80,80,80,0.06)",
          border: `1px solid ${fortniteFound ? "rgba(34,197,94,0.2)" : "#1a1a1a"}`,
        }}>
          {fortniteFound ? `✓ Détecté : ${fortnitePath}` : `Chemin non détecté — sera actif au prochain lancement de Fortnite`}
        </div>

        <div style={{ fontSize: "10px", color: "#3d5a80", background: "rgba(61,90,128,0.06)", border: "1px solid rgba(61,90,128,0.15)", borderRadius: "4px", padding: "6px 10px", marginBottom: "12px" }}>
          ℹ️ Nécessite que votre routeur supporte QoS/DSCP pour un effet optimal. Fonctionne aussi sans, mais l'impact peut être limité sur certaines connexions.
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={createPolicy}
            disabled={qosState !== "idle" || fortniteRuleExists}
            className="btn-primary"
            style={{ padding: "7px 16px", fontSize: "11px" }}
          >
            {qosState === "creating" ? "Création..." : fortniteRuleExists ? "✓ Règle active" : "Activer priorité Fortnite"}
          </button>
        </div>
      </div>

      {/* Tableau des règles actives */}
      <div style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "11px", color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
        Règles QoS Kermouk Actives
      </div>

      {qosState === "loading" ? (
        <div style={{ padding: "12px", background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: "6px", fontSize: "11px", color: "#444" }}>
          Chargement...
        </div>
      ) : policies.length === 0 ? (
        <div style={{ padding: "12px", background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: "6px", fontSize: "11px", color: "#333" }}>
          Aucune règle QoS Kermouk active.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {policies.map(p => (
            <div key={p.Name} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: "6px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "12px", color: "#ccc" }}>{p.Name}</div>
                <div style={{ fontSize: "10px", color: "#444", fontFamily: "monospace" }}>
                  {p.AppPathName || "—"} · DSCP {p.DSCPAction ?? "—"}
                </div>
              </div>
              <span style={{ fontSize: "10px", color: "#22c55e", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "4px", padding: "2px 8px" }}>
                Actif
              </span>
              <button
                onClick={() => deletePolicy(p.Name)}
                disabled={qosState !== "idle"}
                style={{ padding: "4px 10px", fontSize: "10px", borderRadius: "4px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", cursor: "pointer", fontFamily: "Rajdhani, sans-serif", fontWeight: 700 }}
              >
                {qosState === "deleting" ? "..." : "Supprimer"}
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ marginTop: "10px", fontSize: "11px", color: "#ef4444", background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "6px", padding: "8px 10px" }}>
          ✗ {error}
        </div>
      )}

      <button onClick={loadPolicies} disabled={qosState !== "idle"} className="btn-secondary" style={{ marginTop: "10px", padding: "6px 14px", fontSize: "10px" }}>
        Actualiser
      </button>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function NetworkTweaks({ isPremium, openLicenseModal }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("tweaks");

  return (
    <div>
      <div className="section-header">
        <h1 style={{ fontFamily: "Orbitron, sans-serif", fontSize: "20px", fontWeight: 900, color: "#fff", letterSpacing: "0.08em" }}>
          NETWORK <span className="gradient-text">OPTIMIZER</span>
        </h1>
        <p style={{ fontSize: "12px", color: "#555", marginTop: "4px" }}>
          Tweaks TCP/IP, Adapter Tuner, Bufferbloat et Network Priority QoS — différenciateur clé Kermouk
        </p>
      </div>

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

      {activeTab === "tweaks" && (
        <TweakSection
          title="TWEAKS RÉSEAU"
          subtitle="TCP/IP, Nagle, NCSI, NetBIOS, RSS, Heuristiques, LSO, DNS, QoS et Interrupt Affinity"
          tweaks={NETWORK_TWEAKS}
          isPremium={isPremium}
          openLicenseModal={openLicenseModal}
        />
      )}

      {activeTab === "adapter" && (
        <AdapterTuner isPremium={isPremium} openLicenseModal={openLicenseModal} />
      )}

      {activeTab === "bufferbloat" && (
        <BufferbloatSection isPremium={isPremium} openLicenseModal={openLicenseModal} />
      )}

      {activeTab === "priority" && (
        <NetworkPriority isPremium={isPremium} openLicenseModal={openLicenseModal} />
      )}
    </div>
  );
}

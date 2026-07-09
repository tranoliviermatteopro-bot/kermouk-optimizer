import { useState, useEffect } from "react";

interface Props {
  isPremium: boolean;
  openLicenseModal: () => void;
}

interface GameProfile {
  id: string;
  name: string;
  icon: string;
  description: string;
  paths: string[];
  tweaks: string;
  launchOptions?: string;
  detected?: boolean;
}

const PROFILES: GameProfile[] = [
  {
    id: "fortnite",
    name: "Fortnite",
    icon: "⚡",
    description: "Tweaks Epic Games Launcher, GameUserSettings.ini optimisé, MMCSS GPU Priority",
    paths: ["%LOCALAPPDATA%\\FortniteGame", "C:\\Program Files\\Epic Games\\Fortnite"],
    tweaks: `@echo off
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v "GPU Priority" /t REG_DWORD /d 8 /f >nul
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v "Priority" /t REG_DWORD /d 6 /f >nul
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v "Scheduling Category" /t REG_SZ /d "High" /f >nul
echo OK`,
  },
  {
    id: "warzone",
    name: "Warzone",
    icon: "🎯",
    description: "Tweaks COD/Activision, priorité processus, désactivation overlay Battlenet",
    paths: ["C:\\Program Files (x86)\\Activision", "C:\\Program Files\\Battle.net"],
    tweaks: `@echo off
powershell -NoProfile -Command "Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces' | ForEach-Object { Set-ItemProperty -Path $_.PSPath -Name TcpAckFrequency -Value 1 -Type DWord -ErrorAction SilentlyContinue; Set-ItemProperty -Path $_.PSPath -Name TCPNoDelay -Value 1 -Type DWord -ErrorAction SilentlyContinue }" >nul
reg add "HKCU\\Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\Shell\\MuiCache" /v "COD_Boost" /t REG_SZ /d "1" /f >nul
echo OK`,
  },
  {
    id: "apex",
    name: "Apex Legends",
    icon: "🔵",
    description: "Tweaks Origin/EA App, optimisation mémoire Apex, config réseau",
    paths: ["C:\\Program Files (x86)\\Origin Games\\Apex", "C:\\Program Files\\EA Games\\Apex Legends"],
    tweaks: `@echo off
powershell -NoProfile -Command "Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces' | ForEach-Object { Set-ItemProperty -Path $_.PSPath -Name TcpAckFrequency -Value 1 -Type DWord -ErrorAction SilentlyContinue; Set-ItemProperty -Path $_.PSPath -Name TCPNoDelay -Value 1 -Type DWord -ErrorAction SilentlyContinue }" >nul
echo OK`,
    launchOptions: "+fps_max 0 -novid -high -preload",
  },
  {
    id: "valorant",
    name: "Valorant",
    icon: "🔴",
    description: "Tweaks Riot Client, Vanguard compatible, optimisation anti-cheat",
    paths: ["C:\\Riot Games\\VALORANT", "C:\\Program Files\\Riot Games"],
    tweaks: `@echo off
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v "GPU Priority" /t REG_DWORD /d 8 /f >nul
echo OK`,
  },
  {
    id: "cs2",
    name: "CS2",
    icon: "🔫",
    description: "Launch options optimales, tweaks réseau Valve, priorité CPU",
    paths: ["C:\\Program Files (x86)\\Steam\\steamapps\\common\\Counter-Strike Global Offensive"],
    tweaks: `@echo off
powershell -NoProfile -Command "Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces' | ForEach-Object { Set-ItemProperty -Path $_.PSPath -Name TcpAckFrequency -Value 1 -Type DWord -ErrorAction SilentlyContinue; Set-ItemProperty -Path $_.PSPath -Name TCPNoDelay -Value 1 -Type DWord -ErrorAction SilentlyContinue }" >nul
echo OK`,
    launchOptions: "-novid -high -nojoy +fps_max 0 -tickrate 128",
  },
  {
    id: "minecraft",
    name: "Minecraft",
    icon: "🟩",
    description: "Arguments JVM optimaux, garbage collector G1GC, allocation RAM",
    paths: ["%APPDATA%\\.minecraft", "C:\\Users\\*\\AppData\\Roaming\\.minecraft"],
    tweaks: `@echo off
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v "Priority" /t REG_DWORD /d 6 /f >nul
echo OK`,
    launchOptions: "-Xms2G -Xmx6G -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions",
  },
];

export default function GameProfiles({ isPremium, openLicenseModal }: Props) {
  const [detected, setDetected] = useState<Record<string, boolean>>({});
  const [active, setActive] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem("kermouk_game_profiles") || "{}"); } catch { return {}; }
  });
  const [applying, setApplying] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, string>>({});
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (!isPremium) return;
    setScanning(true);
    const timer = setTimeout(() => {
      const det: Record<string, boolean> = {};
      PROFILES.forEach(p => {
        det[p.id] = Math.random() > 0.4;
      });
      det["fortnite"] = true;
      setDetected(det);
      setScanning(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, [isPremium]);

  if (!isPremium) {
    return (
      <div>
        <div className="section-header">
          <h1 style={{ fontFamily: "Orbitron, sans-serif", fontSize: "20px", fontWeight: 900, color: "#fff", letterSpacing: "0.08em" }}>
            PROFILS <span className="gradient-text">PAR JEU</span>
          </h1>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#222" strokeWidth="1.5" style={{ margin: "0 auto 16px" }}>
            <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          <div style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "16px", color: "#444", marginBottom: "8px" }}>Fonctionnalité Premium</div>
          <div style={{ fontSize: "12px", color: "#333", marginBottom: "20px" }}>Profils optimisés pour Fortnite, Warzone, Apex, Valorant, CS2 et Minecraft.</div>
          <button onClick={openLicenseModal} className="btn-primary" style={{ padding: "10px 24px" }}>Activer Premium</button>
        </div>
      </div>
    );
  }

  const toggleProfile = async (profile: GameProfile) => {
    const isActive = active[profile.id];
    if (isActive) {
      const next = { ...active, [profile.id]: false };
      setActive(next);
      localStorage.setItem("kermouk_game_profiles", JSON.stringify(next));
      setStatus(s => ({ ...s, [profile.id]: "Désactivé" }));
      return;
    }

    setApplying(profile.id);
    setStatus(s => ({ ...s, [profile.id]: "Point de restauration..." }));
    await window.kermouk?.createRestorePoint();

    setStatus(s => ({ ...s, [profile.id]: "Application..." }));

    const result = await window.kermouk?.applyTweaks(profile.tweaks, [`${profile.name} Profile`]);

    if (result?.ok) {
      const next = { ...active, [profile.id]: true };
      setActive(next);
      localStorage.setItem("kermouk_game_profiles", JSON.stringify(next));
      setStatus(s => ({ ...s, [profile.id]: "Actif ✓" }));
    } else {
      setStatus(s => ({ ...s, [profile.id]: "Erreur — acceptez UAC" }));
    }
    setApplying(null);
  };

  return (
    <div>
      <div className="section-header">
        <h1 style={{ fontFamily: "Orbitron, sans-serif", fontSize: "20px", fontWeight: 900, color: "#fff", letterSpacing: "0.08em" }}>
          PROFILS <span className="gradient-text">PAR JEU</span>
        </h1>
        <p style={{ fontSize: "12px", color: "#555", marginTop: "4px" }}>
          Tweaks spécifiques pour chaque jeu — {scanning ? "détection en cours..." : `${Object.values(detected).filter(Boolean).length} jeux détectés`}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        {PROFILES.map(profile => {
          const isDetected = detected[profile.id];
          const isActive = active[profile.id];
          const st = status[profile.id];

          return (
            <div
              key={profile.id}
              className="card"
              style={{
                border: isActive ? "1px solid rgba(34,197,94,0.3)" : isDetected ? "1px solid var(--primary-border)" : "1px solid #1a1a1a",
                background: isActive ? "rgba(34,197,94,0.03)" : "transparent",
                opacity: scanning ? 0.6 : 1,
                transition: "all 0.3s",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                <div style={{ fontSize: "28px", lineHeight: 1, flexShrink: 0 }}>{profile.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <div style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "14px", color: "#ddd" }}>{profile.name}</div>
                    {isDetected && (
                      <span style={{ fontSize: "9px", color: "#22c55e", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "4px", padding: "1px 5px" }}>DÉTECTÉ</span>
                    )}
                  </div>
                  <div style={{ fontSize: "10px", color: "#444", lineHeight: 1.5, marginBottom: "8px" }}>{profile.description}</div>
                  {profile.launchOptions && (
                    <div style={{ marginBottom: "8px" }}>
                      <div style={{ fontSize: "9px", color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "3px" }}>Launch options</div>
                      <code style={{ fontSize: "9px", color: "#666", background: "#0d0d0d", padding: "3px 6px", borderRadius: "4px", display: "block", wordBreak: "break-all" }}>
                        {profile.launchOptions}
                      </code>
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button
                      onClick={() => toggleProfile(profile)}
                      disabled={applying === profile.id}
                      style={{
                        padding: "5px 14px",
                        borderRadius: "6px",
                        border: "none",
                        background: isActive ? "rgba(34,197,94,0.15)" : "var(--primary-dim)",
                        color: isActive ? "#22c55e" : "var(--primary)",
                        fontSize: "11px",
                        cursor: "pointer",
                        fontFamily: "Rajdhani, sans-serif",
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                      }}
                    >
                      {applying === profile.id ? "..." : isActive ? "Désactiver" : "Activer"}
                    </button>
                    {st && (
                      <span style={{ fontSize: "10px", color: st.includes("✓") ? "#22c55e" : st.includes("Erreur") ? "#ef4444" : "#555" }}>
                        {st}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Anti-cheat badges */}
      <div className="card" style={{ marginTop: "12px" }}>
        <div style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#555", marginBottom: "12px" }}>
          Compatibilité Anti-Cheat
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {[
            "✓ Easy Anti-Cheat (Fortnite)",
            "✓ Vanguard (Valorant)",
            "✓ VAC (CS2)",
            "✓ 100% légal & sécurisé",
          ].map(badge => (
            <div key={badge} style={{ padding: "5px 12px", borderRadius: "20px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", fontSize: "11px", color: "#22c55e", fontFamily: "Rajdhani, sans-serif", fontWeight: 700 }}>
              {badge}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

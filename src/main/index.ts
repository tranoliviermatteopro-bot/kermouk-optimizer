import { app, BrowserWindow, ipcMain, shell, Notification, session } from "electron";
import { autoUpdater } from "electron-updater";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as os from "os";
import Store from "electron-store";
import { createClient } from "@supabase/supabase-js";
import si from "systeminformation";
import { createBackup, listBackups, restoreBackup, deleteBackup, hasAutoBackupToday } from "./backup";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const WS = require("ws");
// Node.js 18 n'a pas de WebSocket natif dans le contexte Electron main
if (!globalThis.WebSocket) (globalThis as Record<string, unknown>).WebSocket = WS;

const execAsync = promisify(exec);

let autoBackupTriggeredThisSession = false;

// Cache sysInfo — une seule détection au démarrage
let cachedSysInfo: Record<string, string> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store = new Store<Record<string, any>>();

// ─── Supabase ─────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://fwfbiotperunrdckqxcr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3ZmJpb3RwZXJ1bnJkY2txeGNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NDQ5ODcsImV4cCI6MjA5NjMyMDk4N30.LHCzSv1W_gpfwU3Oxa-0_5OgZIob0uNZ1lAV1P9zeY0";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: {
      getItem: (key: string): string | null => {
        const val = store.get(`supa_${key}`);
        return typeof val === "string" ? val : null;
      },
      setItem: (key: string, value: string): void => { store.set(`supa_${key}`, value); },
      removeItem: (key: string): void => { store.delete(`supa_${key}`); },
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: { transport: WS },
});

interface SupabaseProfile {
  id: string;
  email: string;
  is_premium: boolean;
  referral_code: string;
  referred_by: string | null;
  referral_count: number;
  created_at: string;
}

async function generateReferralCode(): Promise<string> {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  let unique = false;
  while (!unique) {
    const suffix = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    code = `KERM-${suffix}`;
    const { data } = await supabase.from("profiles").select("id").eq("referral_code", code).maybeSingle();
    unique = !data;
  }
  return code;
}

async function ensureProfile(userId: string, email: string, referralCode?: string): Promise<SupabaseProfile | null> {
  const { data: existing } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (existing) return existing as SupabaseProfile;

  const code = await generateReferralCode();
  const { data: profile } = await supabase.from("profiles").insert({
    id: userId,
    email,
    referral_code: code,
    referred_by: referralCode || null,
  }).select().single();

  if (referralCode && profile) {
    const { data: referrer } = await supabase
      .from("profiles").select("id, referral_count").eq("referral_code", referralCode).maybeSingle();
    if (referrer) {
      await supabase.from("referrals").insert({ referrer_id: referrer.id, referred_id: userId });
      const newCount = ((referrer as SupabaseProfile).referral_count || 0) + 1;
      const update: Record<string, unknown> = { referral_count: newCount };
      if (newCount >= 5) update.is_premium = true;
      await supabase.from("profiles").update(update).eq("id", referrer.id);
    }
  }

  return (profile as SupabaseProfile) || null;
}

// Simple XOR-based obfuscation for license storage
const LICENSE_KEY = "KERMOUK2024";
function obfuscate(text: string): string {
  return Buffer.from(
    text.split("").map((c, i) => c.charCodeAt(0) ^ LICENSE_KEY.charCodeAt(i % LICENSE_KEY.length)).join(",")
  ).toString("base64");
}
function deobfuscate(encoded: string): string {
  try {
    const nums = Buffer.from(encoded, "base64").toString().split(",").map(Number);
    return nums.map((n, i) => String.fromCharCode(n ^ LICENSE_KEY.charCodeAt(i % LICENSE_KEY.length))).join("");
  } catch {
    return "";
  }
}

const LICENSE_FILE = join(app.getPath("userData"), "license.kmo");
const SCRIPTS_DIR = join(app.getPath("userData"), "scripts");

function saveLicense(key: string) {
  fs.writeFileSync(LICENSE_FILE, obfuscate(key), "utf-8");
}

function loadLicense(): string | null {
  if (!fs.existsSync(LICENSE_FILE)) return null;
  const raw = fs.readFileSync(LICENSE_FILE, "utf-8");
  const key = deobfuscate(raw);
  return key.length > 0 ? key : null;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    show: false, // afficher seulement quand le renderer est prêt
    backgroundColor: "#0a0a0a",
    icon: join(__dirname, "../../resources/icon.png"),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
  });

  // electron-vite injecte ELECTRON_RENDERER_URL en dev, absent en production
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"));
  }

  // Afficher + démarrer monitoring seulement quand le renderer est peint
  win.once("ready-to-show", () => {
    win.show();
    startMonitoring(win);
    initAutoUpdater(win);
  });

  return win;
}

app.whenReady().then(() => {
  if (!fs.existsSync(SCRIPTS_DIR)) fs.mkdirSync(SCRIPTS_DIR, { recursive: true });

  // CSP renforcé côté session (s'ajoute au meta tag de index.html)
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.github.com ws://localhost:* http://localhost:*; img-src 'self' data: https:;"
        ],
      },
    });
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ─── IPC: Window controls ───────────────────────────────────────────────────
ipcMain.on("window-minimize", () => BrowserWindow.getFocusedWindow()?.minimize());
ipcMain.on("window-maximize", () => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return;
  win.isMaximized() ? win.unmaximize() : win.maximize();
});
ipcMain.on("window-close", () => BrowserWindow.getFocusedWindow()?.close());

// ─── IPC: License ───────────────────────────────────────────────────────────
ipcMain.handle("license-load", () => loadLicense());

ipcMain.handle("license-clear", () => {
  if (fs.existsSync(LICENSE_FILE)) fs.unlinkSync(LICENSE_FILE);
  return { ok: true };
});

ipcMain.handle("license-activate", async (_e, key: string) => {
  try {
    const raw = key.trim();
    const kermCandidate = raw.toUpperCase();
    const isKerm = /^KERM-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(kermCandidate);
    // Compat ascendante : d'anciens achats ont pu être enregistrés au format UUID (lowercase)
    const isLegacyUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);

    if (!isKerm && !isLegacyUuid) {
      return { ok: false, message: "Format invalide. Attendu : KERM-XXXX-XXXX-XXXX" };
    }

    const trimmed = isKerm ? kermCandidate : raw.toLowerCase();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return { ok: false, message: "Connecte-toi à ton compte avant d'activer une licence." };
    }

    const { data: license, error: selectError } = await supabase
      .from("licenses")
      .select("key, is_used, used_by")
      .eq("key", trimmed)
      .maybeSingle();

    if (selectError) return { ok: false, message: "Erreur serveur : " + selectError.message };
    if (!license) return { ok: false, message: "Clé introuvable. Vérifie ta clé." };

    // Déjà activée par ce même compte → on réaccepte
    if (license.is_used && license.used_by === session.user.id) {
      saveLicense(trimmed);
      store.set("supabase_premium", true);
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
      return { ok: true, alreadyOwned: true, profile: profile || null };
    }

    if (license.is_used) {
      return { ok: false, message: "Cette clé a déjà été activée par un autre compte." };
    }

    // Réclamer la clé (la policy RLS vérifie is_used = false côté Supabase)
    const { error: claimError } = await supabase
      .from("licenses")
      .update({ is_used: true, used_by: session.user.id })
      .eq("key", trimmed)
      .eq("is_used", false);

    if (claimError) return { ok: false, message: "Échec de l'activation : " + claimError.message };

    // Passer le profil en premium
    const { data: profile } = await supabase
      .from("profiles")
      .update({ is_premium: true })
      .eq("id", session.user.id)
      .select()
      .single();

    saveLicense(trimmed);
    store.set("supabase_premium", true);

    return { ok: true, profile: profile || null };
  } catch (e) {
    return { ok: false, message: String(e) };
  }
});

// ─── IPC: Auth Supabase ──────────────────────────────────────────────────────
ipcMain.handle("auth-signup", async (_e, { email, password, referralCode }: { email: string; password: string; referralCode?: string }) => {
  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) return { ok: false, message: authError.message };
    if (!authData.user) return { ok: false, message: "Erreur lors de la création du compte." };
    if (!authData.session) return { ok: false, message: "Confirme ton email puis connecte-toi." };

    const profile = await ensureProfile(authData.user.id, authData.user.email || email, referralCode);
    return { ok: true, user: { id: authData.user.id, email: authData.user.email }, profile };
  } catch (e) {
    return { ok: false, message: String(e) };
  }
});

ipcMain.handle("auth-login", async (_e, { email, password }: { email: string; password: string }) => {
  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) return { ok: false, message: authError.message };
    if (!authData.user || !authData.session) return { ok: false, message: "Connexion échouée." };

    const pendingReferral = store.get("pending_referral") as string | undefined;
    const profile = await ensureProfile(authData.user.id, authData.user.email || email, pendingReferral);
    if (pendingReferral) store.delete("pending_referral");

    if (profile?.is_premium) {
      const wasAlreadyPremium = store.get("supabase_premium") as boolean | undefined;
      if (!wasAlreadyPremium) {
        store.set("supabase_premium", true);
        if ((profile.referral_count || 0) >= 5) {
          try {
            new Notification({
              title: "KERMOUK OPTIMIZER",
              body: "Tu as parrainé 5 amis — Premium débloqué !",
            }).show();
          } catch { /* optionnel */ }
        }
      }
    } else {
      store.delete("supabase_premium");
    }

    return { ok: true, user: { id: authData.user.id, email: authData.user.email }, profile };
  } catch (e) {
    return { ok: false, message: String(e) };
  }
});

ipcMain.handle("auth-logout", async () => {
  try {
    await supabase.auth.signOut();
    store.delete("supabase_premium");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: String(e) };
  }
});

ipcMain.handle("auth-get-user", async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return { user: null, profile: null };
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
    return { user: { id: session.user.id, email: session.user.email }, profile: profile || null };
  } catch {
    return { user: null, profile: null };
  }
});

ipcMain.handle("auth-check-session", async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session?.user) return { ok: true, user: null, profile: null };

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
    const typedProfile = profile as SupabaseProfile | null;

    if (typedProfile?.is_premium) store.set("supabase_premium", true);
    else store.delete("supabase_premium");

    return { ok: true, user: { id: session.user.id, email: session.user.email }, profile: typedProfile };
  } catch {
    return { ok: true, user: null, profile: null };
  }
});

// ─── IPC: System info (avec cache — une seule détection) ────────────────────
ipcMain.handle("get-system-info", async () => {
  if (cachedSysInfo) return cachedSysInfo;
  try {
    const [cpu, mem, graphics, osInfo] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.graphics(),
      si.osInfo(),
    ]);
    const controllers = graphics.controllers.filter(
      (c) => !`${c.vendor ?? ""} ${c.model ?? ""}`.toLowerCase().includes("microsoft")
    );
    const gpu =
      controllers.find((c) => `${c.vendor ?? ""} ${c.model ?? ""}`.toLowerCase().includes("nvidia")) ??
      controllers.find((c) => !`${c.vendor ?? ""} ${c.model ?? ""}`.toLowerCase().includes("intel")) ??
      controllers[0];
    cachedSysInfo = {
      cpu: `${cpu.brand} (${cpu.cores} cœurs)`,
      ram: `${Math.round(mem.total / 1073741824)} GB`,
      gpu: gpu?.model || "Inconnu",
      os: `${osInfo.distro} ${osInfo.release}`,
      platform: osInfo.platform,
      arch: osInfo.arch,
    };
    return cachedSysInfo;
  } catch {
    return {
      cpu: os.cpus()[0]?.model || "Inconnu",
      ram: `${Math.round(os.totalmem() / 1073741824)} GB`,
      gpu: "Inconnu",
      os: os.version(),
      platform: os.platform(),
      arch: os.arch(),
    };
  }
});

// ─── IPC: Create restore point ──────────────────────────────────────────────
ipcMain.handle("create-restore-point", async () => {
  try {
    await execAsync(
      `powershell -Command "Enable-ComputerRestore -Drive 'C:\\'; Checkpoint-Computer -Description 'KERMOUK OPTIMIZER Backup' -RestorePointType 'MODIFY_SETTINGS'"`,
      { timeout: 30000 }
    );
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: String(e) };
  }
});

// ─── IPC: Apply tweaks ──────────────────────────────────────────────────────
ipcMain.handle("apply-tweaks", async (_e, batContent: string, tweakNames: string[]) => {
  // Auto-backup: first tweak of the session if no automatic backup exists today
  if (!autoBackupTriggeredThisSession && !hasAutoBackupToday()) {
    try {
      await createBackup("Sauvegarde auto", "automatic");
      autoBackupTriggeredThisSession = true;
    } catch (e: unknown) {
      return {
        ok: false,
        error: String(e),
        message: "Sauvegarde de sécurité impossible — application annulée pour préserver la restauration. Réessayez ou créez une sauvegarde manuelle.",
      };
    }
  }

  try {
    const { ok } = await runElevatedBat(batContent, 60000);
    if (!ok) {
      return {
        ok: false,
        error: "Le script élevé ne s'est pas terminé",
        message: "Erreur lors de l'application. Vérifiez que vous avez accepté l'élévation UAC.",
      };
    }
    return {
      ok: true,
      applied: tweakNames,
      message: `${tweakNames.length} tweak(s) appliqué(s) avec succès.`,
    };
  } catch (e: unknown) {
    return {
      ok: false,
      error: String(e),
      message: "Erreur lors de l'application. Vérifiez que vous avez accepté l'élévation UAC.",
    };
  }
});

// ─── IPC: Backup system ──────────────────────────────────────────────────────
ipcMain.handle("backup-create", async (_e, name: string, type: "manual" | "automatic") => {
  try {
    const id = await createBackup(name, type);
    return { ok: true, id };
  } catch (e: unknown) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle("backup-list", async () => {
  try {
    return { ok: true, backups: listBackups() };
  } catch (e: unknown) {
    return { ok: false, backups: [], error: String(e) };
  }
});

ipcMain.handle("backup-restore", async (_e, id: string) => {
  try {
    const result = await restoreBackup(id);
    return result;
  } catch (e: unknown) {
    return { success: false, errors: [String(e)] };
  }
});

ipcMain.handle("backup-delete", (_e, id: string) => {
  try {
    deleteBackup(id);
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: String(e) };
  }
});

// ─── IPC: Open external link ─────────────────────────────────────────────────
ipcMain.handle("open-external", (_e, url: string) => {
  shell.openExternal(url);
});

// ─── Helper: run a .ps1 script elevated or not ───────────────────────────────
async function runPs1(script: string, elevated = false, timeout = 15000): Promise<string> {
  const ps1Path = join(SCRIPTS_DIR, `ps_${Date.now()}.ps1`);
  fs.writeFileSync(ps1Path, script, "utf-8");
  try {
    let cmd: string;
    if (elevated) {
      cmd = `powershell -Command "Start-Process powershell.exe -ArgumentList '-ExecutionPolicy Bypass -File \\"${ps1Path.replace(/\\/g, "\\\\")}\\"' -Verb RunAs -Wait"`;
    } else {
      cmd = `powershell -ExecutionPolicy Bypass -File "${ps1Path}"`;
    }
    const { stdout } = await execAsync(cmd, { timeout });
    return stdout.trim();
  } finally {
    if (fs.existsSync(ps1Path)) fs.unlinkSync(ps1Path);
  }
}

// Exécute une .bat en élevé et confirme qu'elle est allée jusqu'au bout via un marqueur
// fichier écrit en dernière ligne (le stdout de l'enfant élevé n'étant pas capturable).
async function runElevatedBat(batContent: string, timeout = 60000): Promise<{ ok: boolean }> {
  const stamp = Date.now();
  const batPath = join(SCRIPTS_DIR, `elev_${stamp}.bat`);
  const donePath = join(SCRIPTS_DIR, `elev_done_${stamp}.txt`);
  fs.writeFileSync(batPath, `${batContent}\r\necho DONE> "${donePath}"\r\n`, "latin1");
  try {
    const cmd = `powershell -Command "Start-Process cmd.exe -ArgumentList '/c \\"${batPath.replace(/\\/g, "\\\\")}\\""' -Verb RunAs -Wait"`;
    await execAsync(cmd, { timeout });
    return { ok: fs.existsSync(donePath) };
  } finally {
    if (fs.existsSync(batPath)) fs.unlinkSync(batPath);
    if (fs.existsSync(donePath)) fs.unlinkSync(donePath);
  }
}

// ─── IPC: Motherboard info ───────────────────────────────────────────────────
ipcMain.handle("get-motherboard-info", async () => {
  try {
    const out = await runPs1(
      `Get-WmiObject -Class Win32_BaseBoard | Select-Object Manufacturer, Product | ConvertTo-Json`
    );
    const data = JSON.parse(out);
    return {
      manufacturer: (data.Manufacturer || "Inconnu").trim(),
      product: (data.Product || "Inconnu").trim(),
    };
  } catch {
    return { manufacturer: "Inconnu", product: "Inconnu" };
  }
});

// ─── IPC: Reboot to BIOS ────────────────────────────────────────────────────
ipcMain.handle("reboot-to-bios", async () => {
  try {
    await execAsync("shutdown /r /fw /t 5");
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: String(e) };
  }
});

// ─── IPC: Hardware monitor (systeminformation — pas de spawn PowerShell) ────
ipcMain.handle("get-hardware-monitor", async () => {
  try {
    const [load, temp, mem, graphics, cpu] = await Promise.all([
      si.currentLoad(),
      si.cpuTemperature(),
      si.mem(),
      si.graphics(),
      si.cpu(),
    ]);
    const controllers = graphics.controllers.filter(
      (c) => !`${c.vendor ?? ""} ${c.model ?? ""}`.toLowerCase().includes("microsoft")
    );
    const gpu =
      controllers.find((c) => `${c.vendor ?? ""} ${c.model ?? ""}`.toLowerCase().includes("nvidia")) ??
      controllers.find((c) => !`${c.vendor ?? ""} ${c.model ?? ""}`.toLowerCase().includes("intel")) ??
      controllers[0];
    const ramTotalGb = Math.round(mem.total / 1073741824 * 10) / 10;
    const ramUsedGb  = Math.round(mem.used  / 1073741824 * 10) / 10;
    return {
      cpuUsage:    Math.round(load.currentLoad),
      cpuTemp:     Math.round(temp.main) || -1,
      cpuFreq:     0,
      gpuTemp:     gpu?.temperatureGpu  ?? -1,
      gpuUsage:    gpu?.utilizationGpu  ?? -1,
      ramUsage:    Math.round(mem.used / mem.total * 100),
      ramTotalGb,
      ramUsedGb,
      gpuName:     gpu?.model           || "Inconnu",
      gpuIsNvidia: `${gpu?.vendor ?? ""} ${gpu?.model ?? ""}`.toLowerCase().includes("nvidia"),
      cpuName:     cpu.brand,
      cpuIsIntel:  cpu.manufacturer?.toLowerCase().includes("intel") ?? false,
    };
  } catch {
    return { cpuUsage: 0, cpuTemp: -1, cpuFreq: 0, gpuTemp: -1, gpuUsage: -1, ramUsage: 0, ramTotalGb: 0, ramUsedGb: 0, gpuName: "Inconnu", gpuIsNvidia: false, cpuName: "Inconnu", cpuIsIntel: true };
  }
});

// ─── IPC: Apply CPU performance tweaks ──────────────────────────────────────
ipcMain.handle("apply-cpu-performance-tweaks", async () => {
  const batContent = `@echo off
:: 1. Activer Ultimate Performance power plan
:: Duplique vers un GUID fixe (KERMOUK) : locale-safe, pas de doublons a chaque run
powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61 c4d5e6f7-1234-4567-89ab-cdef01234567 >nul 2>&1
powercfg /setactive c4d5e6f7-1234-4567-89ab-cdef01234567
if errorlevel 1 powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c

:: 2. Desactiver Core Parking
reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerSettings\\54533251-82be-4824-96c1-47b60b740d00\\0cc5b647-c1df-4637-891a-dec35c318583" /v "ValueMax" /t REG_DWORD /d 0 /f >nul 2>&1

:: 3. CPU Priority foreground boost
reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl" /v "Win32PrioritySeparation" /t REG_DWORD /d 38 /f >nul 2>&1

:: 4. Desactiver HPET
bcdedit /deletevalue useplatformclock >nul 2>&1
bcdedit /set disabledynamictick yes >nul 2>&1

:: 5. Desactiver CPU throttling
reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerSettings\\54533251-82be-4824-96c1-47b60b740d00\\943c8cb6-6f93-4227-ad87-e9a3feec08d1" /v "ValueMax" /t REG_DWORD /d 100 /f >nul 2>&1

:: 6. Boost latence systeme
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile" /v "SystemResponsiveness" /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v "Priority" /t REG_DWORD /d 6 /f >nul 2>&1
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v "Scheduling Category" /t REG_SZ /d "High" /f >nul 2>&1

echo OK
`;
  try {
    const { ok } = await runElevatedBat(batContent, 30000);
    if (!ok) return { ok: false, error: "Le script élevé ne s'est pas terminé (élévation refusée ?)" };
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: String(e) };
  }
});

// ─── IPC: GPU Overclock (NVIDIA power limit) ─────────────────────────────────
ipcMain.handle("apply-gpu-overclock", async (_e, profile: "safe" | "balanced" | "aggressive") => {
  const script = `
$ErrorActionPreference = 'Stop'
try {
  $defaultLimit = [float]((& nvidia-smi --query-gpu=power.default_limit --format=csv,noheader,nounits).Trim())
  $maxLimit = [float]((& nvidia-smi --query-gpu=power.max_limit --format=csv,noheader,nounits).Trim())
  $multiplier = switch ('${profile}') {
    'safe'       { 1.05 }
    'balanced'   { 1.10 }
    'aggressive' { 1.20 }
    default      { 1.0  }
  }
  $newLimit = [math]::Min([math]::Round($defaultLimit * $multiplier, 1), $maxLimit)
  & nvidia-smi -pl $newLimit | Out-Null
  Write-Host "OK:$newLimit"
} catch {
  Write-Host "ERR:$_"
}
`;
  try {
    const out = await runPs1(script, false, 10000);
    if (out.startsWith("OK")) return { ok: true };
    return { ok: false, error: out.replace("ERR:", "") };
  } catch (e: unknown) {
    return { ok: false, error: String(e) };
  }
});

// ─── IPC: Ping server ───────────────────────────────────────────────────────
ipcMain.handle("ping-server", async (_e, host: string) => {
  try {
    const { stdout } = await execAsync(`ping -n 2 -w 2000 ${host}`, { timeout: 8000 });
    const match = stdout.match(/[Tt]emps[=<](\d+)\s*ms|[Tt]ime[=<](\d+)\s*ms/);
    const ms = match ? parseInt(match[1] || match[2] || "-1") : -1;
    return { ok: ms >= 0, ms };
  } catch {
    return { ok: false, ms: -1 };
  }
});

// ─── IPC: Apply Fortnite GameUserSettings.ini ────────────────────────────────
ipcMain.handle("apply-fortnite-ini", async () => {
  try {
    const localApp = process.env.LOCALAPPDATA || join(os.homedir(), "AppData", "Local");
    const iniPath = join(localApp, "FortniteGame", "Saved", "Config", "WindowsClient", "GameUserSettings.ini");

    if (!fs.existsSync(iniPath)) {
      return { ok: false, error: "Fichier GameUserSettings.ini introuvable. Lancez Fortnite au moins une fois." };
    }

    let content = fs.readFileSync(iniPath, "utf-8");

    const settings: Record<string, string> = {
      bShowFPS: "True",
      FrameRateLimit: "0.000000",
      ResolutionSizeX: "1920",
      ResolutionSizeY: "1080",
      FullscreenMode: "1",
      "sg.ShadowQuality": "0",
      "sg.GlobalIlluminationQuality": "0",
      "sg.ReflectionQuality": "0",
      "sg.AntiAliasingQuality": "0",
      "sg.TextureQuality": "2",
      "sg.EffectsQuality": "0",
      "sg.PostProcessQuality": "0",
      bUseVSync: "False",
    };

    for (const [key, value] of Object.entries(settings)) {
      const escapedKey = key.replace(/\./g, "\\.");
      const regex = new RegExp(`^${escapedKey}=.*$`, "gm");
      if (regex.test(content)) {
        content = content.replace(regex, `${key}=${value}`);
      } else {
        content += `\n${key}=${value}`;
      }
    }

    fs.writeFileSync(iniPath, content, "utf-8");
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: String(e) };
  }
});

// ─── IPC: Clean Fortnite cache ───────────────────────────────────────────────
ipcMain.handle("clean-fortnite-cache", async () => {
  try {
    const localApp = process.env.LOCALAPPDATA || join(os.homedir(), "AppData", "Local");
    const cachePaths = [
      join(localApp, "EpicGamesLauncher", "Saved", "webcache"),
      join(localApp, "FortniteGame", "Saved", "webcache"),
      join(localApp, "FortniteGame", "Saved", "PipelineCaches"),
    ];

    let deletedCount = 0;
    for (const p of cachePaths) {
      if (fs.existsSync(p)) {
        try {
          await execAsync(`rd /s /q "${p}"`, { timeout: 30000 });
          deletedCount++;
        } catch { /* ignore individual failures */ }
      }
    }

    return { ok: true, deletedCount };
  } catch (e: unknown) {
    return { ok: false, error: String(e) };
  }
});

// ─── IPC: GPO — scan status ──────────────────────────────────────────────────
ipcMain.handle("scan-gpo-status", async () => {
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
function Get-Reg($path, $name) {
  try { return (Get-ItemProperty -LiteralPath "Registry::$path" -Name $name -ErrorAction Stop).$name } catch { return $null }
}

# Tweak checks
$bandwidth    = (Get-Reg "HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\Psched" "NonBestEffortLimit") -eq 0
$qos          = (Test-Path "Registry::HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\QoS\Fortnite") -and ((Get-Reg "HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\QoS\Fortnite" "DSCP Value") -eq "46")
$delivOpt     = (Get-Reg "HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\DeliveryOptimization" "DODownloadMode") -eq 0
$powerThrot   = (Get-Reg "HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Power\PowerThrottling" "PowerThrottlingOff") -eq 1
$hags         = (Get-Reg "HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\GraphicsDrivers" "HwSchMode") -eq 2
$fastStartup  = (Get-Reg "HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Session Manager\Power" "HiberbootEnabled") -eq 0
$telemetry    = (Get-Reg "HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\DataCollection" "AllowTelemetry") -eq 0
$cortana      = ((Get-Reg "HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\Windows Search" "AllowCortana") -eq 0) -and ((Get-Reg "HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\Windows Search" "DisableWebSearch") -eq 1) -and ((Get-Reg "HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\Windows Search" "ConnectedSearchUseWeb") -eq 0)
$onedrive     = (Get-Reg "HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\OneDrive" "DisableFileSyncNGSC") -eq 1
$winupdate    = (Get-Reg "HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU" "NoAutoUpdate") -eq 1
$appCompat    = (Get-Reg "HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\AppCompat" "AITEnable") -eq 0

function s($b) { if ($b) { 'active' } else { 'inactive' } }
@{
  tweaks = @{
    bandwidth    = s $bandwidth
    qos_fortnite = s $qos
    delivery_opt = s $delivOpt
    power_throttling = s $powerThrot
    hags         = s $hags
    fast_startup = s $fastStartup
    telemetry    = s $telemetry
    cortana      = s $cortana
    onedrive     = s $onedrive
    windows_update = s $winupdate
    app_compat   = s $appCompat
  }
} | ConvertTo-Json -Depth 3
`;
  try {
    const out = await runPs1(script, false, 12000);
    return JSON.parse(out);
  } catch {
    return { gpeditAvailable: false, tweaks: {} };
  }
});

// ─── IPC: GPO — apply tweaks ─────────────────────────────────────────────────
ipcMain.handle("apply-gpo-tweaks", async (_e, ids: string[]) => {
  const lines: string[] = ["@echo off"];

  if (ids.includes("bandwidth"))
    lines.push(`reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\Psched" /v NonBestEffortLimit /t REG_DWORD /d 0 /f >nul`);

  if (ids.includes("qos_fortnite")) {
    const base = `HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\QoS\\Fortnite`;
    lines.push(
      `reg add "${base}" /v "Application Name" /t REG_SZ /d "FortniteClient-Win64-Shipping.exe" /f >nul`,
      `reg add "${base}" /v "DSCP Value" /t REG_SZ /d "46" /f >nul`,
      `reg add "${base}" /v "Local Port" /t REG_SZ /d "*" /f >nul`,
      `reg add "${base}" /v "Protocol" /t REG_SZ /d "*" /f >nul`,
      `reg add "${base}" /v "Throttle Rate" /t REG_SZ /d "-1" /f >nul`,
    );
  }

  if (ids.includes("delivery_opt"))
    lines.push(`reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DeliveryOptimization" /v DODownloadMode /t REG_DWORD /d 0 /f >nul`);

  if (ids.includes("power_throttling"))
    lines.push(`reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerThrottling" /v PowerThrottlingOff /t REG_DWORD /d 1 /f >nul`);

  if (ids.includes("hags"))
    lines.push(`reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers" /v HwSchMode /t REG_DWORD /d 2 /f >nul`);

  if (ids.includes("fast_startup"))
    lines.push(`reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power" /v HiberbootEnabled /t REG_DWORD /d 0 /f >nul`);

  if (ids.includes("telemetry")) {
    lines.push(
      `reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection" /v AllowTelemetry /t REG_DWORD /d 0 /f >nul`,
      `reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection" /v MaxTelemetryAllowed /t REG_DWORD /d 0 /f >nul`,
    );
  }

  if (ids.includes("app_compat")) {
    lines.push(
      `reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\AppCompat" /v AITEnable /t REG_DWORD /d 0 /f >nul`,
      `reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\AppCompat" /v DisableInventory /t REG_DWORD /d 1 /f >nul`,
    );
  }

  if (ids.includes("cortana")) {
    lines.push(
      `reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\Windows Search" /v AllowCortana /t REG_DWORD /d 0 /f >nul`,
      `reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\Windows Search" /v DisableWebSearch /t REG_DWORD /d 1 /f >nul`,
      `reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\Windows Search" /v ConnectedSearchUseWeb /t REG_DWORD /d 0 /f >nul`,
    );
  }

  if (ids.includes("onedrive"))
    lines.push(`reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\OneDrive" /v DisableFileSyncNGSC /t REG_DWORD /d 1 /f >nul`);

  if (ids.includes("windows_update")) {
    lines.push(
      `reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU" /v NoAutoUpdate /t REG_DWORD /d 1 /f >nul`,
      `reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU" /v AUOptions /t REG_DWORD /d 2 /f >nul`,
    );
  }

  lines.push("echo OK");
  const batContent = lines.join("\r\n");

  try {
    const { ok } = await runElevatedBat(batContent, 60000);
    if (!ok) return { ok: false, error: "Le script élevé ne s'est pas terminé (élévation refusée ?)" };
    const states = (store.get("tweak_status") as Record<string, boolean>) || {};
    for (const id of ids) states[id] = true;
    store.set("tweak_status", states);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// ─── IPC: GPO — restore defaults ─────────────────────────────────────────────
ipcMain.handle("restore-gpo-defaults", async () => {
  const batContent = `@echo off
reg delete "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\Psched" /v NonBestEffortLimit /f >nul 2>&1
reg delete "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\QoS\\Fortnite" /f >nul 2>&1
reg delete "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DeliveryOptimization" /v DODownloadMode /f >nul 2>&1
reg delete "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerThrottling" /v PowerThrottlingOff /f >nul 2>&1
reg add    "HKLM\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers" /v HwSchMode /t REG_DWORD /d 1 /f >nul
reg add    "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power" /v HiberbootEnabled /t REG_DWORD /d 1 /f >nul
reg add    "HKLM\\SYSTEM\\CurrentControlSet\\Control\\DeviceGuard" /v EnableVirtualizationBasedSecurity /t REG_DWORD /d 1 /f >nul
reg delete "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection" /v AllowTelemetry /f >nul 2>&1
reg delete "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection" /v MaxTelemetryAllowed /f >nul 2>&1
reg delete "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\AppCompat" /v AITEnable /f >nul 2>&1
reg delete "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\AppCompat" /v DisableInventory /f >nul 2>&1
reg delete "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\Windows Search" /v AllowCortana /f >nul 2>&1
reg delete "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\Windows Search" /v DisableWebSearch /f >nul 2>&1
reg delete "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\Windows Search" /v ConnectedSearchUseWeb /f >nul 2>&1
reg delete "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\OneDrive" /v DisableFileSyncNGSC /f >nul 2>&1
reg delete "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU" /v NoAutoUpdate /f >nul 2>&1
reg delete "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU" /v AUOptions /f >nul 2>&1
echo OK
`;
  try {
    const { ok } = await runElevatedBat(batContent, 30000);
    if (!ok) return { ok: false, error: "Le script élevé ne s'est pas terminé (élévation refusée ?)" };
    const GPO_IDS = ["bandwidth","qos_fortnite","delivery_opt","power_throttling","hags","fast_startup","telemetry","cortana","onedrive","windows_update","app_compat"];
    const states = (store.get("tweak_status") as Record<string, boolean>) || {};
    for (const id of GPO_IDS) states[id] = false;
    store.set("tweak_status", states);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// ─── IPC: Tweak state persistence ────────────────────────────────────────────
ipcMain.handle("get-tweak-states", () => {
  return (store.get("tweak_status") as Record<string, boolean>) || {};
});

ipcMain.handle("set-tweak-state", (_e, id: string, active: boolean) => {
  const states = (store.get("tweak_status") as Record<string, boolean>) || {};
  states[id] = active;
  store.set("tweak_status", states);
});

ipcMain.handle("reset-tweak-states", () => {
  store.delete("tweak_status");
});

// ─── IPC: Check tweak registry status ────────────────────────────────────────
ipcMain.handle("check-tweak-status", async () => {
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
function Get-Reg($path, $name) {
  try { return (Get-ItemProperty -LiteralPath "Registry::$path" -Name $name -ErrorAction Stop).$name } catch { return $null }
}
@{
  power_throttling = [bool]((Get-Reg "HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerThrottling" "PowerThrottlingOff") -eq 1)
  telemetry        = [bool]((Get-Reg "HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection" "AllowTelemetry") -eq 0)
  hags             = [bool]((Get-Reg "HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers" "HwSchMode") -eq 2)
  fast_startup     = [bool]((Get-Reg "HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power" "HiberbootEnabled") -eq 0)
  delivery_opt     = [bool]((Get-Reg "HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Microsoft\\Windows\\DeliveryOptimization" "DODownloadMode") -eq 0)
  onedrive         = [bool]((Get-Reg "HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Microsoft\\Windows\\OneDrive" "DisableFileSyncNGSC") -eq 1)
} | ConvertTo-Json
`;
  try {
    const out = await runPs1(script, false, 10000);
    return JSON.parse(out) as Record<string, boolean>;
  } catch {
    return {};
  }
});

// ─── IPC: Scan junk files ────────────────────────────────────────────────────
ipcMain.handle("scan-junk", async () => {
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
function Get-FolderSize($path) {
  if (-not (Test-Path $path)) { return 0 }
  (Get-ChildItem $path -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB
}
$env_temp = $env:TEMP
$win_temp = "C:\\Windows\\Temp"
$prefetch = "C:\\Windows\\Prefetch"
$win_logs = "C:\\Windows\\System32\\winevt\\Logs"
$epic = "$env:LOCALAPPDATA\\EpicGamesLauncher\\Saved\\webcache"
$chrome = "$env:LOCALAPPDATA\\Google\\Chrome\\User Data\\Default\\Cache"
$edge = "$env:LOCALAPPDATA\\Microsoft\\Edge\\User Data\\Default\\Cache"
$ff = "$env:APPDATA\\Mozilla\\Firefox\\Profiles"
@{
  temp_user   = [int](Get-FolderSize $env_temp)
  temp_win    = [int](Get-FolderSize $win_temp)
  prefetch    = [int](Get-FolderSize $prefetch)
  win_logs    = [int](Get-FolderSize $win_logs)
  epic_cache  = [int](Get-FolderSize $epic)
  chrome_cache = [int](Get-FolderSize $chrome)
  edge_cache  = [int](Get-FolderSize $edge)
  firefox_cache = [int](Get-FolderSize $ff)
  dns_cache   = 0
} | ConvertTo-Json
`;
  try {
    const out = await runPs1(script, false, 20000);
    return JSON.parse(out);
  } catch {
    return {};
  }
});

// ─── IPC: Clean junk ─────────────────────────────────────────────────────────
ipcMain.handle("clean-junk", async (_e, targetId: string) => {
  const localApp = process.env.LOCALAPPDATA || join(os.homedir(), "AppData", "Local");
  const appData = process.env.APPDATA || join(os.homedir(), "AppData", "Roaming");
  const temp = process.env.TEMP || join(os.homedir(), "AppData", "Local", "Temp");

  const targets: Record<string, string[]> = {
    temp_user: [temp],
    temp_win: ["C:\\Windows\\Temp"],
    prefetch: ["C:\\Windows\\Prefetch"],
    win_logs: ["C:\\Windows\\System32\\winevt\\Logs"],
    epic_cache: [join(localApp, "EpicGamesLauncher", "Saved", "webcache")],
    chrome_cache: [join(localApp, "Google", "Chrome", "User Data", "Default", "Cache")],
    edge_cache: [join(localApp, "Microsoft", "Edge", "User Data", "Default", "Cache")],
    firefox_cache: [join(appData, "Mozilla", "Firefox", "Profiles")],
    dns_cache: [],
  };

  try {
    if (targetId === "dns_cache") {
      await execAsync("ipconfig /flushdns", { timeout: 5000 });
      return { ok: true };
    }

    const paths = targets[targetId] || [];
    for (const p of paths) {
      if (fs.existsSync(p)) {
        await execAsync(`rd /s /q "${p}" 2>nul`, { timeout: 15000 }).catch(() => {});
        fs.mkdirSync(p, { recursive: true });
      }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// ─── IPC: Driver info ─────────────────────────────────────────────────────────
ipcMain.handle("get-driver-info", async () => {
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
$controllers = Get-WmiObject Win32_VideoController | Where-Object { $_.Name -notlike '*Microsoft*' }
$gpu = $controllers | Where-Object { $_.Name -match 'NVIDIA' } | Select-Object -First 1
if (-not $gpu) { $gpu = $controllers | Where-Object { $_.Name -notmatch 'Intel' } | Select-Object -First 1 }
if (-not $gpu) { $gpu = $controllers | Select-Object -First 1 }
$gpuName = if ($gpu) { $gpu.Name } else { 'Inconnu' }
$gpuDriver = if ($gpu) { $gpu.DriverVersion } else { 'N/A' }
$isNvidia = ($gpuName -match 'NVIDIA')
$isAmd = ($gpuName -match 'AMD|Radeon')
@{
  gpu = $gpuName
  gpuVersion = $gpuDriver
  isNvidia = [bool]$isNvidia
  isAmd = [bool]$isAmd
} | ConvertTo-Json
`;
  try {
    const out = await runPs1(script, false, 8000);
    return JSON.parse(out);
  } catch {
    return { gpu: "Inconnu", gpuVersion: "N/A", isNvidia: false, isAmd: false };
  }
});

// ─── IPC: Apply streaming mode ────────────────────────────────────────────────
ipcMain.handle("apply-streaming-mode", async () => {
  const batContent = `@echo off
:: Priorité processus streaming
wmic process where name="obs64.exe" CALL setpriority "Above Normal" >nul 2>&1
:: Fortnite en Normal (pas High) pour ne pas affamer les pilotes souris/clavier

:: Désactiver notifications Windows
reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\PushNotifications" /v "ToastEnabled" /t REG_DWORD /d 0 /f >nul

:: Optimiser bande passante upload (QoS)
reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\Psched" /v "NonBestEffortLimit" /t REG_DWORD /d 0 /f >nul

:: OBS encoder settings via registry hint
reg add "HKCU\\Software\\obs-studio" /v "KermoukStreamOptimized" /t REG_SZ /d "1" /f >nul 2>&1

:: CPU affinity hints (commentaire de référence pour user)
:: Fortnite: cores 0-5, OBS: cores 6-11 (configurer manuellement dans Task Manager)

echo STREAMING_MODE_OK
`;
  try {
    const { ok } = await runElevatedBat(batContent, 30000);
    if (!ok) return { ok: false, error: "Le script élevé ne s'est pas terminé (élévation refusée ?)" };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// ─── IPC: Notifications toggle ────────────────────────────────────────────────
let notificationsEnabled = true;
ipcMain.handle("set-notifications-enabled", (_e, enabled: boolean) => {
  notificationsEnabled = enabled;
});

// ─── Auto-updater ─────────────────────────────────────────────────────────────
function initAutoUpdater(win: BrowserWindow) {
  // Ne s'exécute que dans l'app packagée — évite les crashes en dev
  if (!app.isPackaged) return;

  try {
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'agencyweb-pro',
      repo: 'kermouk-optimizer'
    });
    autoUpdater.logger = null; // désactive les logs internes qui peuvent crasher
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowDowngrade = false;
  } catch {
    return;
  }

  const send = (type: string, payload?: Record<string, unknown>) => {
    try {
      if (!win.isDestroyed()) win.webContents.send("update-status", { type, ...payload });
    } catch { /* ignorer si la fenêtre est fermée */ }
  };

  autoUpdater.on("checking-for-update", () => send("checking"));

  autoUpdater.on("update-available", (info) => {
    send("available", { version: info.version });
    try {
      new Notification({
        title: "KERMOUK — Mise à jour disponible",
        body: `Version ${info.version} disponible — téléchargement en cours...`,
        icon: join(__dirname, "../../resources/icon.png"),
      }).show();
    } catch { /* notification optionnelle */ }
  });

  autoUpdater.on("update-not-available", () => send("up-to-date"));

  autoUpdater.on("download-progress", (p) => {
    try {
      send("downloading", { percent: Math.round(p.percent), bytesPerSecond: Math.round(p.bytesPerSecond) });
    } catch { /* ignorer */ }
  });

  autoUpdater.on("update-downloaded", (info) => send("downloaded", { version: info.version }));

  // Remonte l'erreur au renderer (carte d'état MàJ, type "error" déjà géré) sans crasher l'app
  autoUpdater.on("error", (err) => {
    send("error", { message: err?.message ?? String(err) });
  });

  // Vérification 10s après le lancement — toujours dans un try/catch
  setTimeout(() => {
    try {
      autoUpdater.checkForUpdates().catch(() => { /* pas de connexion — silencieux */ });
    } catch { /* silencieux */ }
  }, 10000);
}

// ─── IPC: Update controls ─────────────────────────────────────────────────────
ipcMain.handle("check-for-updates", async () => {
  const win = BrowserWindow.getAllWindows()[0];
  const send = (payload: Record<string, unknown>) => {
    if (win && !win.isDestroyed()) win.webContents.send("update-status", payload);
  };
  if (!app.isPackaged) {
    send({ type: "no-server" });
    return;
  }
  try {
    await autoUpdater.checkForUpdates();
  } catch {
    send({ type: "no-server" });
  }
});

ipcMain.handle("install-update", () => {
  if (!app.isPackaged) return;
  try {
    autoUpdater.quitAndInstall(false, true);
  } catch { /* silencieux */ }
});

// ─── Background: Smart monitoring — si every 5s, temp every 15s (pas de wmic) ─
function startMonitoring(win: BrowserWindow) {
  let tickCount = 0;
  let lastTemp = -1;

  setInterval(async () => {
    if (!notificationsEnabled) return;
    tickCount++;

    try {
      const [load, mem] = await Promise.all([si.currentLoad(), si.mem()]);
      const cpuUsage = Math.round(load.currentLoad);
      const ramUsage = Math.round(mem.used / mem.total * 100);
      const ramTotalGb = Math.round(mem.total / 1073741824 * 10) / 10;
      const ramUsedGb = Math.round(mem.used / 1073741824 * 10) / 10;

      // Température CPU toutes les 15s (chaque 3ème tick)
      if (tickCount % 3 === 0) {
        si.cpuTemperature().then((t) => {
          lastTemp = Math.round(t.main) || -1;
        }).catch(() => {});
      }

      // Détection Fortnite (tasklist ciblé — rapide)
      let fortniteRunning = false;
      try {
        const { stdout: tasks } = await execAsync(
          'tasklist /FI "IMAGENAME eq FortniteClient-Win64-Shipping.exe" /FO CSV /NH',
          { timeout: 2000 }
        );
        fortniteRunning = tasks.includes("FortniteClient");
      } catch { /* ignore */ }

      const data = { cpuUsage, ramUsage, ramTotalGb, ramUsedGb, cpuTemp: lastTemp, gpuUsage: -1, gpuTemp: -1, fortniteRunning };

      if (ramUsage > 90) {
        new Notification({
          title: "KERMOUK - RAM saturee",
          body: `RAM a ${ramUsage}% - Lance le Nettoyeur pour liberer de la memoire !`,
          icon: join(__dirname, "../../resources/icon.png"),
        }).show();
      } else if (lastTemp > 85 && lastTemp < 120) {
        new Notification({
          title: "KERMOUK - CPU chaud",
          body: `Temperature CPU : ${lastTemp}C - Applique les tweaks de throttling ?`,
          icon: join(__dirname, "../../resources/icon.png"),
        }).show();
      }

      if (!win.isDestroyed()) win.webContents.send("hw-alert", data);
    } catch { /* ignore monitoring errors */ }
  }, 5000);
}

// ─── Helper: assets path (dev vs packaged) ───────────────────────────────────
function getAssetsPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, "assets")
    : join(__dirname, "../../resources/assets");
}

// ─── IPC: Detect Nvidia Profile Inspector ────────────────────────────────────
ipcMain.handle("detect-nvidia-inspector", async () => {
  // Priorité : NVIDIA Profile Inspector (outil actuel) > NVIDIA Inspector (legacy)
  const exeNames = ["nvidiaProfileInspector.exe", "nvidiaInspector.exe"];
  const baseDirs = [
    "C:\\Program Files\\NVIDIA Profile Inspector",
    "C:\\Program Files (x86)\\NVIDIA Profile Inspector",
    "C:\\Program Files\\NVIDIA Inspector",
    "C:\\Program Files (x86)\\NVIDIA Inspector",
    join(os.homedir(), "Downloads"),
    join(os.homedir(), "Downloads", "NVIDIA Profile Inspector"),
    join(os.homedir(), "Downloads", "NVIDIA Inspector"),
    join(os.homedir(), "Desktop"),
    join(os.homedir(), "Desktop", "NVIDIA Profile Inspector"),
    join(os.homedir(), "Desktop", "NVIDIA Inspector"),
    "C:\\Tools",
  ];
  for (const exe of exeNames) {
    for (const dir of baseDirs) {
      const p = join(dir, exe);
      if (fs.existsSync(p)) return { found: true, path: p };
    }
    try {
      const { stdout } = await execAsync(`where ${exe} 2>nul`, { timeout: 5000 });
      const p = stdout.trim().split("\n")[0].trim();
      if (p && fs.existsSync(p)) return { found: true, path: p };
    } catch { /* not in PATH */ }
  }
  return { found: false, path: null };
});

// ─── IPC: Apply Nvidia Profile Inspector profile ──────────────────────────────
ipcMain.handle("apply-nvidia-profile", async (_e, profileFilename: string, inspectorPath: string) => {
  try {
    const src = join(getAssetsPath(), profileFilename);
    if (!fs.existsSync(src)) return { ok: false, error: `Profil introuvable : ${src}` };
    if (!fs.existsSync(inspectorPath)) return { ok: false, error: "nvidiaProfileInspector.exe introuvable." };
    const tempProfile = join(SCRIPTS_DIR, profileFilename);
    fs.copyFileSync(src, tempProfile);
    // NVIDIA Profile Inspector utilise -silentImport ; l'ancien Inspector utilisait -importSettings
    const isProfileInspector = inspectorPath.toLowerCase().includes("profileinspector");
    const flag = isProfileInspector ? "-silentImport" : "-importSettings";
    const cmd = `"${inspectorPath}" ${flag} "${tempProfile}"`;
    await execAsync(cmd, { timeout: 30000 });
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: String(e) };
  }
});

// ─── IPC: Apply Pack Complet Fortnite ────────────────────────────────────────
ipcMain.handle("apply-pack-complet", async () => {
  const bat = `@echo off
setlocal EnableDelayedExpansion

echo [1/10] Services Windows...
sc config "SysMain" start= auto >nul 2>&1
sc start "SysMain" >nul 2>&1
for %%S in (DiagTrack dmwappushservice MapsBroker RetailDemo XblAuthManager XblGameSave XboxGipSvc XboxNetApiSvc WerSvc Fax RemoteRegistry WMPNetworkSvc lfsvc wisvc PcaSvc) do (
  sc stop "%%S" >nul 2>&1
  sc config "%%S" start= disabled >nul 2>&1
)
for %%S in (PrintNotify WSearch) do (
  sc stop "%%S" >nul 2>&1
  sc config "%%S" start= manual >nul 2>&1
)

echo [2/10] Memoire et pagefile...
powershell -NoProfile -Command "Disable-MMAgent -MemoryCompression" >nul 2>&1
fsutil behavior set memoryusage 1 >nul 2>&1
fsutil behavior set disable8dot3 1 >nul 2>&1
fsutil behavior set disablelastaccess 1 >nul 2>&1
fsutil behavior set mftzone 2 >nul 2>&1
powershell -NoProfile -Command "try { Set-CimInstance -InputObject (Get-CimInstance Win32_ComputerSystem -ErrorAction Stop) -Property @{AutomaticManagedPagefile=$true} -ErrorAction Stop; exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 echo    [!] Pagefile: configuration auto non appliquee (droits admin ?)
del /f /q "%SystemRoot%\\Prefetch\\*.pf" >nul 2>&1

echo [3/10] Priorite CPU Fortnite...
reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl" /v Win32PrioritySeparation /t REG_DWORD /d 38 /f >nul
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\FortniteClient-Win64-Shipping.exe\\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 2 /f >nul
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\FortniteClient-Win64-Shipping.exe\\PerfOptions" /v IoPriority /t REG_DWORD /d 2 /f >nul
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\EpicGamesLauncher.exe\\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 2 /f >nul

echo [4/10] Effets visuels...
reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects" /v VisualFXSetting /t REG_DWORD /d 2 /f >nul
reg add "HKCU\\Control Panel\\Desktop" /v MenuShowDelay /t REG_SZ /d 0 /f >nul
reg add "HKCU\\Control Panel\\Desktop" /v DragFullWindows /t REG_SZ /d 0 /f >nul
reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v TaskbarAnimations /t REG_DWORD /d 0 /f >nul
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize" /v EnableTransparency /t REG_DWORD /d 0 /f >nul

echo [5/10] Game Bar et DVR...
reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\GameDVR" /v AppCaptureEnabled /t REG_DWORD /d 0 /f >nul
reg add "HKCU\\System\\GameConfigStore" /v GameDVR_Enabled /t REG_DWORD /d 0 /f >nul
reg add "HKCU\\System\\GameConfigStore" /v GameDVR_FSEBehaviorMode /t REG_DWORD /d 2 /f >nul
reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\GameDVR" /v AllowGameDVR /t REG_DWORD /d 0 /f >nul
reg add "HKCU\\SOFTWARE\\Microsoft\\GameBar" /v UseNexusForGameBarEnabled /t REG_DWORD /d 0 /f >nul
reg add "HKCU\\SOFTWARE\\Microsoft\\GameBar" /v AllowAutoGameMode /t REG_DWORD /d 1 /f >nul
reg add "HKCU\\SOFTWARE\\Microsoft\\GameBar" /v AutoGameModeEnabled /t REG_DWORD /d 1 /f >nul

echo [6/10] Timer et GPU scheduling...
reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers" /v HwSchMode /t REG_DWORD /d 2 /f >nul
reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers\\Scheduler" /v EnablePreemption /t REG_DWORD /d 0 /f >nul
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile" /v SystemResponsiveness /t REG_DWORD /d 0 /f >nul
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile" /v NetworkThrottlingIndex /t REG_DWORD /d 4294967295 /f >nul
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v "GPU Priority" /t REG_DWORD /d 8 /f >nul
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v Priority /t REG_DWORD /d 6 /f >nul
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v "Scheduling Category" /t REG_SZ /d High /f >nul
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v "SFIO Priority" /t REG_SZ /d High /f >nul
reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\kernel" /v GlobalTimerResolutionRequests /t REG_DWORD /d 1 /f >nul

echo [7/10] Reseau gaming...
netsh int tcp set global autotuninglevel=disabled >nul 2>&1
netsh int tcp set global rss=enabled >nul 2>&1
netsh int tcp set global chimney=disabled >nul 2>&1
netsh int tcp set global ecncapability=disabled >nul 2>&1
netsh int tcp set global timestamps=disabled >nul 2>&1
netsh int tcp set heuristics disabled >nul 2>&1
reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters" /v DefaultTTL /t REG_DWORD /d 64 /f >nul
reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters" /v MaxUserPort /t REG_DWORD /d 65534 /f >nul
reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters" /v TcpTimedWaitDelay /t REG_DWORD /d 30 /f >nul
reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\Psched" /v NonBestEffortLimit /t REG_DWORD /d 0 /f >nul
netsh interface teredo set state disabled >nul 2>&1
netsh interface 6to4 set state disabled >nul 2>&1
netsh interface isatap set state disabled >nul 2>&1
netsh winsock reset >nul 2>&1
ipconfig /flushdns >nul 2>&1

echo [8/10] Tweaks registre gaming...
reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection" /v AllowTelemetry /t REG_DWORD /d 0 /f >nul
reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU" /v NoAutoUpdate /t REG_DWORD /d 1 /f >nul
reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU" /v AUOptions /t REG_DWORD /d 2 /f >nul
reg add "HKCU\\Control Panel\\Mouse" /v MouseSpeed /t REG_SZ /d 0 /f >nul
reg add "HKCU\\Control Panel\\Mouse" /v MouseThreshold1 /t REG_SZ /d 0 /f >nul
reg add "HKCU\\Control Panel\\Mouse" /v MouseThreshold2 /t REG_SZ /d 0 /f >nul
reg add "HKCU\\Control Panel\\Keyboard" /v KeyboardDelay /t REG_SZ /d 0 /f >nul
reg add "HKCU\\Control Panel\\Keyboard" /v KeyboardSpeed /t REG_SZ /d 31 /f >nul
reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management" /v FeatureSettingsOverride /t REG_DWORD /d 3 /f >nul
reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management" /v FeatureSettingsOverrideMask /t REG_DWORD /d 3 /f >nul

echo [9/10] Taches planifiees...
schtasks /Change /TN "\\Microsoft\\Windows\\Application Experience\\Microsoft Compatibility Appraiser" /Disable >nul 2>&1
schtasks /Change /TN "\\Microsoft\\Windows\\Application Experience\\ProgramDataUpdater" /Disable >nul 2>&1
schtasks /Change /TN "\\Microsoft\\Windows\\Customer Experience Improvement Program\\Consolidator" /Disable >nul 2>&1
schtasks /Change /TN "\\Microsoft\\Windows\\Customer Experience Improvement Program\\UsbCeip" /Disable >nul 2>&1
schtasks /Change /TN "\\Microsoft\\Windows\\Maintenance\\WinSAT" /Disable >nul 2>&1
schtasks /Change /TN "\\Microsoft\\Windows\\WindowsErrorReporting\\QueueReporting" /Disable >nul 2>&1
schtasks /Change /TN "\\Microsoft\\Windows\\XblGameSave\\XblGameSaveTask" /Disable >nul 2>&1

echo [10/10] Plan alimentation et disque SSD...
powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61 c4d5e6f7-1234-4567-89ab-cdef01234567 >nul 2>&1
powercfg /setactive c4d5e6f7-1234-4567-89ab-cdef01234567 >nul 2>&1
if errorlevel 1 powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c >nul 2>&1
powercfg /change standby-timeout-ac 0 >nul 2>&1
fsutil behavior set disableDeleteNotify 0 >nul 2>&1

echo PACK_COMPLET_OK
endlocal
`;
  try {
    const { ok } = await runElevatedBat(bat, 180000);
    if (!ok) return { ok: false, error: "Le script élevé ne s'est pas terminé (élévation refusée ?)" };
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: String(e) };
  }
});

// ─── IPC: Generate system report ─────────────────────────────────────────────
ipcMain.handle("generate-system-report", async () => {
  try {
    const desktop = join(os.homedir(), "Desktop");
    const ts = new Date().toISOString().replace(/[T:.]/g, "-").slice(0, 17);
    const reportDir = join(desktop, `KERMOUK_RAPPORT_${ts}`);
    fs.mkdirSync(reportDir, { recursive: true });

    const script = `
$ErrorActionPreference = 'SilentlyContinue'
$dir = '${reportDir.replace(/\\/g, "\\\\")}'
$out = "KERMOUK OPTIMIZER v2.4.0 - Rapport systeme\\nGenere le $(Get-Date)\\n\\n"

$out += "=== PLAN D'ALIMENTATION ===\\n"
$out += (powercfg /list 2>\\$null) + "\\n"
$out += "Actif : " + (powercfg /getactivescheme 2>\\$null) + "\\n\\n"

$out += "=== SERVICES GAMING ===\\n"
foreach (\\$svc in @("SysMain","DiagTrack","XblGameSave","WerSvc","WSearch","XboxGipSvc","GameInput","dmwappushservice")) {
  try {
    \\$s = Get-Service \\$svc -EA Stop
    \\$out += "\\$('\\$svc'.PadRight(25)) \\$(\\$s.Status.ToString().PadRight(10)) \\$(\\$s.StartType)\\n"
  } catch { \\$out += "\\$('\\$svc'.PadRight(25)) Introuvable\\n" }
}
\\$out += "\\n"

\\$out += "=== GPU ===\\n"
\\$gpu = Get-WmiObject Win32_VideoController | Where-Object { \\$_.Name -notlike '*Microsoft*' } | Select-Object -First 1
if (\\$gpu) {
  \\$out += "Nom    : \\$(\\$gpu.Name)\\n"
  \\$out += "Driver : \\$(\\$gpu.DriverVersion)\\n"
  \\$out += "VRAM   : \\$([math]::Round(\\$gpu.AdapterRAM / 1GB, 1)) GB\\n"
}
try { \\$out += "Temp   : \\$((& nvidia-smi --query-gpu=temperature.gpu --format=csv,noheader,nounits 2>\\$null).Trim())C\\n" } catch {}
\\$out += "\\n"

\\$out += "=== RESEAU (TCP) ===\\n"
try { \\$out += (netsh int tcp show global 2>\\$null) + "\\n" } catch {}

\\$out += "=== MEMOIRE ===\\n"
\\$ram = Get-WmiObject Win32_OperatingSystem
\\$out += "RAM Totale : \\$([math]::Round(\\$ram.TotalVisibleMemorySize / 1MB, 1)) GB\\n"
\\$out += "RAM Libre  : \\$([math]::Round(\\$ram.FreePhysicalMemory / 1MB, 1)) GB\\n"
try {
  \\$pf = Get-WmiObject Win32_PageFileUsage | Select-Object -First 1
  if (\\$pf) { \\$out += "Pagefile   : \\$(\\$pf.AllocatedBaseSize) MB (utilise: \\$(\\$pf.CurrentUsage) MB)\\n" }
} catch {}
\\$out += "\\n"

\\$out += "=== TWEAKS REGISTRE ===\\n"
function Get-Reg(\\$p, \\$n) { try { return (Get-ItemProperty "Registry::$\\$p" -Name \\$n -EA Stop).\\$n } catch { return 'N/A' } }
\\$out += "Win32PrioritySeparation : \\$(Get-Reg 'HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl' 'Win32PrioritySeparation')\\n"
\\$out += "HAGS (HwSchMode)        : \\$(Get-Reg 'HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' 'HwSchMode')\\n"
\\$out += "SystemResponsiveness    : \\$(Get-Reg 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' 'SystemResponsiveness')\\n"
\\$out += "NetworkThrottlingIndex  : \\$(Get-Reg 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' 'NetworkThrottlingIndex')\\n"
\\$out += "GlobalTimerResolution   : \\$(Get-Reg 'HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\kernel' 'GlobalTimerResolutionRequests')\\n"
\\$out += "GameDVR_Enabled         : \\$(Get-Reg 'HKEY_CURRENT_USER\\System\\GameConfigStore' 'GameDVR_Enabled')\\n"

\\$out | Out-File -FilePath "\\$dir\\rapport_systeme.txt" -Encoding UTF8
Write-Host "DONE"
`;
    await runPs1(script, false, 30000);

    // Générer RESTAURER_TWEAKS.bat
    const restoreBat = `@echo off
title KERMOUK - RESTAURATION TWEAKS

net session >nul 2>&1
if %errorlevel% neq 0 (echo [ERREUR] Admin requis. & pause & exit /b 1)

echo Restauration parametres Windows defaut...

sc config "DiagTrack" start= auto >nul 2>&1 & sc start "DiagTrack" >nul 2>&1
sc config "XblGameSave" start= auto >nul 2>&1

powershell -NoProfile -Command "Enable-MMAgent -MemoryCompression" >nul 2>&1
fsutil behavior set memoryusage 1 >nul 2>&1
powershell -NoProfile -Command "Set-CimInstance -InputObject (Get-CimInstance Win32_ComputerSystem) -Property @{AutomaticManagedPagefile=$true}" >nul 2>&1

reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl" /v Win32PrioritySeparation /t REG_DWORD /d 2 /f >nul
reg delete "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\FortniteClient-Win64-Shipping.exe\\PerfOptions" /f >nul 2>&1

reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects" /v VisualFXSetting /t REG_DWORD /d 0 /f >nul
reg add "HKCU\\Control Panel\\Desktop" /v MenuShowDelay /t REG_SZ /d 400 /f >nul
reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v TaskbarAnimations /t REG_DWORD /d 1 /f >nul
reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize" /v EnableTransparency /t REG_DWORD /d 1 /f >nul

reg add "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\GameDVR" /v AppCaptureEnabled /t REG_DWORD /d 1 /f >nul
reg add "HKCU\\System\\GameConfigStore" /v GameDVR_Enabled /t REG_DWORD /d 1 /f >nul
reg delete "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\GameDVR" /v AllowGameDVR /f >nul 2>&1

netsh int tcp set global autotuninglevel=normal >nul 2>&1
netsh int tcp set global ecncapability=enabled >nul 2>&1
netsh int tcp set global timestamps=enabled >nul 2>&1
reg delete "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\Psched" /v NonBestEffortLimit /f >nul 2>&1

reg delete "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection" /v AllowTelemetry /f >nul 2>&1
reg delete "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU" /v NoAutoUpdate /f >nul 2>&1
reg add "HKCU\\Control Panel\\Mouse" /v MouseSpeed /t REG_SZ /d 1 /f >nul
reg add "HKCU\\Control Panel\\Mouse" /v MouseThreshold1 /t REG_SZ /d 6 /f >nul
reg add "HKCU\\Control Panel\\Mouse" /v MouseThreshold2 /t REG_SZ /d 10 /f >nul

reg delete "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\kernel" /v GlobalTimerResolutionRequests /f >nul 2>&1
reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers\\Scheduler" /v EnablePreemption /t REG_DWORD /d 1 /f >nul
reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management\\PrefetchParameters" /v EnablePrefetcher /t REG_DWORD /d 3 /f >nul
reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management\\PrefetchParameters" /v EnableSuperfetch /t REG_DWORD /d 3 /f >nul

powercfg /setactive 381b4222-f694-41f0-9685-ff5bb260df2e >nul 2>&1

echo [OK] Restauration terminee. Redemarrez le PC.
pause
`;
    const restorePath = join(reportDir, "RESTAURER_TWEAKS.bat");
    fs.writeFileSync(restorePath, restoreBat, "latin1");

    const reportPath = join(reportDir, "rapport_systeme.txt");
    const content = fs.existsSync(reportPath) ? fs.readFileSync(reportPath, "utf-8") : "";
    return { ok: true, reportPath: reportDir, content };
  } catch (e: unknown) {
    return { ok: false, reportPath: "", content: "", error: String(e) };
  }
});

// ─── IPC: Export PC optimizations ────────────────────────────────────────────
ipcMain.handle("export-pc-optimizations", async () => {
  try {
    const desktop = join(os.homedir(), "Desktop");
    const ts = new Date().toISOString().replace(/[T:.]/g, "-").slice(0, 17);
    const exportDir = join(desktop, `KERMOUK_EXPORT_${ts}`);
    fs.mkdirSync(exportDir, { recursive: true });
    const edir = exportDir.replace(/\\/g, "\\\\");

    const script = `
$ErrorActionPreference = 'SilentlyContinue'
$dir = '${edir}'

# Logiciels installés
$apps = Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* |
  Where-Object DisplayName |
  Select-Object DisplayName, DisplayVersion, Publisher, InstallDate |
  Sort-Object DisplayName
$apps | Export-Csv "$dir\\logiciels_installes.csv" -NoTypeInformation -Encoding UTF8

# Variables d'environnement
[System.Environment]::GetEnvironmentVariables() | Out-String | Out-File "$dir\\variables_environnement.txt" -Encoding UTF8

# Plans d'alimentation
powercfg /list 2>\\$null | Out-File "$dir\\plans_alimentation.txt" -Encoding UTF8

# Services gaming
\\$report = "KERMOUK - Services gaming\\n$(Get-Date)\\n\\n"
foreach (\\$svc in @("SysMain","DiagTrack","XblGameSave","WerSvc","WSearch","XboxGipSvc","GameInput")) {
  try {
    \\$s = Get-Service \\$svc -EA Stop
    \\$report += "\\$(\\$svc.PadRight(25)) \\$(\\$s.Status.ToString().PadRight(10)) \\$(\\$s.StartType)\\n"
  } catch { \\$report += "\\$(\\$svc.PadRight(25)) Introuvable\\n" }
}
\\$report | Out-File "$dir\\services_gaming.txt" -Encoding UTF8

# Tweaks registre
function Get-Reg(\\$p, \\$n) { try { return (Get-ItemProperty "Registry::$\\$p" -Name \\$n -EA Stop).\\$n } catch { return 'N/A' } }
\\$reg = "KERMOUK - Etat tweaks registre\\n$(Get-Date)\\n\\n"
\\$reg += "Win32PrioritySeparation : \\$(Get-Reg 'HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl' 'Win32PrioritySeparation')\\n"
\\$reg += "HAGS (HwSchMode)        : \\$(Get-Reg 'HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' 'HwSchMode')\\n"
\\$reg += "SystemResponsiveness    : \\$(Get-Reg 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' 'SystemResponsiveness')\\n"
\\$reg += "NetworkThrottlingIndex  : \\$(Get-Reg 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' 'NetworkThrottlingIndex')\\n"
\\$reg += "GameDVR_Enabled         : \\$(Get-Reg 'HKEY_CURRENT_USER\\System\\GameConfigStore' 'GameDVR_Enabled')\\n"
\\$reg | Out-File "$dir\\tweaks_registre.txt" -Encoding UTF8

Write-Host "EXPORT_DONE"
`;
    await runPs1(script, false, 30000);
    return { ok: true, folder: exportDir };
  } catch (e: unknown) {
    return { ok: false, folder: "", error: String(e) };
  }
});

// ─── IPC: Pre-Launch Fortnite ─────────────────────────────────────────────────
ipcMain.handle("pre-launch-fortnite", async (_e, params: { killDiscord: boolean; autoRestore: boolean; extraApps?: string[] }) => {
  const win = BrowserWindow.getAllWindows()[0];
  const sendProgress = (step: string, message: string, done = false) => {
    try {
      if (win && !win.isDestroyed()) win.webContents.send("pre-launch-progress", { step, message, done });
    } catch { /* ignore */ }
  };

  const killedProcesses: string[] = [];

  try {
    // Step 1: mesure RAM avant
    sendProgress("ram_before", "Mesure RAM...");
    const { stdout: ramBefore } = await execAsync("wmic OS get FreePhysicalMemory /value", { timeout: 3000 });
    const freeBefore = parseInt(ramBefore.match(/FreePhysicalMemory=(\d+)/)?.[1] ?? "0");

    // Step 2: vider la RAM (EmptyWorkingSet via PS1)
    sendProgress("empty_ram", "Vidage RAM en cours...");
    const emptyScript = `
$code = @'
using System;using System.Runtime.InteropServices;
public class WS{[DllImport("psapi.dll")]public static extern bool EmptyWorkingSet(IntPtr h);}
'@
Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
Get-Process | ForEach-Object { try { [WS]::EmptyWorkingSet($_.Handle) } catch {} }
Write-Host "DONE"
`;
    await runPs1(emptyScript, false, 10000);

    const { stdout: ramAfterOut } = await execAsync("wmic OS get FreePhysicalMemory /value", { timeout: 3000 });
    const freeAfter = parseInt(ramAfterOut.match(/FreePhysicalMemory=(\d+)/)?.[1] ?? "0");
    const freedMb = Math.max(0, Math.round((freeAfter - freeBefore) / 1024));
    sendProgress("ram_freed", `RAM liberee : +${freedMb} MB`);

    // Step 3: kill processus parasites
    sendProgress("kill", "Arret processus parasites...");
    const toKill = ["OneDrive.exe", "SearchIndexer.exe", "RuntimeBroker.exe", "SearchHost.exe", "StartMenuExperienceHost.exe"];
    if (params.killDiscord) toKill.push("Discord.exe");
    if (params.extraApps?.length) toKill.push(...params.extraApps);

    for (const proc of toKill) {
      try {
        await execAsync(`taskkill /F /IM "${proc}" /T`, { timeout: 3000 });
        killedProcesses.push(proc);
      } catch { /* process peut ne pas exister */ }
    }

    // Stopper Defender NIS
    try {
      await execAsync("sc stop WdNisSvc", { timeout: 3000 });
      killedProcesses.push("WdNisSvc");
    } catch { /* peut echouer si déjà arrêté */ }

    sendProgress("killed", `${killedProcesses.length} processus arretes`);

    // Step 4: Flush DNS
    sendProgress("dns", "Flush DNS...");
    await execAsync("ipconfig /flushdns", { timeout: 5000 });

    // Step 5: Lancer Fortnite
    sendProgress("launch", "Lancement Fortnite...");
    shell.openExternal("com.epicgames.launcher://apps/Fortnite?action=launch");

    // Step 6: apres 35s, set affinite CPU (pas de changement de priorite — evite d'affamer souris/clavier)
    setTimeout(async () => {
      try {
        const affScript = `
$proc = Get-Process "FortniteClient-Win64-Shipping" -ErrorAction SilentlyContinue
if ($proc) {
  $proc.ProcessorAffinity = 63
  Write-Host "OK"
}
`;
        await runPs1(affScript, false, 5000);
        sendProgress("affinity", "Affinite CPU appliquee (cores 0-5)");
      } catch { /* Fortnite peut ne pas etre encore lance */ }
    }, 35000);

    // Step 7: si autoRestore, surveiller la fermeture de Fortnite
    if (params.autoRestore) {
      const restoreInterval = setInterval(async () => {
        try {
          const { stdout: tasks } = await execAsync('tasklist /FI "IMAGENAME eq FortniteClient-Win64-Shipping.exe" /FO CSV /NH', { timeout: 3000 });
          if (!tasks.includes("FortniteClient")) {
            clearInterval(restoreInterval);
            sendProgress("restore", "Fortnite ferme - Restauration processus...");

            // Redemarrer WdNisSvc
            execAsync("sc start WdNisSvc", { timeout: 5000 }).catch(() => {});

            // Redemarrer OneDrive si tué
            if (killedProcesses.includes("OneDrive.exe")) {
              const onedrivePath = join(process.env.LOCALAPPDATA || "", "Microsoft", "OneDrive", "OneDrive.exe");
              if (fs.existsSync(onedrivePath)) {
                execAsync(`"${onedrivePath}"`, { timeout: 3000 }).catch(() => {});
              }
            }

            sendProgress("restored", "Processus restaures", true);
          }
        } catch { /* ignore */ }
      }, 30000);
    } else {
      sendProgress("done", "Pre-launch termine", true);
    }

    return { ok: true, freedMb };
  } catch (e: unknown) {
    sendProgress("error", String(e), true);
    return { ok: false, error: String(e) };
  }
});

// ─── IPC: Detect disk types (SSD / HDD) ──────────────────────────────────────
ipcMain.handle("detect-disk-types", async () => {
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
$hasSSD = $false
$hasHDD = $false
try {
  $disks = Get-PhysicalDisk -ErrorAction Stop
  foreach ($d in $disks) {
    if ($d.MediaType -eq 'SSD') { $hasSSD = $true }
    elseif ($d.MediaType -eq 'HDD') { $hasHDD = $true }
    elseif ($d.FriendlyName -match 'NVMe|NVME|SSD|M\\.2|SKHynix|Samsung|WD_BLACK|980|970|860|870|870') { $hasSSD = $true }
    elseif ($d.FriendlyName -match '^WDC WD[0-9]|^ST[0-9]|^TOSHIBA|Hitachi|HGST|SPZX|SPCX') { $hasHDD = $true }
    elseif ($d.MediaType -eq 'Unspecified' -and $d.Size -lt 512GB) { $hasSSD = $true }
  }
} catch {
  try {
    $wmiDisks = Get-WmiObject -Class Win32_DiskDrive -ErrorAction Stop
    foreach ($d in $wmiDisks) {
      if ($d.Caption -match 'NVMe|NVME|SSD|M\\.2' -or $d.MediaType -match 'Solid') { $hasSSD = $true }
      else { $hasHDD = $true }
    }
  } catch {}
}
@{ hasSSD = [bool]$hasSSD; hasHDD = [bool]$hasHDD } | ConvertTo-Json
`;
  try {
    const out = await runPs1(script, false, 8000);
    return JSON.parse(out);
  } catch {
    return { hasSSD: false, hasHDD: false };
  }
});

// ─── IPC: Network — Detect adapters ──────────────────────────────────────────
ipcMain.handle("detect-net-adapters", async () => {
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
$adapters = Get-NetAdapter | Where-Object Status -eq 'Up'
$wifi = @(); $ethernet = @()
foreach ($a in $adapters) {
  $info = @{ name = $a.Name; description = $a.InterfaceDescription; status = [string]$a.Status }
  $isWifi = ($a.PhysicalMediaType -match 'WiFi|802\\.11|NativeWifi|Native 802\\.11') -or ($a.Name -match 'Wi.Fi|WiFi|WLAN|Wireless|Wi-Fi')
  if ($isWifi) { $wifi += $info } else { $ethernet += $info }
}
@{ wifi = $wifi; ethernet = $ethernet } | ConvertTo-Json -Depth 4
`;
  try { return JSON.parse(await runPs1(script, false, 8000)); }
  catch { return { wifi: [], ethernet: [] }; }
});

// ─── IPC: Network — Apply adapter preset ─────────────────────────────────────
ipcMain.handle("apply-adapter-preset", async (_e, adapterName: string, type: "wifi" | "ethernet") => {
  const dataDir = join(app.getPath("userData"), "AdapterBackups");
  fs.mkdirSync(dataDir, { recursive: true });
  const backupPath = join(dataDir, `adapter_${type}_${Date.now()}.json`);

  const backupScript = `
$ErrorActionPreference = 'SilentlyContinue'
$props = Get-NetAdapterAdvancedProperty -Name "${adapterName.replace(/"/g, "")}" -ErrorAction SilentlyContinue |
  Select-Object RegistryKeyword, DisplayValue, RegistryValue, ValidDisplayValues
if ($props) { $props | ConvertTo-Json -Depth 3 } else { '[]' }
`;
  let backupData = "[]";
  try { backupData = await runPs1(backupScript, false, 8000); } catch { /* continue */ }
  fs.writeFileSync(backupPath, JSON.stringify({ adapterName, type, timestamp: Date.now(), rawJson: backupData }), "utf-8");

  const props: [string, string][] = [
    ["*UAPSDSupport", "0"],
    ["*EEE", "0"],
    ["EEELinkAdvertisement", "0"],
    ["*RoamAggressiveness", "0"],
    ["*WakeOnMagicPacket", "0"],
    ["*WakeOnPattern", "0"],
    ["*InterruptModeration", "0"],
    ["*PacketCoalescing", "0"],
    ["*LsoV2IPv4", "0"],
    ["*LsoV2IPv6", "0"],
    ["HtMode", "0"],
    ["HTMode", "0"],
    ["HTPowerSaveMode", "0"],
    ...(type === "ethernet" ? [["*FlowControl", "0"] as [string, string], ["*JumboPacket", "1514"] as [string, string]] : []),
  ];

  const setLines = props.map(([kw, val]) =>
    `try { Set-NetAdapterAdvancedProperty -Name "${adapterName.replace(/"/g, "")}" -RegistryKeyword "${kw}" -RegistryValue ${val} -ErrorAction SilentlyContinue } catch {}`
  ).join("\n");

  const applyScript = `$ErrorActionPreference = 'SilentlyContinue'\n${setLines}\nWrite-Host 'OK'`;
  try {
    await runPs1(applyScript, true, 30000);
    return { ok: true, backupPath };
  } catch (e: unknown) {
    return { ok: false, backupPath, error: String(e) };
  }
});

// ─── IPC: Network — Restore adapter preset ───────────────────────────────────
ipcMain.handle("restore-adapter-preset", async (_e, backupPath: string) => {
  if (!fs.existsSync(backupPath)) return { ok: false, error: "Fichier de backup introuvable." };
  try {
    const saved = JSON.parse(fs.readFileSync(backupPath, "utf-8"));
    const { adapterName, rawJson } = saved;
    const props: Array<{ RegistryKeyword: string; RegistryValue: string }> = JSON.parse(rawJson || "[]");
    if (!Array.isArray(props) || props.length === 0) return { ok: false, error: "Aucune propriété sauvegardée." };

    const setLines = props.map(p =>
      `try { Set-NetAdapterAdvancedProperty -Name "${String(adapterName).replace(/"/g, "")}" -RegistryKeyword "${String(p.RegistryKeyword).replace(/"/g, "")}" -RegistryValue ${JSON.stringify(String(p.RegistryValue))} -ErrorAction SilentlyContinue } catch {}`
    ).join("\n");
    const script = `$ErrorActionPreference = 'SilentlyContinue'\n${setLines}\nWrite-Host 'OK'`;
    await runPs1(script, true, 30000);
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: String(e) };
  }
});

// ─── IPC: Network — QoS policies ─────────────────────────────────────────────
ipcMain.handle("list-qos-policies", async () => {
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
$policies = Get-NetQosPolicy -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'Kermouk*' }
if ($policies) { $policies | Select-Object Name, AppPathName, DSCPAction, PriorityValue | ConvertTo-Json -Depth 2 }
else { '[]' }
`;
  try { const out = await runPs1(script, false, 8000); return JSON.parse(out || "[]"); }
  catch { return []; }
});

ipcMain.handle("create-qos-policy", async (_e, name: string, appPath: string, dscpValue: number) => {
  const safeName = name.replace(/"/g, "");
  const safeApp = appPath.replace(/"/g, "");
  const script = `
$ErrorActionPreference = 'Stop'
try {
  $existing = Get-NetQosPolicy -Name "${safeName}" -ErrorAction SilentlyContinue
  if ($existing) { Remove-NetQosPolicy -Name "${safeName}" -Confirm:$false -ErrorAction SilentlyContinue }
  New-NetQosPolicy -Name "${safeName}" -AppPathNameMatchCondition "${safeApp}" -IPProtocolMatchCondition Both -DSCPAction ${dscpValue} -NetworkProfile All
  Write-Host 'OK'
} catch { Write-Host "ERR:$_" }
`;
  try {
    const out = await runPs1(script, true, 15000);
    if (out.includes("OK")) return { ok: true };
    return { ok: false, error: out.replace("ERR:", "") };
  } catch (e: unknown) { return { ok: false, error: String(e) }; }
});

ipcMain.handle("delete-qos-policy", async (_e, name: string) => {
  const safeName = name.replace(/"/g, "");
  const script = `Remove-NetQosPolicy -Name "${safeName}" -Confirm:$false -ErrorAction SilentlyContinue; Write-Host 'OK'`;
  try {
    await runPs1(script, true, 10000);
    return { ok: true };
  } catch (e: unknown) { return { ok: false, error: String(e) }; }
});

ipcMain.handle("detect-fortnite-path", async () => {
  const localApp = process.env.LOCALAPPDATA || join(os.homedir(), "AppData", "Local");
  const exeName = "FortniteClient-Win64-Shipping.exe";
  const basePaths = [
    join("C:\\", "Program Files", "Epic Games", "Fortnite", "FortniteGame", "Binaries", "Win64", exeName),
    join("D:\\", "Program Files", "Epic Games", "Fortnite", "FortniteGame", "Binaries", "Win64", exeName),
    join("E:\\", "Program Files", "Epic Games", "Fortnite", "FortniteGame", "Binaries", "Win64", exeName),
    join(localApp, "..", "Local", "FortniteGame", "Binaries", "Win64", exeName),
  ];
  for (const p of basePaths) {
    if (fs.existsSync(p)) return { found: true, path: p };
  }
  try {
    const { stdout } = await execAsync(`where ${exeName} 2>nul`, { timeout: 3000 });
    const p = stdout.trim().split("\n")[0].trim();
    if (p && fs.existsSync(p)) return { found: true, path: p };
  } catch { /* not in PATH */ }
  return { found: false, path: exeName };
});

// ─── IPC: Apply Basic Services Preset ────────────────────────────────────────
ipcMain.handle("apply-basic-services-preset", async () => {
  let backupId: string | null = null;
  try {
    backupId = await createBackup("Avant preset Basic Services", "manual");
  } catch { /* backup non bloquant */ }

  const batContent = `@echo off
sc stop DiagTrack >nul 2>&1
sc config DiagTrack start=demand >nul 2>&1
sc stop dmwappushservice >nul 2>&1
sc config dmwappushservice start=demand >nul 2>&1
sc stop SensorService >nul 2>&1
sc config SensorService start=demand >nul 2>&1
sc stop lfsvc >nul 2>&1
sc config lfsvc start=demand >nul 2>&1
sc stop MicrosoftEdgeElevationService >nul 2>&1
sc config MicrosoftEdgeElevationService start=demand >nul 2>&1
sc stop edgeupdate >nul 2>&1
sc config edgeupdate start=demand >nul 2>&1
sc stop edgeupdatem >nul 2>&1
sc config edgeupdatem start=demand >nul 2>&1
sc stop WMPNetworkSvc >nul 2>&1
sc config WMPNetworkSvc start=demand >nul 2>&1
sc stop RemoteRegistry >nul 2>&1
sc config RemoteRegistry start=disabled >nul 2>&1
sc stop MapsBroker >nul 2>&1
sc config MapsBroker start=disabled >nul 2>&1
sc stop RetailDemo >nul 2>&1
sc config RetailDemo start=disabled >nul 2>&1
echo BASIC_PRESET_OK
`;
  try {
    const { ok } = await runElevatedBat(batContent, 60000);
    if (!ok) return { ok: false, backupId, error: "Le script élevé ne s'est pas terminé (élévation refusée ?)" };
    return { ok: true, backupId };
  } catch (e: unknown) {
    return { ok: false, backupId, error: String(e) };
  }
});

// ─── IPC: GPU Reset (NVIDIA) ─────────────────────────────────────────────────
ipcMain.handle("reset-gpu-overclock", async () => {
  const script = `
$ErrorActionPreference = 'Stop'
try {
  $defaultLimit = [float]((& nvidia-smi --query-gpu=power.default_limit --format=csv,noheader,nounits).Trim())
  & nvidia-smi -pl $defaultLimit | Out-Null
  & nvidia-smi --reset-gpu-clocks | Out-Null
  Write-Host "OK"
} catch {
  Write-Host "ERR:$_"
}
`;
  try {
    const out = await runPs1(script, false, 10000);
    if (out.startsWith("OK")) return { ok: true };
    return { ok: false, error: out.replace("ERR:", "") };
  } catch (e: unknown) {
    return { ok: false, error: String(e) };
  }
});

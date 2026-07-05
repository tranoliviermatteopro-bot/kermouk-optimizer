import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("kermouk", {
  // Window controls
  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  close: () => ipcRenderer.send("window-close"),

  // License
  loadLicense: () => ipcRenderer.invoke("license-load"),
  clearLicense: () => ipcRenderer.invoke("license-clear"),
  activateLicense: (key: string) => ipcRenderer.invoke("license-activate", key),

  // System
  getSystemInfo: () => ipcRenderer.invoke("get-system-info"),

  // Tweaks
  applyTweaks: (batContent: string, tweakNames: string[]) =>
    ipcRenderer.invoke("apply-tweaks", batContent, tweakNames),
  createRestorePoint: () => ipcRenderer.invoke("create-restore-point"),

  // Utils
  openExternal: (url: string) => ipcRenderer.invoke("open-external", url),

  // BIOS
  getMotherboardInfo: () => ipcRenderer.invoke("get-motherboard-info"),
  rebootToBios: () => ipcRenderer.invoke("reboot-to-bios"),

  // Overclock / Monitor
  getHardwareMonitor: () => ipcRenderer.invoke("get-hardware-monitor"),
  applyCpuTweaks: () => ipcRenderer.invoke("apply-cpu-performance-tweaks"),
  applyGpuOverclock: (profile: string) => ipcRenderer.invoke("apply-gpu-overclock", profile),
  resetGpuOverclock: () => ipcRenderer.invoke("reset-gpu-overclock"),

  // Network ping
  pingServer: (host: string) => ipcRenderer.invoke("ping-server", host),

  // Fortnite advanced
  applyFortniteIni: () => ipcRenderer.invoke("apply-fortnite-ini"),
  cleanFortniteCache: () => ipcRenderer.invoke("clean-fortnite-cache"),

  // Cleaner
  scanJunk: () => ipcRenderer.invoke("scan-junk"),
  cleanJunk: (id: string) => ipcRenderer.invoke("clean-junk", id),

  // Driver info
  getDriverInfo: () => ipcRenderer.invoke("get-driver-info"),

  // Disk type detection
  detectDiskTypes: () => ipcRenderer.invoke("detect-disk-types"),

  // Services preset
  applyBasicServicesPreset: () => ipcRenderer.invoke("apply-basic-services-preset"),

  // Network Adapter Tuner + QoS
  detectNetAdapters: () => ipcRenderer.invoke("detect-net-adapters"),
  applyAdapterPreset: (adapterName: string, type: "wifi" | "ethernet") => ipcRenderer.invoke("apply-adapter-preset", adapterName, type),
  restoreAdapterPreset: (backupPath: string) => ipcRenderer.invoke("restore-adapter-preset", backupPath),
  listQosPolicies: () => ipcRenderer.invoke("list-qos-policies"),
  createQosPolicy: (name: string, appPath: string, dscpValue: number) => ipcRenderer.invoke("create-qos-policy", name, appPath, dscpValue),
  deleteQosPolicy: (name: string) => ipcRenderer.invoke("delete-qos-policy", name),
  detectFortnitePath: () => ipcRenderer.invoke("detect-fortnite-path"),

  // Streaming mode
  applyStreamingMode: () => ipcRenderer.invoke("apply-streaming-mode"),

  // Notifications
  setNotificationsEnabled: (enabled: boolean) => ipcRenderer.invoke("set-notifications-enabled", enabled),

  // GPO tweaks
  scanGpoStatus: () => ipcRenderer.invoke("scan-gpo-status"),
  applyGpoTweaks: (ids: string[]) => ipcRenderer.invoke("apply-gpo-tweaks", ids),
  restoreGpoDefaults: () => ipcRenderer.invoke("restore-gpo-defaults"),

  // Tweak state persistence
  getTweakStates: () => ipcRenderer.invoke("get-tweak-states"),
  setTweakState: (id: string, active: boolean) => ipcRenderer.invoke("set-tweak-state", id, active),
  resetTweakStates: () => ipcRenderer.invoke("reset-tweak-states"),
  checkTweakStatus: () => ipcRenderer.invoke("check-tweak-status"),

  // Nvidia Inspector
  detectNvidiaInspector: () => ipcRenderer.invoke("detect-nvidia-inspector"),
  applyNvidiaProfile: (profileFilename: string, inspectorPath: string) =>
    ipcRenderer.invoke("apply-nvidia-profile", profileFilename, inspectorPath),

  // Pack complet + outils
  applyPackComplet: () => ipcRenderer.invoke("apply-pack-complet"),
  generateSystemReport: () => ipcRenderer.invoke("generate-system-report"),
  exportPcOptimizations: () => ipcRenderer.invoke("export-pc-optimizations"),

  // Pre-Launch Fortnite
  preLaunchFortnite: (params: { killDiscord: boolean; autoRestore: boolean; extraApps?: string[] }) =>
    ipcRenderer.invoke("pre-launch-fortnite", params),
  onPreLaunchProgress: (cb: (data: { step: string; message: string; done: boolean }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { step: string; message: string; done: boolean }) => cb(data);
    ipcRenderer.on("pre-launch-progress", handler);
    return () => ipcRenderer.removeListener("pre-launch-progress", handler);
  },

  // Hardware alert (monitoring live)
  onHwAlert: (cb: (data: Record<string, unknown>) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: Record<string, unknown>) => cb(data);
    ipcRenderer.on("hw-alert", handler);
    return () => ipcRenderer.removeListener("hw-alert", handler);
  },

  // Auto-updater
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  installUpdate: () => ipcRenderer.invoke("install-update"),
  onUpdateStatus: (cb: (payload: Record<string, unknown>) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: Record<string, unknown>) => cb(payload);
    ipcRenderer.on("update-status", handler);
    return () => ipcRenderer.removeListener("update-status", handler);
  },

  // Auth Supabase
  authSignup: (params: { email: string; password: string; referralCode?: string }) =>
    ipcRenderer.invoke("auth-signup", params),
  authLogin: (params: { email: string; password: string }) =>
    ipcRenderer.invoke("auth-login", params),
  authLogout: () => ipcRenderer.invoke("auth-logout"),
  authGetUser: () => ipcRenderer.invoke("auth-get-user"),
  authCheckSession: () => ipcRenderer.invoke("auth-check-session"),

  // Backup system
  backups: {
    create: (name: string, type: "manual" | "automatic") =>
      ipcRenderer.invoke("backup-create", name, type),
    list: () => ipcRenderer.invoke("backup-list"),
    restore: (id: string) => ipcRenderer.invoke("backup-restore", id),
    delete: (id: string) => ipcRenderer.invoke("backup-delete", id),
  },
});

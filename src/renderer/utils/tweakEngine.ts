export interface Tweak {
  id: string;
  name: string;
  description: string;
  category: "free" | "premium";
  commands: string[];
  registryCommands?: string[];
  powershellCommands?: string[];
  serviceCommands?: string[];
  warning?: string;
  win11Only?: boolean;
}

export const FREE_TWEAKS: Tweak[] = [
  {
    id: "disable-gamebar",
    name: "Désactivation Xbox Game Bar",
    description: "Désactive la Xbox Game Bar qui consomme des ressources inutiles en jeu.",
    category: "free",
    commands: [],
    registryCommands: [
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR" /v AppCaptureEnabled /t REG_DWORD /d 0 /f',
      'reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\GameDVR" /v AllowGameDVR /t REG_DWORD /d 0 /f',
    ],
  },
  {
    id: "high-performance",
    name: "Mode Haute Performance",
    description: "Active le mode d'alimentation Haute Performance pour des performances maximales.",
    category: "free",
    commands: ["powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c"],
  },
  {
    id: "disable-notifications",
    name: "Désactivation Notifications",
    description: "Désactive les notifications Windows pendant les sessions de jeu.",
    category: "free",
    registryCommands: [
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\PushNotifications" /v ToastEnabled /t REG_DWORD /d 0 /f',
    ],
    commands: [],
  },
  {
    id: "clean-temp",
    name: "Nettoyage Fichiers Temporaires",
    description: "Supprime les fichiers temporaires pour libérer de l'espace et améliorer les temps de chargement.",
    category: "free",
    commands: [
      'del /q /f /s "%TEMP%\\*"',
      'del /q /f /s "C:\\Windows\\Temp\\*"',
    ],
  },
  {
    id: "disable-gamedvr",
    name: "Désactivation Game DVR",
    description: "Désactive l'enregistrement automatique Game DVR qui impacte les FPS.",
    category: "free",
    registryCommands: [
      'reg add "HKCU\\System\\GameConfigStore" /v GameDVR_Enabled /t REG_DWORD /d 0 /f',
      'reg add "HKCU\\System\\GameConfigStore" /v GameDVR_FSEBehaviorMode /t REG_DWORD /d 2 /f',
    ],
    commands: [],
  },
  {
    id: "timer-resolution",
    name: "Timer Resolution 0.5ms",
    description: "Active la résolution de timer haute précision pour réduire la latence gaming et les micro-stutters.",
    category: "free",
    commands: [
      "bcdedit /set disabledynamictick yes",
    ],
  },
  {
    id: "ssd-nvme-optimization",
    name: "Optimisation SSD/NVMe",
    description: "Désactive DisableLastAccess et EncryptPagingFile pour des temps d'accès SSD/NVMe optimaux.",
    category: "free",
    commands: [
      "fsutil behavior set DisableLastAccess 1",
      "fsutil behavior set EncryptPagingFile 0",
    ],
  },
  {
    id: "disable-defender-rt",
    name: "Désactivation Defender Temps Réel",
    description: "Désactive la protection temps réel Windows Defender pendant les sessions gaming pour libérer CPU.",
    category: "free",
    commands: [],
    powershellCommands: ["Set-MpPreference -DisableRealtimeMonitoring $true"],
  },
  {
    id: "mmcss-audio",
    name: "MMCSS Audio Tweaks",
    description: "Optimise le sous-système MMCSS (SystemResponsiveness=0, NetworkThrottlingIndex max) pour prioriser les jeux.",
    category: "free",
    commands: [],
    registryCommands: [
      'reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile" /v SystemResponsiveness /t REG_DWORD /d 0 /f',
      'reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile" /v NetworkThrottlingIndex /t REG_DWORD /d 4294967295 /f',
    ],
  },
];

export const PREMIUM_TWEAKS: Tweak[] = [
  // ── RÉSEAU ──────────────────────────────────────────────────────────────────
  {
    id: "tcp-autotune",
    name: "TCP AutoTuning Désactivé",
    description: "Désactive l'autotuning TCP pour une latence plus stable.",
    category: "premium",
    commands: ["netsh int tcp set global autotuninglevel=disabled"],
  },
  {
    id: "tcp-rss",
    name: "RSS Réseau Activé",
    description: "Active Receive Side Scaling pour distribuer la charge réseau sur plusieurs cœurs.",
    category: "premium",
    commands: ["netsh int tcp set global rss=enabled"],
  },
  {
    id: "tcp-chimney",
    name: "TCP Chimney Désactivé",
    description: "Désactive TCP Chimney pour une meilleure compatibilité et stabilité.",
    category: "premium",
    commands: [
      "netsh int tcp set global chimney=disabled",
      "netsh int tcp set global dca=enabled",
      "netsh int tcp set global netdma=enabled",
    ],
  },
  {
    id: "tcp-heuristics-disable",
    name: "Désactiver Heuristiques TCP",
    description: "Désactive les heuristiques TCP Windows (netsh int tcp set heuristics disabled) qui peuvent modifier automatiquement les réglages TCP manuels — préserve les tweaks appliqués manuellement.",
    category: "premium",
    commands: ["netsh int tcp set heuristics disabled"],
  },
  {
    id: "network-lso-disable",
    name: "Désactiver Large Send Offload (LSO)",
    description: "Désactive le Large Send Offload sur tous les adaptateurs réseau actifs — réduit la latence de traitement des paquets en forçant le CPU à gérer la segmentation TCP.",
    category: "premium",
    warning: "Peut légèrement augmenter la charge CPU réseau. Réactivez si vous constatez une dégradation du débit.",
    powershellCommands: [
      "Get-NetAdapter | Where-Object Status -eq 'Up' | ForEach-Object { Set-NetAdapterLso -Name $_.Name -IPv4Enabled $false -IPv6Enabled $false -ErrorAction SilentlyContinue }",
    ],
    commands: [],
  },
  {
    id: "dns-cloudflare",
    name: "DNS Cloudflare 1.1.1.1",
    description: "Configure le DNS Cloudflare ultra-rapide pour réduire la latence de résolution DNS.",
    category: "premium",
    commands: [
      'netsh interface ip set dns name="Ethernet" static 1.1.1.1 primary',
      'netsh interface ip add dns name="Ethernet" 1.0.0.1 index=2',
    ],
  },
  {
    id: "nagle-algorithm",
    name: "Désactivation Algorithme Nagle",
    description: "Désactive l'algorithme Nagle (TcpAckFrequency + TCPNoDelay) pour envoyer les paquets immédiatement sans délai.",
    category: "premium",
    commands: [],
    registryCommands: [
      'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces" /v TcpAckFrequency /t REG_DWORD /d 1 /f',
      'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces" /v TCPNoDelay /t REG_DWORD /d 1 /f',
    ],
  },
  {
    id: "mtu-gaming",
    name: "MTU Optimisé Gaming (1472)",
    description: "Configure le MTU optimal pour Fortnite afin d'éviter la fragmentation des paquets réseau.",
    category: "premium",
    commands: ['netsh interface ipv4 set subinterface "Ethernet" mtu=1472 store=persistent'],
  },
  {
    id: "qos-fortnite",
    name: "QoS Fortnite (Priorité Paquets)",
    description: "Configure la qualité de service Windows (DSCP 46) pour prioriser les paquets de Fortnite.",
    category: "premium",
    commands: [],
    registryCommands: [
      'reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\QoS\\Fortnite" /v "Application Name" /t REG_SZ /d "FortniteClient-Win64-Shipping.exe" /f',
      'reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\QoS\\Fortnite" /v "DSCP Value" /t REG_SZ /d "46" /f',
    ],
  },
  {
    id: "interrupt-affinity",
    name: "Interrupt Affinity Réseau",
    description: "Désactive l'Interrupt Moderation sur l'adaptateur Ethernet pour réduire la latence réseau.",
    category: "premium",
    commands: [],
    powershellCommands: ['Set-NetAdapterAdvancedProperty -Name "Ethernet" -RegistryKeyword "*InterruptModeration" -RegistryValue 0'],
  },
  // ── GPU ─────────────────────────────────────────────────────────────────────
  {
    id: "gpu-tdr",
    name: "TDR Delay GPU Optimise",
    description: "Configure TdrDelay=10, TdrDdiDelay=10 et TdrLevel=3 pour eviter les freezes GPU.",
    category: "premium",
    registryCommands: [
      'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers" /v TdrDelay /t REG_DWORD /d 10 /f',
      'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers" /v TdrDdiDelay /t REG_DWORD /d 10 /f',
      'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers" /v TdrLevel /t REG_DWORD /d 3 /f',
    ],
    commands: [],
  },
  {
    id: "gpu-hwsched",
    name: "Hardware Scheduling GPU",
    description: "Active le Hardware Scheduling GPU (HwSchMode=2) pour de meilleures performances.",
    category: "premium",
    registryCommands: [
      'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers" /v HwSchMode /t REG_DWORD /d 2 /f',
    ],
    commands: [],
  },
  {
    id: "disable-hpet",
    name: "Désactivation HPET",
    description: "Désactive le High Precision Event Timer pour réduire la latence système.",
    category: "premium",
    commands: ["bcdedit /deletevalue useplatformclock", "bcdedit /set disabledynamictick yes"],
  },
  {
    id: "nvidia-ull",
    name: "Ultra Low Latency Mode NVIDIA",
    description: "Active le mode Ultra Low Latency NVIDIA pour minimiser l'Input Lag GPU via le registre.",
    category: "premium",
    commands: [],
    registryCommands: [
      'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}\\0000" /v "NvCplEnableNvidiaPcieGen1" /t REG_DWORD /d 0 /f',
    ],
  },
  {
    id: "nvidia-shader-cache",
    name: "Shader Cache NVIDIA Désactivé",
    description: "Désactive le cache de shaders NVIDIA pour éviter la surcharge disque lors des chargements.",
    category: "premium",
    commands: [],
    registryCommands: [
      'reg add "HKCU\\SOFTWARE\\NVIDIA Corporation\\Global\\NVTweak" /v "Shaders" /t REG_DWORD /d 0 /f',
    ],
  },
  {
    id: "nvidia-auto-boost",
    name: "Texture Filtering Haute Performance",
    description: "Désactive l'auto-boost NVIDIA pour des fréquences GPU stables et prévisibles.",
    category: "premium",
    commands: ["nvidia-smi --auto-boost-default=0"],
  },
  {
    id: "nvidia-power-management",
    name: "Power Management Maximum Performance",
    description: "Force le GPU NVIDIA en mode Performance Maximum permanente via PerfLevelSrc.",
    category: "premium",
    commands: [],
    registryCommands: [
      'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}\\0000" /v "PerfLevelSrc" /t REG_DWORD /d 8738 /f',
    ],
  },
  // ── CPU ─────────────────────────────────────────────────────────────────────
  {
    id: "cpu-priority",
    name: "Priorité CPU Gaming",
    description: "Configure SchedulingCategory High et Priority 6 pour les jeux via le registre.",
    category: "premium",
    registryCommands: [
      'reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v Priority /t REG_DWORD /d 6 /f',
      'reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v "Scheduling Category" /t REG_SZ /d High /f',
      'reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v "SFIO Priority" /t REG_SZ /d High /f',
      'reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v "GPU Priority" /t REG_DWORD /d 8 /f',
    ],
    commands: [],
  },
  // ── SERVICES ─────────────────────────────────────────────────────────────────
  {
    id: "disable-superfetch",
    name: "Desactivation SysMain (deconseille 32GB)",
    description: "ATTENTION : sur 32 GB RAM, SysMain est benefique. A desactiver uniquement si RAM < 8 GB.",
    category: "premium",
    serviceCommands: ["sc stop SysMain", "sc config SysMain start=disabled"],
    commands: [],
  },
  {
    id: "disable-tracking",
    name: "Désactivation DiagTrack & Telemetry",
    description: "Désactive la télémétrie Windows qui consomme bande passante et CPU.",
    category: "premium",
    serviceCommands: [
      "sc stop DiagTrack",
      "sc config DiagTrack start=disabled",
      "sc stop dmwappushservice",
      "sc config dmwappushservice start=disabled",
    ],
    commands: [],
  },
  {
    id: "disable-xbox-services",
    name: "Désactivation Services Xbox",
    description: "Désactive XblAuthManager, XblGameSave, XboxGipSvc et XboxNetApiSvc.",
    category: "premium",
    serviceCommands: [
      "sc stop XblAuthManager",
      "sc config XblAuthManager start=disabled",
      "sc stop XblGameSave",
      "sc config XblGameSave start=disabled",
      "sc stop XboxGipSvc",
      "sc config XboxGipSvc start=disabled",
      "sc stop XboxNetApiSvc",
      "sc config XboxNetApiSvc start=disabled",
    ],
    commands: [],
  },
  {
    id: "disable-other-services",
    name: "Désactivation Services Inutiles",
    description: "Désactive MapsBroker, RetailDemo et WerSvc (rapport d'erreurs).",
    category: "premium",
    serviceCommands: [
      "sc stop MapsBroker",
      "sc config MapsBroker start=disabled",
      "sc stop RetailDemo",
      "sc config RetailDemo start=disabled",
      "sc stop WerSvc",
      "sc config WerSvc start=disabled",
    ],
    commands: [],
  },
  // ── MÉMOIRE ──────────────────────────────────────────────────────────────────
  {
    id: "memory-usage",
    name: "Optimisation Mémoire fsutil",
    description: "Configure memoryusage=1 (optimal 32GB) et désactive 8dot3 et lastaccess.",
    category: "premium",
    commands: [
      "fsutil behavior set memoryusage 1",
      "fsutil behavior set disable8dot3 1",
      "fsutil behavior set disablelastaccess 1",
    ],
  },
  {
    id: "disable-memory-compression",
    name: "Desactivation Memory Compression",
    description: "Desactive la compression memoire Windows pour liberer des ressources CPU.",
    category: "premium",
    powershellCommands: ["Disable-MMAgent -mc"],
    commands: [],
  },
  // ── NOUVEAUX TWEAKS PREMIUM ──────────────────────────────────────────────────
  {
    id: "disable-mpo",
    name: "Desactivation MPO (Multi-Plane Overlay)",
    description: "Elimine les micro-freezes et stutters sur GPU NVIDIA laptops. Impact majeur sur GTX 1650 Ti.",
    category: "premium",
    commands: [],
    registryCommands: [
      'reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\Dwm" /v "OverlayTestMode" /t REG_DWORD /d 5 /f',
    ],
  },
  {
    id: "bcdedit-dynamictick",
    name: "Desactivation Dynamic Tick (BCDEdit)",
    description: "Reduit les interruptions CPU inutiles pour une latence d'input plus stable.",
    category: "premium",
    commands: [
      "bcdedit /set disabledynamictick yes",
      "bcdedit /set useplatformclock false",
    ],
  },
  {
    id: "wifi-sleep-disable",
    name: "Desactivation Veille Adaptateur WiFi",
    description: "Empeche l'adaptateur WiFi de se mettre en veille, elimine les pics de ping.",
    category: "premium",
    commands: [
      'powershell -Command "Get-NetAdapter | Where-Object {$_.PhysicalMediaType -like \'*802.11*\'} | ForEach-Object { try { Set-NetAdapterPowerManagement -Name $_.Name -AllowComputerToTurnOffDevice Disabled } catch {} }"',
    ],
    registryCommands: [
      'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4D36E972-E325-11CE-BFC1-08002bE10318}\\0001" /v "PnPCapabilities" /t REG_DWORD /d 24 /f',
    ],
  },
  {
    id: "disable-power-throttling",
    name: "Desactivation PowerThrottling",
    description: "Desactive le throttling CPU de Windows (PowerThrottlingOff=1) pour que le processeur maintienne sa frequence maximale en jeu.",
    category: "premium",
    warning: "Non recommande sur laptop sans bon refroidissement — risque de surchauffe sous charge prolongee (i5-10300H notamment). A eviter sur secteur si les temperatures depassent 90°C.",
    commands: [],
    registryCommands: [
      'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerThrottling" /v "PowerThrottlingOff" /t REG_DWORD /d 1 /f',
    ],
  },
  {
    id: "mft-zone",
    name: "Optimisation Zone MFT (NTFS)",
    description: "Agrandit la zone MFT pour eviter la fragmentation sur les gros fichiers Fortnite.",
    category: "premium",
    commands: ["fsutil behavior set mftzone 2"],
  },
  // ── TWEAKS D:\OPTI KERMOUK ───────────────────────────────────────────────────
  {
    id: "win32-priority-separation",
    name: "Win32PrioritySeparation Gaming (0x26)",
    description: "Configure Win32PrioritySeparation=0x26 (38 decimal) : intervalles courts, separation maximale foreground/background. L'avant-plan (jeu) recoit 3x plus de CPU que les processus en fond.",
    category: "premium",
    commands: [],
    registryCommands: [
      'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl" /v Win32PrioritySeparation /t REG_DWORD /d 38 /f',
    ],
  },
  {
    id: "mmcss-latency-sensitive",
    name: "MMCSS NoLazyMode + LatencySensitive",
    description: "Active NoLazyMode et AlwaysOn sur le profil MMCSS et marque toutes les taches comme Latency Sensitive pour reduire les micro-stutters.",
    category: "premium",
    commands: [],
    registryCommands: [
      'reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile" /v NoLazyMode /t REG_DWORD /d 1 /f',
      'reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile" /v AlwaysOn /t REG_DWORD /d 1 /f',
      'reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games" /v "Latency Sensitive" /t REG_SZ /d True /f',
      'reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Low Latency" /v "Latency Sensitive" /t REG_SZ /d True /f',
      'reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Audio" /v "Latency Sensitive" /t REG_SZ /d True /f',
      'reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\DisplayPostProcessing" /v "Latency Sensitive" /t REG_SZ /d True /f',
      'reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Window Manager" /v "Latency Sensitive" /t REG_SZ /d True /f',
    ],
  },
  {
    id: "keyboard-mouse-queue",
    name: "Taille Buffer Clavier & Souris",
    description: "Augmente la file d'attente clavier (kbdclass) et souris (mouclass) a 32 entrees pour eviter les drops d'inputs.",
    category: "premium",
    commands: [],
    registryCommands: [
      'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\kbdclass\\Parameters" /v KeyboardDataQueueSize /t REG_DWORD /d 32 /f',
      'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\mouclass\\Parameters" /v MouseDataQueueSize /t REG_DWORD /d 32 /f',
    ],
  },
  {
    id: "core-parking-disable",
    name: "Desactivation Core Parking",
    description: "Empeche Windows d'eteindre des coeurs CPU en jeu (Wake Up Cores). Reduit les pics de latence sur i5-10300H.",
    category: "premium",
    commands: [],
    registryCommands: [
      'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerSettings\\54533251-82be-4824-96c1-47b60b740d00\\943c8cb6-6f93-4227-ad87-e9a3feec08d1" /v Attributes /t REG_DWORD /d 2 /f',
    ],
  },
  {
    id: "usb-power-save-disable",
    name: "Desactivation Veille USB",
    description: "Empeche Windows de mettre en veille les peripheriques USB (souris, clavier, casque) pour eliminer les micro-freezes.",
    category: "premium",
    commands: [],
    powershellCommands: [
      'Get-PnpDevice | Where-Object { $_.InstanceId -like "*USB\\ROOT*" } | ForEach-Object { try { $obj = Get-CimInstance -ClassName MSPower_DeviceEnable -Namespace root\\wmi | Where-Object { $_.InstanceName -like "*$($_.InstanceId)*" }; if ($obj) { Set-CimInstance -InputObject $obj -Property @{Enable=$false} } } catch {} }',
      'Get-NetAdapter -Physical | Get-NetAdapterPowerManagement | ForEach-Object { $_.AllowComputerToTurnOffDevice = "Disabled"; $_ | Set-NetAdapterPowerManagement }',
    ],
  },
  {
    id: "winsock-reset",
    name: "Reset Winsock & DNS Flush",
    description: "Reinitialise la pile reseau Windows et vide le cache DNS pour des connexions plus propres.",
    category: "premium",
    commands: [
      "netsh winsock reset",
      "netsh int ip reset",
      "ipconfig /flushdns",
    ],
  },
  {
    id: "delivery-optimization-disable",
    name: "Desactivation Delivery Optimization",
    description: "Desactive le partage de mises a jour Windows entre PCs (DownloadMode=0) pour liberer de la bande passante en jeu.",
    category: "premium",
    commands: [],
    registryCommands: [
      'reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\DeliveryOptimization\\Config" /v DownloadMode /t REG_DWORD /d 0 /f',
    ],
  },
  {
    id: "energy-estimation-disable",
    name: "Desactivation EnergyEstimation",
    description: "Desactive le calcul d'estimation energetique Windows inutile sur un PC gaming branche.",
    category: "premium",
    commands: [],
    registryCommands: [
      'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Power" /v EnergyEstimationEnabled /t REG_DWORD /d 0 /f',
      'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Power" /v Latency /t REG_DWORD /d 0 /f',
      'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Power" /v LowLatency /t REG_DWORD /d 1 /f',
      'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Power" /v HighestPerformance /t REG_DWORD /d 1 /f',
    ],
  },
  {
    id: "svhost-split-32gb",
    name: "SvcHostSplitThreshold 32 GB",
    description: "Configure SvcHostSplitThresholdInKB=3200000 pour 32 GB de RAM afin de reduire le nombre de processus svchost et liberer de la memoire.",
    category: "premium",
    commands: [],
    registryCommands: [
      'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control" /v SvcHostSplitThresholdInKB /t REG_DWORD /d 3200000 /f',
    ],
  },
  // ── RÉSEAU — NCSI & NetBIOS ──────────────────────────────────────────────────
  {
    id: "ncsi-disable",
    name: "Desactivation Sondes NCSI (ActiveProbing)",
    description: "Desactive les sondes de connectivite Windows (EnableActiveProbing=0) qui envoient des requetes HTTP periodiques en arriere-plan — libere de la bande passante et reduit les pics de ping.",
    category: "premium",
    commands: [],
    registryCommands: [
      'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\NlaSvc\\Parameters\\Internet" /v EnableActiveProbing /t REG_DWORD /d 0 /f',
    ],
  },
  {
    id: "netbios-disable",
    name: "Desactivation NetBIOS over TCP/IP",
    description: "Desactive NetBIOS sur toutes les interfaces reseau (NetbiosOptions=2). Elimine les broadcasts reseau inutiles et reduit la surface d'attaque.",
    category: "premium",
    commands: [],
    powershellCommands: [
      'Get-ChildItem "HKLM:\\SYSTEM\\CurrentControlSet\\services\\NetBT\\Parameters\\Interfaces" | ForEach-Object { Set-ItemProperty -Path $_.PSPath -Name NetbiosOptions -Value 2 -ErrorAction SilentlyContinue }',
    ],
    registryCommands: [
      'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\NetBT\\Parameters" /v NodeType /t REG_DWORD /d 2 /f',
    ],
  },
  // ── GPU — DisablePreemption ───────────────────────────────────────────────────
  {
    id: "gpu-disable-preemption",
    name: "Desactivation Preemption GPU (Scheduler)",
    description: "Desactive la preemption du scheduler GPU (EnablePreemption=0) pour eviter les interruptions en plein rendu et reduire les micro-stutters.",
    category: "premium",
    warning: "Peut degrader la reactivite en multitache et lors des alt-tab. Recommande uniquement sur un PC dedie au jeu sans autres charges lourdes en parallele.",
    commands: [],
    registryCommands: [
      'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers\\Scheduler" /v EnablePreemption /t REG_DWORD /d 0 /f',
    ],
  },
  // ── GPU — HDCP NVIDIA ─────────────────────────────────────────────────────────
  {
    id: "nvidia-hdcp-disable",
    name: "Desactivation HDCP (NVIDIA uniquement)",
    description: "Desactive HDCP sur le GPU NVIDIA (RMHdcpKeyglobZero=1) pour eliminer le handshake de protection du contenu qui peut ajouter de la latence sur certains ecrans. Sans effet sur GPU AMD.",
    category: "premium",
    commands: [],
    powershellCommands: [
      'Get-ChildItem "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}" | Where-Object { (Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue).DriverDesc -like "*NVIDIA*" } | ForEach-Object { Set-ItemProperty -Path $_.PSPath -Name RMHdcpKeyglobZero -Value 1 -Type DWord -ErrorAction SilentlyContinue }',
    ],
  },
  // ── PÉRIPHÉRIQUES — USB SelectiveSuspend ─────────────────────────────────────
  {
    id: "usb-selective-suspend-off",
    name: "Desactivation USB Selective Suspend",
    description: "Empeche Windows de suspendre les peripheriques USB (DisableSelectiveSuspend=1). Elimine les micro-freezes de 1-2ms sur souris et clavier USB lors du reveil du peripherique.",
    category: "premium",
    commands: [],
    registryCommands: [
      'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\USB" /v DisableSelectiveSuspend /t REG_DWORD /d 1 /f',
    ],
  },
  // ── GPU NVIDIA exclusifs ──────────────────────────────────────────────────────
  {
    id: "nvidia-geforce-update-disable",
    name: "Désactiver mise à jour GeForce Experience",
    description: "Désactive le service de télémétrie NVIDIA (NvTmSvc) qui gère les notifications et vérifications de mise à jour du pilote via GeForce Experience.",
    category: "premium",
    serviceCommands: [
      "sc stop NvTmSvc",
      "sc config NvTmSvc start=disabled",
      "sc stop NvTmRepOnError",
      "sc config NvTmRepOnError start=disabled",
    ],
    registryCommands: [
      'reg add "HKCU\\SOFTWARE\\NVIDIA Corporation\\NvControlPanel2\\Client" /v "OptInOrOutPreference" /t REG_DWORD /d 0 /f',
    ],
    commands: [],
  },
  {
    id: "nvidia-contiguous-memory",
    name: "Allocation Mémoire Contiguë GPU NVIDIA",
    description: "Demande au driver NVIDIA de prioriser les allocations contiguës en VRAM pour réduire la fragmentation mémoire GPU et améliorer la stabilité des framerates.",
    category: "premium",
    warning: "Expérimental — effet variable selon la version du driver NVIDIA installée. Nécessite un redémarrage pour être pris en compte.",
    powershellCommands: [
      'Get-ChildItem "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}" -ErrorAction SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue).DriverDesc -like "*NVIDIA*" } | ForEach-Object { Set-ItemProperty -Path $_.PSPath -Name "PreferContiguousAlloc" -Value 1 -Type DWord -ErrorAction SilentlyContinue }',
    ],
    commands: [],
  },
  {
    id: "nvidia-uvm-disable",
    name: "Désactiver NVIDIA UVM (Unified Virtual Memory)",
    description: "Tente de désactiver le composant Unified Virtual Memory du driver NVIDIA (utilisé par CUDA). Sur GTX/RTX grand public, l'UVM est intégré au driver — l'effet est généralement nul sans danger.",
    category: "premium",
    warning: "AVERTISSEMENT — Casse les applications CUDA : Adobe Premiere, DaVinci Resolve, Blender GPU, certains encodeurs de capture/streaming. Ne pas activer sur un PC de streaming ou de montage. Sur GTX/RTX grand public, l'UVM ne peut pas être désactivé par l'OS.",
    powershellCommands: [
      '$d = Get-PnpDevice | Where-Object { $_.FriendlyName -match "NVIDIA.*UVM|NVIDIA.*Virtual" } | Select-Object -First 1; if ($d) { Disable-PnpDevice -InstanceId $d.InstanceId -Confirm:$false -ErrorAction SilentlyContinue }',
    ],
    commands: [],
  },
  {
    id: "nvidia-dma-remapping-disable",
    name: "Désactiver DMA Remapping NVIDIA",
    description: "Désactive le DMA Remapping dans le registre du driver NVIDIA pour réduire la surcharge du mapping mémoire DMA — peut abaisser la latence des transferts CPU/GPU.",
    category: "premium",
    warning: "Protection mémoire DMA réduite — diminue légèrement la protection contre les accès PCIe/Thunderbolt non autorisés. Impact minimal pour un usage gaming sans périphériques non fiables.",
    powershellCommands: [
      'Get-ChildItem "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}" -ErrorAction SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue).DriverDesc -like "*NVIDIA*" } | ForEach-Object { Set-ItemProperty -Path $_.PSPath -Name "EnableDmaRemapping" -Value 0 -Type DWord -ErrorAction SilentlyContinue }',
    ],
    commands: [],
  },
  {
    id: "nvidia-idle-threshold",
    name: "Optimiser Seuils d'Inactivité GPU NVIDIA",
    description: "Configure PowerMizer NVIDIA pour maintenir les moteurs GPU actifs plus longtemps avant de réduire les fréquences — réduit les micro-stutters lors des transitions entre scènes.",
    category: "premium",
    warning: "Sur laptop (GTX 1650 Ti), peut augmenter légèrement la consommation et la chaleur GPU au repos. Surveiller les températures après application.",
    powershellCommands: [
      'Get-ChildItem "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}" -ErrorAction SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue).DriverDesc -like "*NVIDIA*" } | ForEach-Object { Set-ItemProperty -Path $_.PSPath -Name "PowerMizerLevel" -Value 1 -Type DWord -ErrorAction SilentlyContinue; Set-ItemProperty -Path $_.PSPath -Name "PowerMizerLevelAC" -Value 1 -Type DWord -ErrorAction SilentlyContinue }',
    ],
    commands: [],
  },
  // ── CPU (nouveaux) ────────────────────────────────────────────────────────────
  {
    id: "disable-cstates",
    name: "Désactiver C-States CPU (états basse conso)",
    description: "Empêche le CPU d'entrer dans les états d'économie d'énergie C1/C2/C3 — maintient tous les coeurs en état actif C0 permanent pour une latence d'input minimale.",
    category: "premium",
    warning: "AVERTISSEMENT FORT — Augmente significativement la consommation électrique et la chaleur CPU. Fortement déconseillé sur laptop (i5-10300H) sans refroidissement renforcé. À utiliser uniquement branché secteur et en jeu actif.",
    commands: [
      "powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR IDLEDISABLE 1",
      "powercfg -setdcvalueindex SCHEME_CURRENT SUB_PROCESSOR IDLEDISABLE 1",
      "powercfg -setactive SCHEME_CURRENT",
    ],
  },
  {
    id: "disable-coalescable-timer",
    name: "Désactiver Coalescable Timer",
    description: "Empêche le noyau Windows de regrouper les événements timer pour économiser de l'énergie (CoalesceTimerInterval=0) — chaque tick est traité immédiatement, réduisant la latence d'input et les micro-stutters.",
    category: "premium",
    registryCommands: [
      'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\kernel" /v "CoalesceTimerInterval" /t REG_DWORD /d 0 /f',
    ],
    commands: [],
  },
  {
    id: "cpu-max-performance",
    name: "État Processeur Min/Max à 100% + Perf Max",
    description: "Force le CPU à 100% de fréquence minimum et maximum (PROCTHROTTLEMIN/MAX=100%) et configure la préférence d'énergie sur Performance maximale — aucune réduction de fréquence en jeu.",
    category: "premium",
    warning: "AVERTISSEMENT FORT — Empêche tout ajustement dynamique de fréquence CPU. Augmente significativement la chaleur et la consommation. Déconseillé sur laptop (i5-10300H) sans refroidissement renforcé — vérifiez que les températures restent sous 90°C sous charge.",
    commands: [
      "powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMIN 100",
      "powercfg -setdcvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMIN 100",
      "powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMAX 100",
      "powercfg -setdcvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMAX 100",
      "powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR ENERGYPREFERENCE 0",
      "powercfg -setdcvalueindex SCHEME_CURRENT SUB_PROCESSOR ENERGYPREFERENCE 0",
      "powercfg -setactive SCHEME_CURRENT",
    ],
  },
  {
    id: "disable-modern-standby",
    name: "Désactiver Modern Standby (S0 Low Power Idle)",
    description: "Désactive le mode Connected Standby/Modern Standby pour revenir à la veille S3 classique — évite les micro-réveils en arrière-plan pendant la veille laptop.",
    category: "premium",
    warning: "Change le comportement de veille du laptop — le couvercle fermé ne déclenche plus une veille connectée. Peut affecter l'autonomie batterie si le PC est mis en veille sans extinction. Nécessite un redémarrage.",
    registryCommands: [
      'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Power" /v "CsEnabled" /t REG_DWORD /d 0 /f',
    ],
    commands: [],
  },
  // ── RAM (nouveaux) ────────────────────────────────────────────────────────────
  {
    id: "clear-pagefile-shutdown",
    name: "Vider la Page File à l'Arrêt",
    description: "Configure Windows pour effacer le fichier d'échange (pagefile.sys) à chaque arrêt — améliore la confidentialité et évite que des données sensibles restent sur le disque.",
    category: "premium",
    registryCommands: [
      'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management" /v "ClearPageFileAtShutdown" /t REG_DWORD /d 1 /f',
    ],
    commands: [],
  },
  {
    id: "disable-prefetcher",
    name: "Désactiver Prefetcher Disque",
    description: "Désactive le mécanisme de prélecture automatique Windows (EnablePrefetcher=0) — sur SSD/NVMe, le prefetcher est redondant car les temps d'accès sont déjà quasi-nuls.",
    category: "premium",
    registryCommands: [
      'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management\\PrefetchParameters" /v "EnablePrefetcher" /t REG_DWORD /d 0 /f',
    ],
    commands: [],
  },
  {
    id: "disable-ram-diagnostics",
    name: "Désactiver Tâches Diagnostics RAM",
    description: "Désactive les tâches planifiées de diagnostic mémoire Windows (MemoryDiagnostic) qui s'exécutent au démarrage — libère des ressources CPU au boot.",
    category: "premium",
    commands: [
      'schtasks /Change /TN "\\Microsoft\\Windows\\MemoryDiagnostic\\RunFullMemoryDiagnostic" /Disable',
      'schtasks /Change /TN "\\Microsoft\\Windows\\MemoryDiagnostic\\ProcessMemoryDiagnosticEvents" /Disable',
    ],
  },
  {
    id: "restore-sysmain",
    name: "Vérifier et Réactiver SysMain",
    description: "Vérifie si SysMain (SuperFetch) a été désactivé par un outil tiers et le remet en automatique si nécessaire. SysMain est bénéfique sur 32 Go de RAM — recommandé de le garder actif.",
    category: "premium",
    powershellCommands: [
      "$svc = Get-Service -Name 'SysMain' -ErrorAction SilentlyContinue; if ($svc -and $svc.StartType -eq 'Disabled') { Set-Service 'SysMain' -StartupType Automatic; Start-Service 'SysMain' -ErrorAction SilentlyContinue; Write-Host 'SysMain reactivé' } else { Write-Host 'SysMain deja actif' }",
    ],
    commands: [],
  },
  {
    id: "disable-page-combining",
    name: "Désactiver Page Combining",
    description: "Désactive la fusion de pages mémoire identiques (DisablePageCombining=1) — libère du CPU en éliminant le scan permanent de pages RAM dupliquées. Recommandé sur les configs avec 16 Go ou plus.",
    category: "premium",
    warning: "Non recommandé si vous avez moins de 16 Go de RAM — le Page Combining permet d'économiser de la RAM sur les petites configurations. Sur 32 Go (hardware cible), le gain CPU est plus pertinent que l'économie mémoire.",
    registryCommands: [
      'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management" /v "DisablePageCombining" /t REG_DWORD /d 1 /f',
    ],
    commands: [],
  },
  // ── PÉRIPHÉRIQUES (nouveaux) ──────────────────────────────────────────────────
  {
    id: "disable-mouse-acceleration",
    name: "Désactiver Accélération Souris",
    description: "Désactive l'Enhanced Pointer Precision Windows (MouseSpeed=0) pour un mouvement de souris linéaire et prévisible — indispensable pour la précision en jeu FPS.",
    category: "premium",
    registryCommands: [
      'reg add "HKCU\\Control Panel\\Mouse" /v "MouseSpeed" /t REG_SZ /d "0" /f',
    ],
    commands: [],
  },
  {
    id: "disable-sticky-keys",
    name: "Désactiver Sticky Keys (raccourci Shift×5)",
    description: "Désactive le raccourci Sticky Keys qui se déclenche en appuyant 5 fois sur Shift — évite les interruptions accidentelles en jeu.",
    category: "premium",
    registryCommands: [
      'reg add "HKCU\\Control Panel\\Accessibility\\StickyKeys" /v "Flags" /t REG_SZ /d "506" /f',
    ],
    commands: [],
  },
  {
    id: "disable-toggle-keys",
    name: "Désactiver Toggle Keys (raccourci Verr. Num)",
    description: "Désactive le raccourci Toggle Keys (maintien touche Verr. Num) qui peut déclencher un bip sonore inattendu en jeu.",
    category: "premium",
    registryCommands: [
      'reg add "HKCU\\Control Panel\\Accessibility\\ToggleKeys" /v "Flags" /t REG_SZ /d "58" /f',
    ],
    commands: [],
  },
  {
    id: "enable-pixel-mouse",
    name: "Mouvement Souris 1:1 Pixel (Courbe Plate)",
    description: "Remet la courbe d'accélération souris à plat complète (MouseSpeed=0, Threshold1=0, Threshold2=0) — chaque pixel de mouvement physique correspond exactement à un pixel à l'écran.",
    category: "premium",
    registryCommands: [
      'reg add "HKCU\\Control Panel\\Mouse" /v "MouseSpeed" /t REG_SZ /d "0" /f',
      'reg add "HKCU\\Control Panel\\Mouse" /v "MouseThreshold1" /t REG_SZ /d "0" /f',
      'reg add "HKCU\\Control Panel\\Mouse" /v "MouseThreshold2" /t REG_SZ /d "0" /f',
    ],
    commands: [],
  },
  {
    id: "keyboard-repeat-delay",
    name: "Réduire Délai de Répétition Clavier",
    description: "Réduit le délai avant répétition automatique des touches (KeyboardDelay=0, le plus court) et maximise la vitesse de répétition (KeyboardSpeed=31) — améliore la réactivité des saisies rapides.",
    category: "premium",
    registryCommands: [
      'reg add "HKCU\\Control Panel\\Keyboard" /v "KeyboardDelay" /t REG_SZ /d "0" /f',
      'reg add "HKCU\\Control Panel\\Keyboard" /v "KeyboardSpeed" /t REG_SZ /d "31" /f',
    ],
    commands: [],
  },
  // ── STOCKAGE (conditionnels — HDD/SSD détectés au runtime) ───────────────────
  // NOTE: "Disable Write Cache Buffer Flushing" intentionnellement absent —
  // risque de corruption de données en cas de coupure de courant, inacceptable
  // pour un produit commercial même avec avertissement.
  {
    id: "disable-dipm-hipm",
    name: "Désactiver DIPM/HIPM et Parking HDD",
    description: "Désactive la gestion d'alimentation des liens SATA (HIPM/DIPM=0) et empêche le HDD de s'éteindre — élimine les latences de head parking et de réveil disque dur.",
    category: "premium",
    commands: [
      "powercfg -setacvalueindex SCHEME_CURRENT 0012ee47-9041-4b5d-9b77-535fba8b1442 dab60367-53fe-4fbc-825e-521d069d2456 0",
      "powercfg -setdcvalueindex SCHEME_CURRENT 0012ee47-9041-4b5d-9b77-535fba8b1442 dab60367-53fe-4fbc-825e-521d069d2456 0",
      "powercfg -setacvalueindex SCHEME_CURRENT 0012ee47-9041-4b5d-9b77-535fba8b1442 6738e2c4-e8a5-4a42-b16a-e040e769756e 0",
      "powercfg -setdcvalueindex SCHEME_CURRENT 0012ee47-9041-4b5d-9b77-535fba8b1442 6738e2c4-e8a5-4a42-b16a-e040e769756e 0",
      "powercfg -setactive SCHEME_CURRENT",
    ],
  },
  {
    id: "disable-ssd-powersave",
    name: "Désactiver Économie d'Énergie SSD",
    description: "Empêche le SSD d'entrer en mode basse consommation en désactivant le timer d'extinction disque (jamais = 0) — élimine les latences de réveil SSD lors des accès.",
    category: "premium",
    commands: [
      "powercfg -setacvalueindex SCHEME_CURRENT 0012ee47-9041-4b5d-9b77-535fba8b1442 6738e2c4-e8a5-4a42-b16a-e040e769756e 0",
      "powercfg -setdcvalueindex SCHEME_CURRENT 0012ee47-9041-4b5d-9b77-535fba8b1442 6738e2c4-e8a5-4a42-b16a-e040e769756e 0",
      "powercfg -setactive SCHEME_CURRENT",
    ],
  },
  {
    id: "optimise-ssd-sleep",
    name: "Optimiser Veille SSD (AHCI Link Power)",
    description: "Désactive le Link Power Management SATA/AHCI (HIPM/DIPM=0) pour maintenir le SSD en état actif permanent — réduit les micro-latences liées aux transitions d'état de lien SATA.",
    category: "premium",
    commands: [
      "powercfg -setacvalueindex SCHEME_CURRENT 0012ee47-9041-4b5d-9b77-535fba8b1442 dab60367-53fe-4fbc-825e-521d069d2456 0",
      "powercfg -setdcvalueindex SCHEME_CURRENT 0012ee47-9041-4b5d-9b77-535fba8b1442 dab60367-53fe-4fbc-825e-521d069d2456 0",
      "powercfg -setactive SCHEME_CURRENT",
    ],
  },
  // ── PRIVACY — Confidentialité & Télémétrie ────────────────────────────────────
  {
    id: "privacy-activity-feed",
    name: "Désactiver Activity Feed",
    description: "Désactive l'Historique d'activité Windows (EnableActivityFeed=0) qui collecte et synchronise vos activités avec le cloud Microsoft.",
    category: "premium",
    registryCommands: [
      'reg add "HKCU\\Software\\Policies\\Microsoft\\Windows\\System" /v "EnableActivityFeed" /t REG_DWORD /d 0 /f',
      'reg add "HKCU\\Software\\Policies\\Microsoft\\Windows\\System" /v "PublishUserActivities" /t REG_DWORD /d 0 /f',
    ],
    commands: [],
  },
  {
    id: "privacy-all-ads",
    name: "Désactiver Publicités et Suggestions",
    description: "Supprime les publicités sur l'écran de verrouillage, les suggestions d'apps et les contenus sponsorisés dans le menu Démarrer et les notifications Windows.",
    category: "premium",
    registryCommands: [
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager" /v "EnableThirdPartySuggestions" /t REG_DWORD /d 0 /f',
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager" /v "SilentInstalledAppsEnabled" /t REG_DWORD /d 0 /f',
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager" /v "OemPreInstalledAppsEnabled" /t REG_DWORD /d 0 /f',
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager" /v "PreInstalledAppsEnabled" /t REG_DWORD /d 0 /f',
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager" /v "ContentDeliveryAllowed" /t REG_DWORD /d 0 /f',
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager" /v "SubscribedContent-338388Enabled" /t REG_DWORD /d 0 /f',
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager" /v "SubscribedContent-338389Enabled" /t REG_DWORD /d 0 /f',
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager" /v "SubscribedContent-353694Enabled" /t REG_DWORD /d 0 /f',
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager" /v "SubscribedContent-353696Enabled" /t REG_DWORD /d 0 /f',
    ],
    commands: [],
  },
  {
    id: "privacy-ceip",
    name: "Désactiver CEIP (Customer Experience Program)",
    description: "Désactive le programme d'amélioration de Windows qui envoie anonymement des données d'utilisation à Microsoft (CEIPEnable=0).",
    category: "premium",
    registryCommands: [
      'reg add "HKLM\\Software\\Microsoft\\SQMClient\\Windows" /v "CEIPEnable" /t REG_DWORD /d 0 /f',
      'reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\SQMClient" /v "CEIPEnable" /t REG_DWORD /d 0 /f',
    ],
    commands: [],
  },
  {
    id: "privacy-diagnostic-data",
    name: "Bloquer Collecte Données Diagnostics",
    description: "Force le niveau de télémétrie Windows au minimum (AllowTelemetry=0) — bloque l'envoi des données de diagnostic détaillées à Microsoft.",
    category: "premium",
    warning: "Sur Windows 10 Home, le niveau 0 est remplacé par le niveau 1 (Sécurité) par Windows Update — cela limite les données mais ne les supprime pas totalement.",
    registryCommands: [
      'reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection" /v "AllowTelemetry" /t REG_DWORD /d 0 /f',
    ],
    commands: [],
  },
  {
    id: "privacy-diagnostic-tracking",
    name: "Arrêter Service DiagTrack (Télémétrie)",
    description: "Met le service Connected User Experiences and Telemetry (DiagTrack) en démarrage manuel — bloque la collecte continue de données de diagnostic en arrière-plan.",
    category: "premium",
    warning: "Peut empêcher certaines fonctions Windows Update et les rapports de crash automatiques. Réactivez si vous rencontrez des problèmes de mise à jour.",
    serviceCommands: [
      "sc stop DiagTrack",
      "sc config DiagTrack start=demand",
    ],
    commands: [],
  },
  {
    id: "privacy-compatibility-telemetry",
    name: "Désactiver Télémétrie Compatibilité Windows",
    description: "Désactive la tâche planifiée Microsoft Compatibility Appraiser qui analyse votre configuration pour les mises à niveau Windows et envoie des données à Microsoft.",
    category: "premium",
    warning: "Peut réduire la précision des notifications de compatibilité de mise à niveau Windows. Réactivez avant une mise à niveau majeure de Windows.",
    commands: [
      'schtasks /Change /TN "\\Microsoft\\Windows\\Application Experience\\Microsoft Compatibility Appraiser" /Disable',
      'schtasks /Change /TN "\\Microsoft\\Windows\\Application Experience\\AitAgent" /Disable',
    ],
  },
  {
    id: "privacy-error-reporting",
    name: "Désactiver Rapport d'Erreurs Windows",
    description: "Désactive le service Windows Error Reporting (WerSvc) en démarrage manuel et bloque l'envoi automatique des rapports de crash à Microsoft.",
    category: "premium",
    serviceCommands: [
      "sc stop WerSvc",
      "sc config WerSvc start=demand",
    ],
    registryCommands: [
      'reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\Windows Error Reporting" /v "Disabled" /t REG_DWORD /d 1 /f',
    ],
    commands: [],
  },
  {
    id: "privacy-feedback-hub",
    name: "Désactiver Demandes Feedback Hub",
    description: "Supprime les popups de demande de retour d'expérience Windows (Hub de commentaires) en limitant le nombre de demandes de feedback à zéro.",
    category: "premium",
    registryCommands: [
      'reg add "HKCU\\Software\\Microsoft\\Siuf\\Rules" /v "NumberOfSIUFInPeriod" /t REG_DWORD /d 0 /f',
      'reg add "HKCU\\Software\\Microsoft\\Siuf\\Rules" /v "PeriodInNanoSeconds" /t REG_DWORD /d 0 /f',
    ],
    commands: [],
  },
  {
    id: "privacy-help-experience",
    name: "Désactiver Collecte Données Support Microsoft",
    description: "Désactive les tâches et clés de registre du programme d'amélioration de l'aide Windows qui collectent des données anonymes sur l'utilisation du support.",
    category: "premium",
    registryCommands: [
      'reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\SQMClient" /v "CEIPEnable" /t REG_DWORD /d 0 /f',
    ],
    commands: [],
  },
  {
    id: "privacy-inventory-collector",
    name: "Désactiver Inventory Collector",
    description: "Désactive la tâche ProgramDataUpdater qui collecte des informations sur les programmes installés pour les envoyer à Microsoft à des fins statistiques.",
    category: "premium",
    commands: [
      'schtasks /Change /TN "\\Microsoft\\Windows\\Application Experience\\ProgramDataUpdater" /Disable',
    ],
  },
  {
    id: "privacy-location-tracking",
    name: "Désactiver Service de Localisation",
    description: "Met le service de géolocalisation Windows (lfsvc) en démarrage manuel et bloque le tracking GPS/réseau en arrière-plan.",
    category: "premium",
    warning: "Désactive la localisation pour toutes les apps Windows y compris les apps de carte et météo. Réactivez si vous utilisez ces services.",
    serviceCommands: [
      "sc stop lfsvc",
      "sc config lfsvc start=demand",
    ],
    registryCommands: [
      'reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\LocationAndSensors" /v "DisableLocation" /t REG_DWORD /d 1 /f',
    ],
    commands: [],
  },
  {
    id: "privacy-remote-assistance",
    name: "Désactiver Assistance à Distance",
    description: "Désactive la fonctionnalité Assistance à distance Windows (fAllowToGetHelp=0) — empêche toute connexion entrante de support à distance via les outils Windows intégrés.",
    category: "premium",
    registryCommands: [
      'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Remote Assistance" /v "fAllowToGetHelp" /t REG_DWORD /d 0 /f',
    ],
    commands: [],
  },
  {
    id: "privacy-timeline-tracking",
    name: "Désactiver Timeline et Historique Activité",
    description: "Désactive la Timeline Windows (Chronologie) qui conserve et synchronise l'historique de toutes vos activités — navigation, documents, apps utilisées.",
    category: "premium",
    registryCommands: [
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\ActivityHistory" /v "PublishUserActivities" /t REG_DWORD /d 0 /f',
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\ActivityHistory" /v "UploadUserActivities" /t REG_DWORD /d 0 /f',
    ],
    commands: [],
  },
  {
    id: "privacy-advertising-id",
    name: "Désactiver Identifiant Publicitaire Unique",
    description: "Désactive l'identifiant publicitaire unique Windows (AdvertisingInfo) qui permet aux apps de vous cibler avec des publicités personnalisées.",
    category: "premium",
    registryCommands: [
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo" /v "Enabled" /t REG_DWORD /d 0 /f',
    ],
    commands: [],
  },
  // ── QOL — Qualité de vie ──────────────────────────────────────────────────────
  {
    id: "qol-control-panel-shortcut",
    name: "Raccourci Panneau de Configuration (Bureau)",
    description: "Crée un raccourci vers le Panneau de configuration classique sur le Bureau — accès rapide sans passer par l'application Paramètres Windows 10/11.",
    category: "premium",
    powershellCommands: [
      '$shell = New-Object -ComObject WScript.Shell; $shortcut = $shell.CreateShortcut([Environment]::GetFolderPath("Desktop") + "\\Panneau de configuration.lnk"); $shortcut.TargetPath = "control.exe"; $shortcut.IconLocation = "control.exe,0"; $shortcut.Save()',
    ],
    commands: [],
  },
  {
    id: "qol-classic-altf4",
    name: "Menu Alt+F4 Arrêt Classique",
    description: "S'assure que la boîte de dialogue d'arrêt classique (Alt+F4 sur le Bureau) est disponible avec toutes ses options — Arrêter, Redémarrer, Veille, Déconnexion.",
    category: "premium",
    registryCommands: [
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer" /v "NoClose" /t REG_DWORD /d 0 /f',
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer" /v "NoLogoff" /t REG_DWORD /d 0 /f',
    ],
    commands: [],
  },
  {
    id: "qol-classic-tray-icons",
    name: "Icônes Batterie/Réseau Toujours Visibles",
    description: "Force l'affichage permanent des icônes système dans la barre des tâches (batterie, réseau, volume, santé) sans les cacher dans le menu de débordement.",
    category: "premium",
    registryCommands: [
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer" /v "HideSCABattery" /t REG_DWORD /d 0 /f',
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer" /v "HideSCANetwork" /t REG_DWORD /d 0 /f',
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer" /v "HideSCAVolume" /t REG_DWORD /d 0 /f',
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer" /v "HideSCAHealth" /t REG_DWORD /d 0 /f',
    ],
    commands: [],
  },
  {
    id: "qol-classic-rightclick",
    name: "Menu Contextuel Classique (Win11 uniquement)",
    description: "Restaure le menu clic-droit classique de Windows 10 sur Windows 11 — affiche directement toutes les options sans passer par 'Afficher plus d'options'.",
    category: "premium",
    warning: "Windows 11 uniquement. Modifie le comportement du Shell Explorer. Un redémarrage ou un taskkill /f /im explorer.exe peut être nécessaire pour appliquer le changement.",
    win11Only: true,
    registryCommands: [
      'reg add "HKCU\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\\InprocServer32" /ve /t REG_SZ /d "" /f',
    ],
    commands: [],
  },
  {
    id: "qol-disable-suggested-apps",
    name: "Désactiver Apps Suggérées et Promo",
    description: "Désactive l'installation silencieuse automatique d'apps suggérées/sponsorisées et les suggestions d'apps dans le menu Démarrer.",
    category: "premium",
    registryCommands: [
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager" /v "SilentInstalledAppsEnabled" /t REG_DWORD /d 0 /f',
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager" /v "EnableThirdPartySuggestions" /t REG_DWORD /d 0 /f',
    ],
    commands: [],
  },
  {
    id: "qol-disable-snap-layouts",
    name: "Désactiver Snap Layouts au Survol",
    description: "Désactive l'aperçu des Snap Layouts qui apparaît au survol du bouton Agrandir — évite les popups intempestifs lors des alt-tab en jeu.",
    category: "premium",
    registryCommands: [
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v "EnableSnapAssistFlyout" /t REG_DWORD /d 0 /f',
    ],
    commands: [],
  },
  {
    id: "qol-disable-start-suggestions",
    name: "Désactiver Suggestions Menu Démarrer",
    description: "Supprime les apps et contenus suggérés dans le Menu Démarrer (SystemPaneSuggestionsEnabled=0) — affiche uniquement vos apps épinglées et installées.",
    category: "premium",
    registryCommands: [
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager" /v "SystemPaneSuggestionsEnabled" /t REG_DWORD /d 0 /f',
    ],
    commands: [],
  },
  {
    id: "qol-disable-taskbar-chat",
    name: "Supprimer Icône Teams Chat (Win11 uniquement)",
    description: "Supprime l'icône Microsoft Teams Chat de la barre des tâches Windows 11 (TaskbarMn=0) — libère de l'espace et évite les popups Teams inopinés.",
    category: "premium",
    win11Only: true,
    registryCommands: [
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v "TaskbarMn" /t REG_DWORD /d 0 /f',
    ],
    commands: [],
  },
  {
    id: "qol-disable-taskbar-transparency",
    name: "Désactiver Transparence Barre des Tâches",
    description: "Désactive l'effet de transparence de la barre des tâches Windows (EnableTransparency=0) — réduit légèrement la charge GPU de composition de l'interface.",
    category: "premium",
    registryCommands: [
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize" /v "EnableTransparency" /t REG_DWORD /d 0 /f',
    ],
    commands: [],
  },
  {
    id: "qol-disable-widgets",
    name: "Supprimer Widgets Windows (Win11 uniquement)",
    description: "Supprime le bouton Widgets de la barre des tâches Windows 11 (TaskbarDa=0) et désactive le service Widgets qui se connecte aux actualités/météo en arrière-plan.",
    category: "premium",
    warning: "Windows 11 uniquement. Sur certaines versions, la suppression des Widgets peut nécessiter un redémarrage de l'explorateur pour prendre effet.",
    win11Only: true,
    registryCommands: [
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v "TaskbarDa" /t REG_DWORD /d 0 /f',
    ],
    commands: [],
  },
  {
    id: "qol-disable-windows-tips",
    name: "Désactiver Conseils et Astuces Windows",
    description: "Désactive les notifications de conseils, astuces et suggestions Windows (SoftLandingEnabled=0) — supprime les popups de tutoriels d'interface.",
    category: "premium",
    registryCommands: [
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager" /v "SoftLandingEnabled" /t REG_DWORD /d 0 /f',
    ],
    commands: [],
  },
  {
    id: "qol-full-wallpaper-quality",
    name: "Fond d'Écran en Qualité Maximale",
    description: "Force Windows à afficher le fond d'écran en qualité JPEG maximale (JPEGImportQuality=100) au lieu de recompresser l'image lors de l'importation.",
    category: "premium",
    registryCommands: [
      'reg add "HKCU\\Control Panel\\Desktop" /v "JPEGImportQuality" /t REG_DWORD /d 100 /f',
    ],
    commands: [],
  },
  {
    id: "qol-numlock-startup",
    name: "Activer Verr. Num au Démarrage",
    description: "Active automatiquement la touche Verrou numérique (Num Lock) à chaque démarrage de Windows — évite de devoir l'activer manuellement à chaque session.",
    category: "premium",
    registryCommands: [
      'reg add "HKCU\\Control Panel\\Keyboard" /v "InitialKeyboardIndicators" /t REG_SZ /d "2" /f',
    ],
    commands: [],
  },
  {
    id: "qol-remove-suggested-actions",
    name: "Désactiver Actions Suggérées (Clipboard)",
    description: "Désactive les suggestions contextuelles automatiques de Windows (numéros de téléphone, dates copiées) qui proposent d'ouvrir des apps après une copie dans le presse-papiers.",
    category: "premium",
    registryCommands: [
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\SmartActionPlatform\\SmartClipboard" /v "Disabled" /t REG_DWORD /d 1 /f',
    ],
    commands: [],
  },
  {
    id: "qol-show-file-extensions",
    name: "Afficher Extensions de Fichiers",
    description: "Affiche les extensions de fichiers dans l'Explorateur (HideFileExt=0) — indispensable pour distinguer les vrais fichiers des fichiers malveillants renommés.",
    category: "premium",
    registryCommands: [
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v "HideFileExt" /t REG_DWORD /d 0 /f',
    ],
    commands: [],
  },
  {
    id: "qol-show-hidden-files",
    name: "Afficher Fichiers et Dossiers Cachés",
    description: "Affiche les fichiers et dossiers cachés dans l'Explorateur Windows (Hidden=1) — permet de voir les fichiers système et de configuration habituellement masqués.",
    category: "premium",
    registryCommands: [
      'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v "Hidden" /t REG_DWORD /d 1 /f',
    ],
    commands: [],
  },
  // ── GAMING FPS — Nouveaux tweaks haute priorité ────────────────────────────────
  {
    id: "spectre-meltdown-off",
    name: "Désactiver Mitigations Spectre/Meltdown",
    description: "Désactive les mitigations Spectre v2 et Meltdown (FeatureSettingsOverride=3) — gain CPU de 5 à 15% sur Intel 10ème gen (i5-10300H), surtout sur jeux CPU-bound comme Fortnite.",
    category: "premium",
    warning: "RISQUE SÉCURITÉ — Réduit la protection contre les exploits bas niveau CPU. Acceptable sur un PC gaming dédié non utilisé pour des tâches sensibles (banque, entreprise). Ne jamais activer sur un PC professionnel ou partagé.",
    registryCommands: [
      'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management" /v "FeatureSettingsOverride" /t REG_DWORD /d 3 /f',
      'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management" /v "FeatureSettingsOverrideMask" /t REG_DWORD /d 3 /f',
    ],
    commands: [],
  },
  {
    id: "disable-wsearch",
    name: "Désactiver Windows Search (WSearch)",
    description: "Désactive le service d'indexation Windows Search (WSearch) qui scanne en permanence le disque en arrière-plan — libère I/O et CPU, réduit les stutters au démarrage de Fortnite.",
    category: "premium",
    warning: "La barre de recherche Windows Démarrer ne retournera plus les fichiers locaux instantanément. Réactivez si vous utilisez fréquemment la recherche de fichiers.",
    serviceCommands: [
      "sc stop WSearch",
      "sc config WSearch start=disabled",
    ],
    commands: [],
  },
  {
    id: "fortnite-process-priority",
    name: "Priorité Processus Auto Fortnite (IFEO)",
    description: "Configure Image File Execution Options pour que FortniteClient-Win64-Shipping.exe démarre automatiquement en priorité élevée sans action manuelle — réduit les freezes liés au scheduler Windows.",
    category: "premium",
    registryCommands: [
      'reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\FortniteClient-Win64-Shipping.exe\\PerfOptions" /v "CpuPriorityClass" /t REG_DWORD /d 3 /f',
      'reg add "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\FortniteClient-Win64-Shipping.exe\\PerfOptions" /v "IoPriority" /t REG_DWORD /d 3 /f',
    ],
    commands: [],
  },
  {
    id: "defender-fortnite-exclusion",
    name: "Exclusion Defender — Fortnite + EAC",
    description: "Ajoute FortniteClient-Win64-Shipping.exe et EasyAntiCheat aux exclusions Windows Defender — supprime le scan antivirus en temps réel sur ces exécutables, réduit les stutters CPU en jeu sans désactiver la protection globale.",
    category: "premium",
    powershellCommands: [
      "Add-MpPreference -ExclusionProcess 'FortniteClient-Win64-Shipping.exe' -ErrorAction SilentlyContinue",
      "Add-MpPreference -ExclusionProcess 'EasyAntiCheat.exe' -ErrorAction SilentlyContinue",
      "Add-MpPreference -ExclusionProcess 'EasyAntiCheat_launcher.exe' -ErrorAction SilentlyContinue",
      "$fn = (Get-ChildItem 'C:\\Users' -Recurse -Filter 'FortniteClient-Win64-Shipping.exe' -ErrorAction SilentlyContinue | Select-Object -First 1).DirectoryName; if ($fn) { Add-MpPreference -ExclusionPath $fn -ErrorAction SilentlyContinue }",
    ],
    commands: [],
  },
  {
    id: "disable-nvidia-container",
    name: "Désactiver Services Fond NVIDIA (Container)",
    description: "Désactive NvContainerLocalSystem et NvContainerNetworkService — services NVIDIA qui tournent en permanence pour GeForce Experience, télémétrie et overlay. Libère 50-100 MB RAM et réduit la charge CPU en fond.",
    category: "premium",
    warning: "Désactive GeForce Experience (overlay, ShadowPlay, optimisation de jeux). Le pilote GPU reste pleinement fonctionnel — seule l'interface GFE est inaccessible.",
    serviceCommands: [
      "sc stop NVDisplay.ContainerLocalSystem",
      "sc config NVDisplay.ContainerLocalSystem start=demand",
      "sc stop NvContainerNetworkService",
      "sc config NvContainerNetworkService start=demand",
      "sc stop NvTelemetryContainer",
      "sc config NvTelemetryContainer start=disabled",
    ],
    commands: [],
  },
  {
    id: "windows-game-mode-on",
    name: "Activer Game Mode Windows",
    description: "Active le Game Mode Windows natif (AutoGameModeEnabled=1) — Windows déprioritise les tâches en arrière-plan (mises à jour, indexation) automatiquement dès qu'un jeu plein écran est détecté.",
    category: "premium",
    registryCommands: [
      'reg add "HKCU\\Software\\Microsoft\\GameBar" /v "AutoGameModeEnabled" /t REG_DWORD /d 1 /f',
      'reg add "HKCU\\Software\\Microsoft\\GameBar" /v "AllowAutoGameMode" /t REG_DWORD /d 1 /f',
      'reg add "HKCU\\Software\\Microsoft\\GameBar" /v "UseNexusForGameBarEnabled" /t REG_DWORD /d 0 /f',
    ],
    commands: [],
  },
  {
    id: "irq-gpu-priority",
    name: "Priorité IRQ GPU (Boost Interruptions)",
    description: "Configure le GPU pour que ses interruptions matérielles soient traitées en priorité absolue (MessageSignaledInterruptProperties) — réduit la latence de rendu d'1 à 3ms sur cartes NVIDIA.",
    category: "premium",
    powershellCommands: [
      '$gpu = Get-PnpDevice | Where-Object { $_.Class -eq "Display" -and $_.Status -eq "OK" } | Select-Object -First 1; if ($gpu) { $path = "HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\" + $gpu.InstanceId + "\\Device Parameters\\Interrupt Management\\MessageSignaledInterruptProperties"; if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }; Set-ItemProperty -Path $path -Name "MSISupported" -Value 1 -Type DWord -ErrorAction SilentlyContinue }',
    ],
    commands: [],
  },
];

export function generateBatScript(tweaks: Tweak[]): string {
  const lines: string[] = [
    "@echo off",
    "echo ============================================",
    "echo   KERMOUK OPTIMIZER v2.5.0 - Application Tweaks",
    "echo ============================================",
    "echo.",
    "",
  ];

  for (const tweak of tweaks) {
    lines.push(`echo [*] Tweak: ${tweak.id}`);

    if (tweak.commands?.length) {
      for (const cmd of tweak.commands) {
        lines.push(cmd);
      }
    }

    if (tweak.registryCommands?.length) {
      for (const cmd of tweak.registryCommands) {
        lines.push(cmd);
      }
    }

    if (tweak.serviceCommands?.length) {
      for (const cmd of tweak.serviceCommands) {
        lines.push(cmd);
      }
    }

    if (tweak.powershellCommands?.length) {
      for (const cmd of tweak.powershellCommands) {
        lines.push(`powershell -Command "${cmd}"`);
      }
    }

    lines.push("");
  }

  lines.push(
    "echo.",
    "echo ============================================",
    `echo   ${tweaks.length} tweak(s) applique(s) avec succes !`,
    "echo   Redemarrez Windows pour appliquer tous les changements.",
    "echo ============================================",
    "echo."
  );

  return lines.join("\r\n");
}

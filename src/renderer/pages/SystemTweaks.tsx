import TweakSection from "../components/TweakSection";
import { FREE_TWEAKS, PREMIUM_TWEAKS } from "../utils/tweakEngine";

const SYSTEM_TWEAKS = [
  ...FREE_TWEAKS,
  PREMIUM_TWEAKS.find((t) => t.id === "cpu-priority")!,
  PREMIUM_TWEAKS.find((t) => t.id === "win32-priority-separation")!,
  PREMIUM_TWEAKS.find((t) => t.id === "disable-power-throttling")!,
  PREMIUM_TWEAKS.find((t) => t.id === "bcdedit-dynamictick")!,
  PREMIUM_TWEAKS.find((t) => t.id === "mmcss-latency-sensitive")!,
  PREMIUM_TWEAKS.find((t) => t.id === "core-parking-disable")!,
  PREMIUM_TWEAKS.find((t) => t.id === "keyboard-mouse-queue")!,
  PREMIUM_TWEAKS.find((t) => t.id === "usb-power-save-disable")!,
  PREMIUM_TWEAKS.find((t) => t.id === "energy-estimation-disable")!,
  PREMIUM_TWEAKS.find((t) => t.id === "svhost-split-32gb")!,
  PREMIUM_TWEAKS.find((t) => t.id === "disable-tracking")!,
  PREMIUM_TWEAKS.find((t) => t.id === "disable-xbox-services")!,
  PREMIUM_TWEAKS.find((t) => t.id === "disable-other-services")!,
  PREMIUM_TWEAKS.find((t) => t.id === "memory-usage")!,
  PREMIUM_TWEAKS.find((t) => t.id === "mft-zone")!,
  PREMIUM_TWEAKS.find((t) => t.id === "disable-memory-compression")!,
].filter(Boolean);

interface Props {
  isPremium: boolean;
  openLicenseModal: () => void;
}

export default function SystemTweaks({ isPremium, openLicenseModal }: Props) {
  return (
    <TweakSection
      title="TWEAKS SYSTÈME"
      subtitle="Optimisation Windows, timer, Hyper-V, SSD, Defender et MMCSS — 10 tweaks FREE inclus"
      tweaks={SYSTEM_TWEAKS}
      isPremium={isPremium}
      openLicenseModal={openLicenseModal}
    />
  );
}

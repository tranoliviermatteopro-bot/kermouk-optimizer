import pkg from "../package.json";

export interface GithubRelease {
  version: string;
  tag: string;
  downloadUrl: string;
  publishedAt: string;
}

const OWNER = "agencyweb-pro";
const REPO = `${OWNER}/kermouk-optimizer`;

const FALLBACK: GithubRelease = {
  version: pkg.version,
  tag: `v${pkg.version}`,
  downloadUrl:
    `https://github.com/${REPO}/releases/download/v${pkg.version}/KERMOUK.OPTIMIZER.Setup.${pkg.version}.exe`,
  publishedAt: new Date().toISOString(),
};

export async function getLatestRelease(): Promise<GithubRelease> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/releases/latest`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return FALLBACK;

    const data = await res.json();
    const version = (data.tag_name as string).replace("v", "");
    const asset = (
      data.assets as Array<{ name: string; browser_download_url: string }>
    )?.find((a) => a.name.endsWith(".exe") && !a.name.includes("blockmap"));

    return {
      version,
      tag: data.tag_name as string,
      downloadUrl: asset?.browser_download_url ?? FALLBACK.downloadUrl,
      publishedAt: data.published_at as string,
    };
  } catch {
    return FALLBACK;
  }
}

/**
 * Build asset URLs that go through our cache proxy.
 */

export function championIconUrl(championId: number): string {
  return `/api/assets/champion-icon/${championId}.png`;
}

export function championSplashUrl(championName: string): string {
  return `/api/assets/champion/${encodeURIComponent(championName)}.png`;
}

export function profileIconUrl(iconId: number | null | undefined): string | null {
  if (!iconId) return null;
  return `/api/assets/profile-icon/${iconId}.png`;
}

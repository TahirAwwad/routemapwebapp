const FORGE_KEY = (import.meta.env.VITE_FRONTEND_FORGE_API_KEY as string | undefined)?.trim();
const GOOGLE_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim();

export const MAPS_FORGE_KEY = FORGE_KEY;
export const MAPS_GOOGLE_KEY = GOOGLE_KEY;

export function hasGoogleMapsKey(): boolean {
  return Boolean(FORGE_KEY || GOOGLE_KEY);
}

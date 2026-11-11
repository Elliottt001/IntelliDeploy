export type Theme = 'light' | 'dark';
export const THEME_STORAGE_KEY = 'intellideploy:theme';

export function readStoredTheme(value: string | null): Theme | null {
  return value === 'light' || value === 'dark' ? value : null;
}

export function resolveTheme(stored: Theme | null, prefersDark: boolean): Theme {
  return stored ?? (prefersDark ? 'dark' : 'light');
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

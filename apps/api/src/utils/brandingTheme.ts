export type OrganisationTheme = {
  mode: 'light' | 'dark' | 'system';
  primary_colour: string;
  secondary_colour: string;
  accent_colour: string;
  background_colour: string;
  surface_colour: string;
  text_colour: string;
  muted_text_colour: string;
  border_colour: string;
  success_colour: string;
  warning_colour: string;
  danger_colour: string;
  info_colour: string;
  border_radius: string;
  font_family: string;
};

export type ThemeYamlPatch = {
  theme: Partial<OrganisationTheme>;
  assets: Record<string, string | null>;
};

export const defaultTheme: OrganisationTheme = {
  mode: 'light',
  primary_colour: '#2563eb',
  secondary_colour: '#111827',
  accent_colour: '#10b981',
  background_colour: '#f8fafc',
  surface_colour: '#ffffff',
  text_colour: '#111827',
  muted_text_colour: '#6b7280',
  border_colour: '#e5e7eb',
  success_colour: '#16a34a',
  warning_colour: '#f59e0b',
  danger_colour: '#dc2626',
  info_colour: '#0284c7',
  border_radius: '12px',
  font_family: 'Inter, system-ui, sans-serif'
};

export const themeColourFields: Array<keyof OrganisationTheme> = [
  'primary_colour',
  'secondary_colour',
  'accent_colour',
  'background_colour',
  'surface_colour',
  'text_colour',
  'muted_text_colour',
  'border_colour',
  'success_colour',
  'warning_colour',
  'danger_colour',
  'info_colour'
];

export function normaliseTheme(theme?: Partial<OrganisationTheme> | null): OrganisationTheme {
  return {
    ...defaultTheme,
    ...(theme ?? {})
  };
}

function quote(value: string | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return 'null';
  }

  return JSON.stringify(value);
}

export function themeToYaml(input: {
  theme?: Partial<OrganisationTheme> | null;
  branding?: Record<string, unknown> | null;
}) {
  const theme = normaliseTheme(input.theme);
  const branding = input.branding ?? {};

  return [
    'organisation_theme:',
    `  mode: ${theme.mode}`,
    '  colours:',
    `    primary: ${quote(theme.primary_colour)}`,
    `    secondary: ${quote(theme.secondary_colour)}`,
    `    accent: ${quote(theme.accent_colour)}`,
    `    background: ${quote(theme.background_colour)}`,
    `    surface: ${quote(theme.surface_colour)}`,
    `    text: ${quote(theme.text_colour)}`,
    `    muted_text: ${quote(theme.muted_text_colour)}`,
    `    border: ${quote(theme.border_colour)}`,
    `    success: ${quote(theme.success_colour)}`,
    `    warning: ${quote(theme.warning_colour)}`,
    `    danger: ${quote(theme.danger_colour)}`,
    `    info: ${quote(theme.info_colour)}`,
    '  layout:',
    `    border_radius: ${quote(theme.border_radius)}`,
    `    font_family: ${quote(theme.font_family)}`,
    '  assets:',
    `    logo_url: ${quote(branding.logo_url as string | null | undefined)}`,
    `    favicon_url: ${quote(branding.favicon_url as string | null | undefined)}`,
    `    login_background_url: ${quote(branding.login_background_url as string | null | undefined)}`,
    `    sidebar_logo_url: ${quote(branding.sidebar_logo_url as string | null | undefined)}`,
    `    email_logo_url: ${quote(branding.email_logo_url as string | null | undefined)}`,
    ''
  ].join('\n');
}

function parseYamlScalar(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'null' || trimmed === '~') {
    return null;
  }

  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

const colourKeyMap: Record<string, keyof OrganisationTheme> = {
  primary: 'primary_colour',
  secondary: 'secondary_colour',
  accent: 'accent_colour',
  background: 'background_colour',
  surface: 'surface_colour',
  text: 'text_colour',
  muted_text: 'muted_text_colour',
  border: 'border_colour',
  success: 'success_colour',
  warning: 'warning_colour',
  danger: 'danger_colour',
  info: 'info_colour'
};

const layoutKeyMap: Record<string, keyof OrganisationTheme> = {
  border_radius: 'border_radius',
  font_family: 'font_family'
};

const allowedAssetKeys = new Set(['logo_url', 'favicon_url', 'login_background_url', 'sidebar_logo_url', 'email_logo_url']);

export function parseThemeYaml(yamlText: string): ThemeYamlPatch {
  const patch: ThemeYamlPatch = { theme: {}, assets: {} };
  let section: 'root' | 'colours' | 'layout' | 'assets' = 'root';

  for (const rawLine of yamlText.split(/\r?\n/)) {
    const withoutComment = rawLine.replace(/\s+#.*$/, '');
    if (!withoutComment.trim()) {
      continue;
    }

    const indent = withoutComment.match(/^\s*/)?.[0].length ?? 0;
    const line = withoutComment.trim();
    const match = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (!match) {
      throw new Error(`Invalid YAML line: ${line}`);
    }

    const key = match[1];
    const value = match[2];

    if (indent === 0) {
      if (key !== 'organisation_theme') {
        throw new Error('Root YAML key must be organisation_theme.');
      }
      section = 'root';
      continue;
    }

    if (indent === 2 && value === '') {
      if (!['colours', 'layout', 'assets'].includes(key)) {
        throw new Error(`Unsupported organisation_theme section: ${key}`);
      }
      section = key as 'colours' | 'layout' | 'assets';
      continue;
    }

    if (indent === 2 && key === 'mode') {
      const parsed = parseYamlScalar(value);
      if (!parsed || !['light', 'dark', 'system'].includes(parsed)) {
        throw new Error('Theme mode must be light, dark or system.');
      }
      patch.theme.mode = parsed as OrganisationTheme['mode'];
      continue;
    }

    if (indent === 4 && section === 'colours') {
      const mapped = colourKeyMap[key];
      if (!mapped) {
        throw new Error(`Unsupported colour key: ${key}`);
      }
      const parsed = parseYamlScalar(value);
      if (parsed !== null) {
        (patch.theme as Record<string, string>)[mapped] = parsed;
      }
      continue;
    }

    if (indent === 4 && section === 'layout') {
      const mapped = layoutKeyMap[key];
      if (!mapped) {
        throw new Error(`Unsupported layout key: ${key}`);
      }
      const parsed = parseYamlScalar(value);
      if (parsed !== null) {
        (patch.theme as Record<string, string>)[mapped] = parsed;
      }
      continue;
    }

    if (indent === 4 && section === 'assets') {
      if (!allowedAssetKeys.has(key)) {
        throw new Error(`Unsupported asset key: ${key}`);
      }
      patch.assets[key] = parseYamlScalar(value);
      continue;
    }

    throw new Error(`Unsupported YAML structure near: ${line}`);
  }

  return patch;
}

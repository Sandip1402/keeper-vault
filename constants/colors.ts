/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    text: '#182033',
    tint: '#316DFA',
    background: '#F5F7FB',
    foreground: '#182033',
    card: '#FFFFFF',
    cardForeground: '#182033',
    primary: '#316DFA',
    primaryForeground: '#FFFFFF',
    secondary: '#EAF0FC',
    secondaryForeground: '#33517F',
    muted: '#EEF1F7',
    mutedForeground: '#78839A',
    accent: '#E6EDFF',
    accentForeground: '#2858CE',
    destructive: '#D94F62',
    destructiveForeground: '#FFFFFF',
    border: '#E4E9F2',
    input: '#E5EAF3',
    surface: '#FFFFFF',
    surfaceAlt: '#F0F3F9',
    success: '#28A781',
    shadow: '#172440',
  },

  dark: {
    text: '#F3F6FF',
    tint: '#6E94FF',
    background: '#0C101A',
    foreground: '#F3F6FF',
    card: '#141A28',
    cardForeground: '#F3F6FF',
    primary: '#6E94FF',
    primaryForeground: '#0B1120',
    secondary: '#1B2435',
    secondaryForeground: '#C0CCEA',
    muted: '#1A2130',
    mutedForeground: '#8B96AD',
    accent: '#202E4A',
    accentForeground: '#A8BDFF',
    destructive: '#F07982',
    destructiveForeground: '#241014',
    border: '#273044',
    input: '#20293A',
    surface: '#141A28',
    surfaceAlt: '#192131',
    success: '#50CBA2',
    shadow: '#000000',
  },

  radius: 18,
};

export default colors;

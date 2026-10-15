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
    // Legacy aliases (kept for backward compatibility)
    text: '#F4EEE7',
    tint: '#E76F4B',

    // Core surfaces
    background: '#111116',
    foreground: '#F4EEE7',

    // Cards / elevated surfaces
    card: '#1C1B22',
    cardForeground: '#F4EEE7',

    // Primary action color (buttons, links, active states)
    primary: '#E76F4B',
    primaryForeground: '#171418',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#292731',
    secondaryForeground: '#F4EEE7',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#24232B',
    mutedForeground: '#AAA4AE',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#33252A',
    accentForeground: '#F4EEE7',

    // Destructive actions (delete, error states)
    destructive: '#E86B70',
    destructiveForeground: '#FFFFFF',

    // Borders and input outlines
    border: '#37343D',
    input: '#37343D',
  },
  dark: {
    text: '#F4EEE7',
    tint: '#E76F4B',
    background: '#111116',
    foreground: '#F4EEE7',
    card: '#1C1B22',
    cardForeground: '#F4EEE7',
    primary: '#E76F4B',
    primaryForeground: '#171418',
    secondary: '#292731',
    secondaryForeground: '#F4EEE7',
    muted: '#24232B',
    mutedForeground: '#AAA4AE',
    accent: '#33252A',
    accentForeground: '#F4EEE7',
    destructive: '#E86B70',
    destructiveForeground: '#FFFFFF',
    border: '#37343D',
    input: '#37343D',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 18,
};

export default colors;

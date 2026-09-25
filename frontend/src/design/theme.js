function cssToken(name, fallback) {
  if (typeof document === 'undefined' || typeof getComputedStyle === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

function pxToken(name, fallback) {
  return Number.parseFloat(cssToken(name, `${fallback}px`)) || fallback
}

// Resolve CSS semantic tokens for Ant Design's color algorithms at runtime.
export const designTokens = {
  brandPrimary: cssToken('--color-brand-primary', '#155eef'),
  brandHover: cssToken('--color-brand-hover', '#004eeb'),
  page: cssToken('--color-bg-page', '#f7f8fa'),
  surface: cssToken('--color-bg-surface', '#ffffff'),
  subtle: cssToken('--color-bg-subtle', '#f2f4f7'),
  textPrimary: cssToken('--color-text-primary', '#182230'),
  textSecondary: cssToken('--color-text-secondary', '#475467'),
  border: cssToken('--color-border-default', '#e4e7ec'),
  radius: pxToken('--radius-sm', 6),
  controlHeight: pxToken('--size-control-default', 36),
  space1: pxToken('--space-1', 4),
  space2: pxToken('--space-2', 8),
  space3: pxToken('--space-3', 12),
  space4: pxToken('--space-4', 16),
  space5: pxToken('--space-5', 24),
  space6: pxToken('--space-6', 32),
  fontFamily: cssToken('--font-sans', 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif'),
}

export const appTheme = {
  token: {
    colorPrimary: designTokens.brandPrimary,
    colorBgLayout: designTokens.page,
    colorBgContainer: designTokens.surface,
    colorText: designTokens.textPrimary,
    colorTextSecondary: designTokens.textSecondary,
    colorBorder: designTokens.border,
    borderRadius: designTokens.radius,
    controlHeight: designTokens.controlHeight,
    paddingXXS: designTokens.space1,
    paddingXS: designTokens.space2,
    paddingSM: designTokens.space3,
    padding: designTokens.space4,
    paddingLG: designTokens.space5,
    paddingXL: designTokens.space6,
    fontFamily: designTokens.fontFamily,
  },
  components: {
    Button: { borderRadius: designTokens.radius, controlHeight: designTokens.controlHeight },
    Breadcrumb: { fontSize: 12 },
    Table: { headerBg: designTokens.subtle, headerColor: designTokens.textSecondary },
  },
}

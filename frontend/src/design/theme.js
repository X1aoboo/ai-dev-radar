function cssToken(name, fallback) {
  if (typeof document === 'undefined' || typeof getComputedStyle === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
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
  radius: Number.parseFloat(cssToken('--radius-sm', '6px')),
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
    controlHeight: 32,
    paddingXXS: 4,
    paddingXS: 8,
    paddingSM: 12,
    padding: 16,
    paddingLG: 24,
    paddingXL: 32,
    fontFamily: designTokens.fontFamily,
  },
  components: {
    Button: { borderRadius: designTokens.radius, controlHeight: 32 },
    Breadcrumb: { fontSize: 12 },
    Table: { headerBg: designTokens.subtle, headerColor: designTokens.textSecondary },
  },
}

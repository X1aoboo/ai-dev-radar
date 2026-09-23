// This is the Ant Design adapter for tokens.css. Keep values in sync with its named semantic tokens.
export const designTokens = {
  brandPrimary: '#155eef',
  brandHover: '#004eeb',
  page: '#f7f8fa',
  surface: '#ffffff',
  textPrimary: '#182230',
  textSecondary: '#475467',
  border: '#e4e7ec',
  radius: 6,
  fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif',
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
    Table: { headerBg: '#f9fafb', headerColor: designTokens.textSecondary },
  },
}

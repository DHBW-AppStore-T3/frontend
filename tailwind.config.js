import typography from '@tailwindcss/typography'

export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,ts,tsx,js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        // Brand roles: values come from the active theme (src/theme/)
        primary: "rgb(var(--color-primary) / <alpha-value>)",
        primaryDark: "rgb(var(--color-primary-dark) / <alpha-value>)",
        primaryLight: "rgb(var(--color-primary-light) / <alpha-value>)",
        primaryDeep: "rgb(var(--color-primary-deep) / <alpha-value>)",
        primaryDarkest: "rgb(var(--color-primary-darkest) / <alpha-value>)",
        primarySoft: "rgb(var(--color-primary-soft) / <alpha-value>)",
        primaryFaint: "rgb(var(--color-primary-faint) / <alpha-value>)",
        primaryAction: "rgb(var(--color-primary-action) / <alpha-value>)",
        primaryActionHover: "rgb(var(--color-primary-action-hover) / <alpha-value>)",
        brandAccent: "rgb(var(--color-brand-accent) / <alpha-value>)",
        brandIndicator: "rgb(var(--color-brand-indicator) / <alpha-value>)",
        brandAccentSoft: "rgb(var(--color-brand-accent-soft) / <alpha-value>)",
        bgSoft: "rgb(var(--color-bg-soft) / <alpha-value>)",
        surfaceTint: "rgb(var(--color-surface-tint) / <alpha-value>)",
        surfacePage: "rgb(var(--color-surface-page) / <alpha-value>)",
        surfaceDark: "rgb(var(--color-surface-dark) / <alpha-value>)",

        // Theme-independent
        destructive: "rgb(var(--color-destructive) / <alpha-value>)",
        destructiveSoft: "rgb(var(--color-destructive-soft) / <alpha-value>)",
        surfaceMuted: "rgb(var(--color-surface-muted) / <alpha-value>)",
        borderSubtle: "rgb(var(--color-border-subtle) / <alpha-value>)",
        onDark: "rgb(var(--color-on-dark) / <alpha-value>)",
        success: "rgb(var(--color-success) / <alpha-value>)",
        danger: "rgb(var(--color-danger) / <alpha-value>)",
        warning: "rgb(var(--color-warning) / <alpha-value>)",
        info: "rgb(var(--color-info) / <alpha-value>)",
        statusGreen: "rgb(var(--color-status-green) / <alpha-value>)",
        statusYellow: "rgb(var(--color-status-yellow) / <alpha-value>)",
        statusOrange: "rgb(var(--color-status-orange) / <alpha-value>)",
        statusSlate: "rgb(var(--color-status-slate) / <alpha-value>)",
        textStrong: "rgb(var(--color-text-strong) / <alpha-value>)",
        textHeading: "rgb(var(--color-text-heading) / <alpha-value>)",
        textMuted: "rgb(var(--color-text-muted) / <alpha-value>)",
        textFaint: "rgb(var(--color-text-faint) / <alpha-value>)",
      },
    },
  },
  plugins: [typography],
}

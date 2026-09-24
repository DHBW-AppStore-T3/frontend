import typography from '@tailwindcss/typography'

export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,ts,tsx,js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: "rgb(var(--color-primary) / <alpha-value>)",        // Hauptgrün
        primaryDark: "rgb(var(--color-primary-dark) / <alpha-value>)",
        primaryLight: "rgb(var(--color-primary-light) / <alpha-value>)",
        lightGreen: "rgb(var(--color-light-green) / <alpha-value>)",
        ultraLightGreen: "rgb(var(--color-ultra-light-green) / <alpha-value>)" ,

        accentYellow: "rgb(var(--color-accent-yellow) / <alpha-value>)",   // Gelb aus Logo
        lightYellow: "rgb(var(--color-light-yellow) / <alpha-value>)",

        accentRed: "rgb(var(--color-accent-red) / <alpha-value>)",      // Rot aus Logo
        lightRed: "rgb(var(--color-light-red) / <alpha-value>)",

        bgSoft: "rgb(var(--color-bg-soft) / <alpha-value>)",

        primaryDeep: "rgb(var(--color-primary-deep) / <alpha-value>)",
        primaryDarkest: "rgb(var(--color-primary-darkest) / <alpha-value>)",
        buttonGreen: "rgb(var(--color-button-green) / <alpha-value>)",
        buttonGreenHover: "rgb(var(--color-button-green-hover) / <alpha-value>)",
        surfaceTint: "rgb(var(--color-surface-tint) / <alpha-value>)",
        surfaceMuted: "rgb(var(--color-surface-muted) / <alpha-value>)",
        surfacePage: "rgb(var(--color-surface-page) / <alpha-value>)",
        surfaceDark: "rgb(var(--color-surface-dark) / <alpha-value>)",
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

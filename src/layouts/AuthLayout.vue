<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useTheme } from '@/theme/useTheme'

const { brand, authLogo, logo } = useTheme()
const { locale, t } = useI18n()

function changeLocale(lang: string) {
  locale.value = lang
  try {
    localStorage.setItem('locale', lang)
  } catch {
    // Storage is blocked when embedded in a third-party iframe (Moodle LTI);
    // the locale still switches for this session, it just isn't persisted.
  }
}
</script>

<template>
  <div class="min-h-screen flex bg-surfacePage">
    <!-- Login panel: full-width on mobile/tablet (the only view there), ~43-44% on desktop -->
    <div class="w-full md:w-[43%] lg:w-[44%] flex flex-col min-w-0">
      <header class="flex items-start justify-between gap-4 px-6 py-6 md:px-12 md:py-10">
        <div>
          <img v-if="authLogo" :src="authLogo.src" :alt="authLogo.alt" :style="{ height: `${authLogo.height}px` }" class="block" />
          <span v-else class="text-headline-3 text-primary font-bold">{{ brand.name }}</span>
          <p class="mt-1 text-caption text-textMuted">{{ brand.tagline }}</p>
        </div>

        <div class="flex flex-shrink-0 rounded-md overflow-hidden border border-borderSubtle text-caption">
          <button
            type="button"
            data-testid="locale-de"
            @click="changeLocale('de')"
            :class="locale === 'de' ? 'bg-primarySoft text-primary' : 'text-textMuted hover:bg-surfaceMuted'"
            class="px-2.5 py-1 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
          >DE</button>
          <button
            type="button"
            data-testid="locale-en"
            @click="changeLocale('en')"
            :class="locale === 'en' ? 'bg-primarySoft text-primary' : 'text-textMuted hover:bg-surfaceMuted'"
            class="px-2.5 py-1 transition-colors border-l border-borderSubtle focus:outline-none focus:ring-2 focus:ring-primary/50"
          >EN</button>
        </div>
      </header>

      <main class="flex-1 flex items-center justify-center px-6 md:px-12 pb-16">
        <div class="w-full max-w-sm">
          <slot />
        </div>
      </main>
    </div>

    <!-- Hero panel: desktop-only, ~56-57%. Built from theme tokens (no photo asset in the
         repo), kept white-label-safe — every color and the watermark logo come from the
         active theme. Red stays a deliberate accent, never a full-bleed fill. -->
    <div class="hidden md:flex md:w-[57%] lg:w-[56%] relative flex-col justify-end overflow-hidden bg-surfaceDark p-10 lg:p-16">
      <div
        class="pointer-events-none absolute inset-0 text-onDark opacity-[0.06] bg-[radial-gradient(currentColor_1px,transparent_1px)] bg-[length:28px_28px]"
      />
      <div class="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-primary/25 blur-3xl" />
      <img
        v-if="logo"
        :src="logo.src"
        alt=""
        class="pointer-events-none absolute -bottom-12 -right-12 w-2/3 max-w-md opacity-[0.07] select-none"
      />

      <div class="relative max-w-md">
        <div class="flex items-center gap-3 mb-6">
          <span class="h-2 w-2 rounded-full bg-primary" />
          <span class="h-px w-10 bg-primary/50" />
        </div>
        <h1 class="text-headline-1 text-onDark">{{ t('auth.hero.title') }}</h1>
        <p class="mt-4 text-body text-onDark/70 max-w-sm">{{ t('auth.hero.subtitle') }}</p>
      </div>
    </div>
  </div>
</template>

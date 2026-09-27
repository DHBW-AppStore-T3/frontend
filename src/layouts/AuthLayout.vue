<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useTheme } from '@/theme/useTheme'

const { brand, authLogo } = useTheme()
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
    <!-- Brand panel: desktop split-screen only. Geometric accents built from theme
         tokens stand in for photography (no asset), while keeping the treatment
         white-label-safe — every color here comes from the active theme. -->
    <div class="hidden md:flex md:w-2/5 lg:w-1/2 relative flex-col justify-end overflow-hidden bg-primaryDeep p-10 lg:p-14">
      <div class="pointer-events-none absolute -top-24 -right-24 w-80 h-80 rounded-full bg-primary/40 blur-3xl" />
      <div class="pointer-events-none absolute top-10 left-10 w-16 h-16 rounded-2xl border border-onDark/20 rotate-12" />
      <div class="pointer-events-none absolute bottom-16 right-12 w-28 h-28 rounded-full border border-onDark/15" />

      <div class="relative">
        <h1 class="text-headline-1 text-onDark max-w-md">{{ t('auth.hero.title') }}</h1>
        <p class="mt-4 text-body text-onDark/75 max-w-sm">{{ t('auth.hero.subtitle') }}</p>
      </div>
    </div>

    <!-- Content panel -->
    <div class="flex-1 flex flex-col min-w-0">
      <header class="flex items-start justify-between gap-4 px-6 py-6 md:px-12 md:py-8">
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
  </div>
</template>

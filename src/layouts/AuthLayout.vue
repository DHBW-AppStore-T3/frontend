<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Package, Layers, ShieldCheck } from 'lucide-vue-next'
import { t3Theme } from '@/theme/themes/t3'
import { THEME_COLOR_KEYS } from '@/theme/types'
import heroImage from '@/assets/auth-hero.jpg'

const { locale, t } = useI18n()

// The login page is now a fixed T3 design, independent of the active white-label
// theme (VITE_THEME) — everything else in the app keeps switching normally.
// Scoping the CSS color variables to this subtree keeps every existing token
// class (bg-primary, text-textMuted, ...) working unchanged while pinning them
// to T3's palette here. brand-accent is pointed at T3's primary red (instead of
// t3Theme's own olive brand-accent) so the shared BaseButton "primary" variant
// renders the solid red CTA from the reference design.
const t3Vars = computed(() => {
  const vars: Record<string, string> = {}
  for (const key of THEME_COLOR_KEYS) {
    vars[`--color-${key}`] = t3Theme.colors[key]
  }
  vars['--color-brand-accent'] = t3Theme.colors.primary
  vars['--color-brand-accent-soft'] = t3Theme.colors['primary-soft']
  return vars
})

function changeLocale(lang: string) {
  locale.value = lang
  try {
    localStorage.setItem('locale', lang)
  } catch {
    // Storage is blocked when embedded in a third-party iframe (Moodle LTI);
    // the locale still switches for this session, it just isn't persisted.
  }
}

const heroWords = computed(() => t('auth.hero.title').split(' '))

const features = computed(() => [
  { icon: Package, label: t('auth.login.features.diverse') },
  { icon: Layers, label: t('auth.login.features.preconfigured') },
  { icon: ShieldCheck, label: t('auth.login.features.secure') },
])
</script>

<template>
  <div class="min-h-screen relative overflow-hidden bg-surfacePage" :style="t3Vars">
    <!-- Campus hero photo: full-bleed, desktop only -->
    <div
      class="hidden md:block absolute inset-0 bg-cover bg-center"
      :style="{ backgroundImage: `url(${heroImage})` }"
    />

    <!-- Login panel: white, diagonally cut on desktop, full-bleed on mobile -->
    <div class="auth-panel relative z-10 w-full md:w-[44%] min-h-screen bg-surfacePage flex flex-col">
      <header class="flex items-start justify-between gap-4 px-8 pt-8 md:px-14 md:pt-12">
        <div>
          <img :src="t3Theme.authLogo!.src" :alt="t3Theme.authLogo!.alt" :style="{ height: `${t3Theme.authLogo!.height}px` }" class="block" />
          <p class="mt-1 text-caption text-textMuted">{{ t3Theme.brand.tagline }}</p>
        </div>

        <div class="flex flex-shrink-0 rounded-full bg-surfaceMuted p-1 text-caption">
          <button
            type="button"
            data-testid="locale-de"
            @click="changeLocale('de')"
            :class="locale === 'de' ? 'bg-primarySoft text-primary' : 'text-textMuted hover:text-textStrong'"
            class="px-3 py-1 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
          >DE</button>
          <button
            type="button"
            data-testid="locale-en"
            @click="changeLocale('en')"
            :class="locale === 'en' ? 'bg-primarySoft text-primary' : 'text-textMuted hover:text-textStrong'"
            class="px-3 py-1 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
          >EN</button>
        </div>
      </header>

      <main class="flex-1 flex flex-col justify-center px-8 md:px-14 py-10 max-w-lg">
        <p class="text-caption font-semibold uppercase tracking-[0.2em] text-primary mb-4">
          {{ t('auth.hero.eyebrow') }}
        </p>
        <h1 class="text-headline-1 text-textHeading leading-[1.05] mb-6">
          <template v-for="(word, i) in heroWords" :key="i">
            <span :class="i === heroWords.length - 1 ? 'text-primary' : ''">{{ word }}</span
            ><span v-if="i < heroWords.length - 1"> </span>
          </template>
        </h1>

        <slot />
      </main>

      <footer class="px-8 md:px-14 pb-10">
        <div class="border-t border-borderSubtle pt-6 grid grid-cols-3 gap-4">
          <div v-for="feature in features" :key="feature.label" class="flex flex-col gap-2">
            <component :is="feature.icon" :size="20" class="text-textMuted" />
            <span class="text-caption text-textMuted leading-snug">{{ feature.label }}</span>
          </div>
        </div>
      </footer>
    </div>
  </div>
</template>

<style scoped>
/* Diagonal split only on desktop — a straight edge would just look clipped on mobile. */
@media (min-width: 768px) {
  .auth-panel {
    clip-path: polygon(0 0, 100% 0, 76% 100%, 0 100%);
  }
}
</style>

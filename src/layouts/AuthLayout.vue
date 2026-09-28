<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Package, Layers, ShieldCheck } from 'lucide-vue-next'
import { t3Theme } from '@/theme/themes/t3'
import { THEME_COLOR_KEYS } from '@/theme/types'
import bgImage from '@/assets/auth-bg.jpg'

const { locale, t } = useI18n()

// The login page is now a fixed T3 design, independent of the active white-label
// theme (VITE_THEME) — everything else in the app keeps switching normally.
// Scoping the CSS color variables to this subtree keeps every existing token
// class (bg-primary, text-textMuted, ...) working unchanged while pinning them
// to T3's palette here.
const t3Vars = computed(() => {
  const vars: Record<string, string> = {}
  for (const key of THEME_COLOR_KEYS) {
    vars[`--color-${key}`] = t3Theme.colors[key]
  }
  return vars
})

// Intrinsic size of the t3-white/t3-red logo mark PNGs (both share the same silhouette).
const logoAspectRatio = 182 / 151

function changeLocale(lang: string) {
  locale.value = lang
  try {
    localStorage.setItem('locale', lang)
  } catch {
    // Storage is blocked when embedded in a third-party iframe (Moodle LTI);
    // the locale still switches for this session, it just isn't persisted.
  }
}

// Split into an explicit two-line break (lead words / last word) instead of letting
// the browser wrap naturally — the reference's line break is a deliberate part of the
// composition, not just whatever happens to fit the container width.
const heroTitleWords = computed(() => t('auth.hero.title').split(' '))
const heroTitleLead = computed(() => heroTitleWords.value.slice(0, -1).join(' '))
const heroTitleLast = computed(() => heroTitleWords.value[heroTitleWords.value.length - 1])

const features = computed(() => [
  { icon: Package, label: t('auth.login.features.diverse') },
  { icon: Layers, label: t('auth.login.features.preconfigured') },
  { icon: ShieldCheck, label: t('auth.login.features.secure') },
])
</script>

<template>
  <div class="min-h-screen relative overflow-hidden bg-surfacePage" :style="t3Vars">
    <!-- The entire background — campus photo, diagonal seam and the geometric shape —
         is one final, approved reference image (do not edit its content/geometry/colors).
         Desktop/tablet only. Content sits directly on top of it (no separate white panel
         underneath); on mobile the image is hidden and the page falls back to a plain
         surfacePage background from the wrapper above. bg-cover preserves the image's
         own aspect ratio (crops, never stretches/distorts it) at any viewport size. -->
    <div
      class="hidden md:block absolute inset-0 bg-cover bg-left"
      aria-hidden="true"
      :style="{ backgroundImage: `url(${bgImage})` }"
    />

    <div class="relative z-10 w-full md:w-[44%] min-h-screen flex flex-col">
        <header class="flex items-start justify-between gap-4 px-6 pt-6 md:pl-10 md:pr-8 md:pt-10 lg:pl-[7.25rem] lg:pr-10 lg:pt-12">
          <!-- Recolored via mask instead of swapping to a raw literal color: the logo's own
               silhouette (t3Theme.logo) is masked and filled with the "primary" token, so it
               follows whatever theme is scoped onto this page instead of a baked-in PNG tint.
               T3 mark only — no tagline/kicker underneath. -->
          <div
            class="auth-logo-mark bg-primary"
            role="img"
            :aria-label="t3Theme.brand.name"
            :style="{
              height: `${t3Theme.authLogo!.height}px`,
              aspectRatio: `${logoAspectRatio}`,
              '--logo-mask-url': `url(${t3Theme.logo.src})`,
            }"
          />

          <div class="flex flex-shrink-0 items-center gap-0.5 text-caption">
            <button
              type="button"
              data-testid="locale-de"
              @click="changeLocale('de')"
              :class="locale === 'de' ? 'bg-primarySoft text-primary font-semibold' : 'text-textMuted hover:text-textStrong'"
              class="px-3 py-1.5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
            >DE</button>
            <button
              type="button"
              data-testid="locale-en"
              @click="changeLocale('en')"
              :class="locale === 'en' ? 'bg-primarySoft text-primary font-semibold' : 'text-textMuted hover:text-textStrong'"
              class="px-3 py-1.5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
            >EN</button>
          </div>
        </header>

        <!-- Anchored below the header at a fixed offset (not vertically centered) so the
             headline lands at the same height as the reference regardless of viewport. -->
        <main class="px-6 md:pl-10 md:pr-8 lg:pl-[7.25rem] lg:pr-10 pt-10 md:pt-14 lg:pt-16 max-w-lg">
          <h1 class="text-display-1 text-textHeading mb-6">
            <span class="block">{{ heroTitleLead }}</span><span class="block text-primary">{{ heroTitleLast }}</span>
          </h1>

          <slot />
        </main>

        <footer class="mt-auto px-6 md:pl-10 md:pr-8 lg:pl-[7.25rem] lg:pr-10 pb-8 md:pb-10 pt-8 md:pt-10">
          <div class="border-t border-borderSubtle pt-6 grid grid-cols-3 gap-3 md:gap-4">
            <div v-for="feature in features" :key="feature.label" class="flex flex-col gap-2">
              <component :is="feature.icon" :size="20" :stroke-width="2" aria-hidden="true" class="text-textMuted" />
              <span class="text-caption text-textMuted leading-snug">{{ feature.label }}</span>
            </div>
          </div>
        </footer>
    </div>
  </div>
</template>

<style scoped>
/* Recolors the logo silhouette (--logo-mask-url, set inline) via the "bg-primary"
   token instead of a raw baked-in PNG tint. */
.auth-logo-mark {
  -webkit-mask-image: var(--logo-mask-url);
  mask-image: var(--logo-mask-url);
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: left center;
  mask-position: left center;
}
</style>

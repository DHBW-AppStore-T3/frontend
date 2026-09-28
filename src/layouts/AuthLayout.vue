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
    <!-- Campus hero photo: full-bleed, desktop only. A blurred, scaled-up copy fills the
         frame as a backdrop so the sharp photo on top can sit at "contain" size (zoomed
         out, nothing cropped) without leaving hard empty bars at the top/bottom. -->
    <div class="hidden md:block absolute inset-0 overflow-hidden">
      <div
        class="absolute inset-0 bg-cover bg-center scale-110 blur-2xl"
        :style="{ backgroundImage: `url(${heroImage})` }"
      />
      <div
        class="absolute inset-0 bg-contain bg-center bg-no-repeat"
        :style="{ backgroundImage: `url(${heroImage})` }"
      />
    </div>

    <!-- Login panel: white, diagonally cut on desktop, full-bleed on mobile -->
    <div class="auth-panel relative z-10 w-full md:w-[44%] min-h-screen bg-surfacePage flex flex-col">
      <header class="flex items-start justify-between gap-4 px-8 pt-8 md:px-14 md:pt-12">
        <!-- Recolored via mask instead of swapping to a raw literal color: the logo's own
             silhouette (t3Theme.logo) is masked and filled with the "primary" token, so it
             follows whatever theme is scoped onto this page instead of a baked-in PNG tint. -->
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

        <div class="flex flex-shrink-0 items-center gap-1 text-caption">
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

      <!-- Large, extremely subtle faceted backdrop behind the hero copy — built from the
           existing neutral surface tokens (never brand/primary), purely decorative. -->
      <div class="relative flex-1 flex flex-col overflow-hidden">
        <div class="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div class="absolute inset-y-0 left-0 w-[95%] bg-surfaceMuted" style="clip-path: polygon(0 0%, 88% 0%, 62% 100%, 0% 100%)" />
          <div class="absolute inset-y-0 left-0 w-[95%] bg-borderSubtle opacity-60" style="clip-path: polygon(0 22%, 66% 6%, 84% 48%, 40% 100%, 0% 100%)" />
        </div>

        <main class="relative flex-1 flex flex-col justify-center px-8 md:px-14 py-10 max-w-lg">
          <h1 class="text-display-1 text-textHeading mb-6">
            {{ heroTitleLead }} <span class="text-primary">{{ heroTitleLast }}</span>
          </h1>

          <slot />
        </main>

        <footer class="relative px-8 md:px-14 pb-10">
          <div class="border-t border-borderSubtle pt-6 grid grid-cols-3 gap-4">
            <div v-for="feature in features" :key="feature.label" class="flex flex-col gap-2">
              <component :is="feature.icon" :size="20" class="text-textMuted" />
              <span class="text-caption text-textMuted leading-snug">{{ feature.label }}</span>
            </div>
          </div>
        </footer>
      </div>
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

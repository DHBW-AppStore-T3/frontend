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
    <!-- Campus hero photo: full-bleed, desktop only. Anchored to the left of its own
         frame so the trees/low sun near the diagonal seam stay in view instead of a
         center crop that loses them. -->
    <div class="hidden md:block absolute inset-0 overflow-hidden">
      <div
        class="absolute inset-0 bg-cover bg-left"
        :style="{ backgroundImage: `url(${heroImage})` }"
      />
    </div>

    <!-- Login panel: white, diagonally cut on desktop, full-bleed on mobile -->
    <div class="auth-panel relative z-10 w-full md:w-[44%] min-h-screen bg-surfacePage flex flex-col">
      <!-- Large, extremely subtle backdrop shape behind the whole column — a single big
           rotated square with softened (blurred) edges, off-white. Matches the isolated
           reference swatch exactly: one large diamond, not a faceted polygon mesh. -->
      <div
        class="absolute w-[46rem] h-[46rem] rounded-3xl bg-surfaceMuted blur-sm rotate-45 pointer-events-none -left-56 top-16"
        aria-hidden="true"
      />

      <div class="relative flex flex-col min-h-screen">
        <header class="flex items-start justify-between gap-4 px-6 pt-8 md:pl-[7.25rem] md:pr-10 md:pt-12">
          <!-- Recolored via mask instead of swapping to a raw literal color: the logo's own
               silhouette (t3Theme.logo) is masked and filled with the "primary" token, so it
               follows whatever theme is scoped onto this page instead of a baked-in PNG tint. -->
          <div>
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
            <p class="mt-1 text-caption text-textMuted">{{ t3Theme.brand.tagline }}</p>
          </div>

          <div class="flex flex-shrink-0 items-center gap-1 rounded-full bg-surfacePage shadow-sm p-1 text-caption">
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
        <main class="px-6 md:pl-[7.25rem] md:pr-10 pt-12 md:pt-16 max-w-lg">
          <h1 class="text-display-1 text-textHeading mb-6">
            {{ heroTitleLead }} <span class="text-primary">{{ heroTitleLast }}</span>
          </h1>

          <slot />
        </main>

        <footer class="mt-auto px-6 md:pl-[7.25rem] md:pr-10 pb-10 pt-10">
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

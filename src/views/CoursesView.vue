<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { GraduationCap, Trash2, Plus, Users, Search, ChevronRight } from 'lucide-vue-next'
import { useCourseStore } from '@/stores/course.store'
import { useToast } from '@/composables/useToast'
import { extractErrorMessage } from '@/utils/http-error'
import { useRole } from '@/composables/useRole'
import { courseApi } from '@/api/course.api'
import { useI18n } from 'vue-i18n' // <-- i18n importiert
import Card from '@/components/ui/Card.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import Modal from '@/components/ui/Modal.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import EntityListState from '@/components/ui/EntityListState.vue'

const courseStore = useCourseStore()
const toast = useToast()
// Permission mirror: course CRUD is staff-only in the UI (the backend still
// enforces course-teacher membership on edit/delete). ``isStaff`` covers
// teacher + admin which matches the previous ``can.editCourse`` /
// ``can.createCourse`` / ``can.deleteCourse`` semantics.
const { isStaff } = useRole()
const router = useRouter()
const { t } = useI18n() // <-- i18n initialisiert

const searchQuery = ref('')
const filteredCourses = computed(() => courseStore.courses.filter(course => course.name.toLocaleLowerCase().includes(searchQuery.value.trim().toLocaleLowerCase())))
const showModal = ref(false)
const formData = ref({ name: '' })

const showDeleteModal = ref(false)
const courseToDelete = ref<{ courseId: string; name: string } | null>(null)
const isDeleting = ref(false)
const memberCounts = ref<Record<string, number>>({})

const fetchMemberCounts = async () => {
  const entries = await Promise.all(
      courseStore.courses.map(async (c) => {
        try {
          const { data } = await courseApi.listMembers(c.courseId)
          return [c.courseId, data.length] as const
        } catch {
          return [c.courseId, 0] as const
        }
      })
  )
  memberCounts.value = Object.fromEntries(entries)
}

onMounted(async () => {
  try {
    await courseStore.fetchCourses()
    if (isStaff.value) {
      await fetchMemberCounts()
    }
  } catch (_error) {
    toast.error(t('CoursesView.toasts.loadError'))
  }
})

const openCreateModal = () => {
  formData.value = { name: '' }
  showModal.value = true
}

const saveCourse = async () => {
  try {
    const created = await courseStore.createCourse({ name: formData.value.name })
    toast.success(t('CoursesView.toasts.createSuccess'))
    showModal.value = false

    // Navigate to the detail page right after creation.
    if (created?.courseId) {
      router.push(`/courses/${created.courseId}`)
    }
  } catch (error) {
    toast.error(extractErrorMessage(error, t('CoursesView.toasts.createError')))
  }
}

const requestDelete = (course: { courseId: string; name: string }) => {
  courseToDelete.value = course
  showDeleteModal.value = true
}

const closeDeleteModal = () => {
  if (isDeleting.value) return
  showDeleteModal.value = false
  courseToDelete.value = null
}

const confirmDelete = async () => {
  if (!courseToDelete.value) return
  const { courseId } = courseToDelete.value
  isDeleting.value = true
  try {
    await courseStore.deleteCourse(courseId)
    delete memberCounts.value[courseId]
    toast.success(t('CoursesView.toasts.deleteSuccess'))
    showDeleteModal.value = false
    courseToDelete.value = null
  } catch (error) {
    toast.error(extractErrorMessage(error, t('CoursesView.toasts.deleteError')))
  } finally {
    isDeleting.value = false
  }
}

</script>

<template>
  <div class="app-page">
    <PageHeader :eyebrow="$t('nav.courses')" :title="$t('CoursesView.title')" :subtitle="$t('CoursesView.subtitle')">
      <template #actions>
        <label class="search-field"><Search :size="16" aria-hidden="true" /><input v-model="searchQuery" type="search" :placeholder="t('workspace.searchCourses')" :aria-label="t('workspace.searchCourses')" /></label>
        <BaseButton
            v-if="isStaff"
            @click="openCreateModal"
            class="flex items-center gap-2"
        >
          <Plus :size="16" />
          {{ $t('CoursesView.newCourse') }}
        </BaseButton>
      </template>
    </PageHeader>

    <div class="catalog-tabs"><span class="catalog-tab" aria-pressed="true">{{ t('workspace.allCourses') }} <span class="catalog-count">{{ courseStore.courses.length }}</span></span></div>
    <EntityListState
      :is-loading="courseStore.isLoading && courseStore.courses.length === 0"
      :is-empty="!courseStore.isLoading && filteredCourses.length === 0"
      :icon="GraduationCap"
      :empty-message="$t('CoursesView.noCourses')"
      :loading-message="$t('CoursesView.loading')"
    >
      <template #empty-action>
        <BaseButton v-if="isStaff" @click="openCreateModal">
          {{ $t('CoursesView.createFirst') }}
        </BaseButton>
      </template>

      <div class="course-list">
        <Card v-for="(course, index) in filteredCourses" :key="course.courseId" class="course-row">
          <RouterLink :to="`/courses/${course.courseId}`" class="course-link">
            <span class="course-icon" :data-tone="index % 4"><GraduationCap :size="25" :stroke-width="1.5" /></span>
            <span class="course-copy">
              <span class="course-name">{{ course.name }}</span>
              <span class="course-caption" v-if="isStaff"><Users :size="13" /> {{ memberCounts[course.courseId] ?? 0 }} {{ (memberCounts[course.courseId] ?? 0) === 1 ? t('CoursesView.memberSingular') : t('CoursesView.memberPlural') }}</span>
              <span class="course-caption" v-else>{{ t('CoursesView.openToView') }}</span>
            </span>
            <ChevronRight :size="18" class="ml-auto text-textMuted" />
          </RouterLink>
          <button v-if="isStaff" type="button" class="course-delete" @click="requestDelete(course)" :aria-label="t('CoursesView.deleteTitle')"><Trash2 :size="16" /></button>
        </Card>
      </div>
    </EntityListState>

    <Modal :show="showModal" @close="showModal = false">
      <template #header>
        <h2 class="text-xl font-semibold">{{ $t('CoursesView.createModal.title') }}</h2>
      </template>

      <template #body>
        <div class="space-y-5">
          <p class="text-sm text-textMuted">
            {{ $t('CoursesView.createModal.intro') }}
          </p>
          <div>
            <label class="block text-sm font-medium text-textMuted mb-1.5">
              {{ $t('CoursesView.createModal.nameLabel') }}
            </label>
            <BaseInput v-model="formData.name" :placeholder="$t('CoursesView.createModal.namePlaceholder')" required @keyup.enter="saveCourse" />
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-3">
          <BaseButton variant="text" @click="showModal = false">
            {{ $t('CoursesView.createModal.cancel') }}
          </BaseButton>
          <BaseButton @click="saveCourse" :disabled="!formData.name">
            {{ $t('CoursesView.createModal.create') }}
          </BaseButton>
        </div>
      </template>
    </Modal>

    <Modal :show="showDeleteModal" @close="closeDeleteModal">
      <template #header>
        <h2 class="text-xl font-semibold text-red-700">{{ $t('CoursesView.deleteModal.title') }}</h2>
      </template>

      <template #body>
        <div class="space-y-3">
          <p class="text-textMuted" v-html="$t('CoursesView.deleteModal.confirmPrompt', { name: courseToDelete?.name })"></p>
          <p class="text-sm text-textMuted">
            {{ $t('CoursesView.deleteModal.warning') }}
          </p>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-3">
          <BaseButton variant="text" @click="closeDeleteModal" :disabled="isDeleting">
            {{ $t('CoursesView.deleteModal.cancel') }}
          </BaseButton>
          <BaseButton variant="destructive" @click="confirmDelete" :disabled="isDeleting">
            {{ isDeleting ? $t('CoursesView.deleteModal.deleting') : $t('CoursesView.deleteModal.delete') }}
          </BaseButton>
        </div>
      </template>
    </Modal>
  </div>
</template>
<style scoped>
.course-list { display: grid; gap: 16px; }
.course-row { display: flex; align-items: center; padding: 18px 20px; gap: 16px; }
.course-link { display: flex; align-items: center; gap: 20px; flex: 1; min-width: 0; }
.course-icon { width: 50px; height: 50px; border-radius: 9px; display: grid; place-items: center; background: rgb(var(--color-info) / .1); color: rgb(var(--color-info)); flex-shrink: 0; }
.course-icon[data-tone='0'] { color: rgb(var(--color-warning)); background: rgb(var(--color-warning) / .1); }
.course-icon[data-tone='2'] { color: rgb(var(--color-success)); background: rgb(var(--color-success) / .1); }
.course-copy { display: grid; gap: 5px; min-width: 0; }
.course-name { color: rgb(var(--color-text-heading)); font-weight: 650; font-size: 15px; }
.course-caption { display: flex; align-items: center; gap: 6px; color: rgb(var(--color-text-muted)); font-size: 12px; }
.course-delete { color: rgb(var(--color-text-faint)); padding: 8px; border-radius: 6px; }
.course-delete:hover { color: rgb(var(--color-danger)); background: rgb(var(--color-danger) / .06); }
</style>

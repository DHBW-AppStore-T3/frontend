<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { GraduationCap, Trash2, Plus, Users } from 'lucide-vue-next'
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
  } catch (error: any) {
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
  } catch (error: any) {
    toast.error(extractErrorMessage(error, t('CoursesView.toasts.deleteError')))
  } finally {
    isDeleting.value = false
  }
}

const goToDetail = (courseId: string) => {
  router.push({ path: `/courses/${courseId}` })
}
</script>

<template>
  <div class="p-6">
    <PageHeader :title="$t('CoursesView.title')" :subtitle="$t('CoursesView.subtitle')">
      <template #actions>
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

    <EntityListState
      :is-loading="courseStore.isLoading && courseStore.courses.length === 0"
      :is-empty="!courseStore.isLoading && courseStore.courses.length === 0"
      :icon="GraduationCap"
      :empty-message="$t('CoursesView.noCourses')"
      :loading-message="$t('CoursesView.loading')"
    >
      <template #empty-action>
        <BaseButton v-if="isStaff" @click="openCreateModal">
          {{ $t('CoursesView.createFirst') }}
        </BaseButton>
      </template>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card
            v-for="course in courseStore.courses"
            :key="course.courseId"
            class="flex flex-col group h-full relative cursor-pointer hover:border-emerald-200"
            @click="goToDetail(course.courseId)"
        >
          <!-- Delete action (top-right) -->
          <button
              v-if="isStaff"
              @click.stop="requestDelete(course)"
              class="absolute top-3 right-3 p-2 hover:bg-red-50 rounded-lg transition z-10"
              :title="$t('CoursesView.deleteTitle')"
          >
            <Trash2 :size="16" class="text-red-600" />
          </button>

          <div class="flex items-center gap-4 mb-4">
            <div class="bg-gray-50 p-3 rounded-lg text-blue-600 group-hover:text-primary transition-colors flex items-center justify-center w-[56px] h-[56px] flex-shrink-0 border border-gray-100">
              <GraduationCap :size="32" />
            </div>
            <h3 class="font-bold text-xl text-gray-900 leading-tight pr-10">
              {{ course.name }}
            </h3>
          </div>

          <p class="text-gray-600 text-sm mb-6 flex-grow leading-relaxed text-left flex items-center gap-2">
            <template v-if="isStaff">
              <Users :size="14" class="text-gray-400" />
              <span>
                {{ memberCounts[course.courseId] ?? 0 }}
                {{ (memberCounts[course.courseId] ?? 0) === 1 ? $t('CoursesView.memberSingular') : $t('CoursesView.memberPlural') }}
              </span>
            </template>
            <span v-else class="text-gray-400 italic">
              {{ $t('CoursesView.openToView') }}
            </span>
          </p>

          <div class="mt-auto">
            <BaseButton
                variant="green"
                class="w-full flex items-center justify-center gap-2"
                @click.stop="goToDetail(course.courseId)"
            >
              {{ $t('CoursesView.openDetails') }}
            </BaseButton>
          </div>
        </Card>
      </div>
    </EntityListState>

    <Modal :show="showModal" @close="showModal = false">
      <template #header>
        <h2 class="text-xl font-semibold">{{ $t('CoursesView.createModal.title') }}</h2>
      </template>

      <template #body>
        <div class="space-y-5">
          <p class="text-sm text-gray-500">
            {{ $t('CoursesView.createModal.intro') }}
          </p>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">
              {{ $t('CoursesView.createModal.nameLabel') }}
            </label>
            <BaseInput v-model="formData.name" :placeholder="$t('CoursesView.createModal.namePlaceholder')" required @keyup.enter="saveCourse" />
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-3">
          <BaseButton variant="ghost" @click="showModal = false">
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
          <p class="text-gray-700" v-html="$t('CoursesView.deleteModal.confirmPrompt', { name: courseToDelete?.name })"></p>
          <p class="text-sm text-gray-500">
            {{ $t('CoursesView.deleteModal.warning') }}
          </p>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-3">
          <BaseButton variant="ghost" @click="closeDeleteModal" :disabled="isDeleting">
            {{ $t('CoursesView.deleteModal.cancel') }}
          </BaseButton>
          <BaseButton variant="red" @click="confirmDelete" :disabled="isDeleting">
            {{ isDeleting ? $t('CoursesView.deleteModal.deleting') : $t('CoursesView.deleteModal.delete') }}
          </BaseButton>
        </div>
      </template>
    </Modal>
  </div>
</template>
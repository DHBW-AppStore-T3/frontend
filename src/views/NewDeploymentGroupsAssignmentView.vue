<script setup lang="ts">
import { ref, computed, onMounted, watch, reactive, nextTick } from 'vue'
import { userApi } from '@/api/user.api'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useDeploymentStore } from '@/stores/deployment.store'
import DeploymentProgressBar from '@/components/DeploymentProgressBar.vue'
import { Plus, Minus, Users, ArrowLeft, ArrowRight, GripVertical, Trash2, UserPlus, Shuffle, X } from 'lucide-vue-next'

const { t } = useI18n()
const router = useRouter()
const store = useDeploymentStore()

// --- Reactive cache wrapper ---
const studentCacheMap = store.studentCache ?? new Map<string, any>()
const studentCache = reactive<Record<string, any>>({})

function syncStudentCacheToReactive() {
  for (const [id, val] of studentCacheMap.entries()) {
    studentCache[id] = val
  }
}

syncStudentCacheToReactive()

function setStudentCache(id: string, val: any) {
  studentCacheMap.set(id, val)
  studentCache[id] = val
}

// --- State ---
const activeGroupIndex = ref(0) 
const draggedStudent = ref<string | null>(null)
const dragOverGroup = ref<number | null>(null)
const dragOverUnassigned = ref(false)

const groupNames = ref<string[]>(store.draft.groupNames || [])

watch(groupNames, (newVal) => {
  store.draft.groupNames = newVal
}, { deep: true })

const totalStudents = computed(() => store.draft.studentIds.length)

const groupCount = computed({
  get: () => store.draft.groupCount,
  set: (val) => store.draft.groupCount = val
})

const mode = computed(() => store.draft.groupMode)
const showControls = computed(() => mode.value === 'custom')

const unassignedStudents = computed(() => {
  const assigned = new Set<string>()
  const assignments = store.draft.assignments as string[][]
  if (assignments && Array.isArray(assignments)) {
    assignments.forEach((group: string[]) => {
      if (group) group.forEach((id: string) => assigned.add(id))
    })
  }
  return store.draft.studentIds.filter((id: string) => !assigned.has(id))
})

// --- Helper Functions ---
function ensureDefaultGroupNames() {
  const currentNames = groupNames.value
  groupNames.value = []
  for (let i = 0; i < groupCount.value; i++) {
    const currentName = currentNames[i]
    
    // Keep existing names (even if they are default names).
    if (currentName && currentName.trim() !== '') {
      groupNames.value[i] = currentName
    } else {
      // Set default names only for new/empty groups via i18n.
      groupNames.value[i] = t('deployment.assignment.vmDefaultName', { index: i + 1 })
    }
  }
}

const ensureAssignmentArrays = () => {
  const assignments = store.draft.assignments as string[][]
  for (let i = 0; i < store.draft.groupCount; i++) {
    if (!assignments[i]) assignments[i] = []
    if (groupNames.value[i] === undefined) groupNames.value[i] = ''
  }
}

// --- Watchers ---
watch(groupCount, (newCount, oldCount) => {
  ensureAssignmentArrays()
  
  // Add default names only for new groups.
  if (typeof oldCount === 'number' && newCount > oldCount) {
    for (let i = oldCount; i < newCount; i++) {
      if (!groupNames.value[i] || groupNames.value[i]?.trim() === '') {
        groupNames.value[i] = t('deployment.assignment.vmDefaultName', { index: i + 1 })
      }
    }
  }
  
  if (activeGroupIndex.value >= newCount) activeGroupIndex.value = Math.max(0, newCount - 1)

  if (typeof oldCount === 'number' && oldCount > newCount) {
    const assignments = store.draft.assignments as string[][]
    const removedStudents: string[] = []
    for (let i = newCount; i < oldCount; i++) {
      if (assignments[i] && Array.isArray(assignments[i])) {
        removedStudents.push(...(assignments[i] ?? []))
      }
    }
    assignments.length = newCount
    // Also remove the names for removed teams.
    groupNames.value.length = newCount
  }
}, { immediate: false })

// --- Lifecycle ---
onMounted(async () => {
  if (!store.draft.studentIds || store.draft.studentIds.length === 0) {
    router.replace({ name: 'deployment.config' })
    return
  }
  if (!store.draft.groupCount || store.draft.groupCount < 1) {
    store.draft.groupCount = 1
  }
  ensureAssignmentArrays()
  
  // Ensure all groups have names.
  ensureDefaultGroupNames()
  
  const assignments = store.draft.assignments as string[][]
  const assignedIds: string[] = assignments 
    ? ([] as string[]).concat(...assignments.filter((arr): arr is string[] => Array.isArray(arr) && arr.length > 0))
    : []
    
  const allIds = Array.from(new Set<string>([
    ...(store.draft.studentIds ?? []),
    ...assignedIds,
    ...unassignedStudents.value
  ]))
  
  const missingIds: string[] = []
  for (const id of allIds) {
    const cached = studentCache[id]
    const needsUpdate = !cached || (!cached.firstName && !cached.lastName && !cached.username && !cached.email)
    if (needsUpdate) {
      let found = null
      for (const key in studentCache) {
        const s = studentCache[key]
        if (s && s.userId === id && (s.firstName || s.lastName || s.username || s.email)) {
          found = s
          break
        }
      }
      if (found) {
        setStudentCache(id, found)
      } else {
        missingIds.push(id)
        if (!cached) setStudentCache(id, { userId: id })
      }
    }
  }
  
  if (missingIds.length > 0) {
    const results = await Promise.all(missingIds.map(id => userApi.getById(id).then(res => res.data).catch(() => null)))
    results.forEach((user) => {
      if (user && user.userId) {
        setStudentCache(user.userId, user)
      }
    })
    await nextTick()
  }
})

// --- Mode Functions ---
const setOneGroup = () => {
  store.draft.groupMode = 'one'
  store.draft.groupCount = 1
  activeGroupIndex.value = 0
  const assignments = store.draft.assignments as string[][]
  assignments[0] = [...store.draft.studentIds]
  
  // Keep the existing name or set a default.
  const defaultName = t('deployment.assignment.vmDefaultName', { index: 1 })
  if (!groupNames.value[0] || groupNames.value[0].trim() === '' || groupNames.value[0].startsWith('Team')) {
    groupNames.value[0] = defaultName
  }
  groupNames.value.length = 1
}

const setEachUser = () => {
  store.draft.groupMode = 'eachUser'
  store.draft.groupCount = totalStudents.value
  const assignments = store.draft.assignments as string[][]
  for (let i = 0; i < store.draft.groupCount; i++) {
    assignments[i] = []
    groupNames.value[i] = t('deployment.assignment.vmDefaultName', { index: i + 1 })
  }
  store.draft.studentIds.forEach((studentId: string, index: number) => {
    if (assignments[index]) assignments[index].push(studentId)
  })
  activeGroupIndex.value = 0
}

const setCustom = () => {
  store.draft.groupMode = 'custom'
  if (store.draft.groupCount === 1 && totalStudents.value > 1) store.draft.groupCount = 2
  // Ensure names exist for the current count.
  ensureDefaultGroupNames()
}

const increment = () => { if (store.draft.groupCount < totalStudents.value) store.draft.groupCount++ }

const decrement = () => {
  if (store.draft.groupCount > 1) {
    const oldCount = store.draft.groupCount
    const newCount = oldCount - 1
    const assignments = store.draft.assignments as string[][]
    const removedStudents: string[] = []
    for (let i = newCount; i < oldCount; i++) {
      const currentGroup = assignments[i]
      if (currentGroup && Array.isArray(currentGroup)) {
        removedStudents.push(...currentGroup)
      }
    }
    assignments.length = newCount
    store.draft.groupCount = newCount
  }
}

// --- Drag & Drop Logic ---
const handleDragStart = (studentId: string, event: DragEvent) => {
  draggedStudent.value = studentId
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', studentId)
  }
}

const handleDragEnd = () => {
  draggedStudent.value = null
  dragOverGroup.value = null
  dragOverUnassigned.value = false
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

const handleDragEnterGroup = (groupIndex: number) => {
  dragOverGroup.value = groupIndex
}

const handleDragLeaveGroup = () => {
  dragOverGroup.value = null
}

const handleDragEnterUnassigned = () => {
  dragOverUnassigned.value = true
}

const handleDragLeaveUnassigned = () => {
  dragOverUnassigned.value = false
}

const handleDropOnGroup = (groupIndex: number, event: DragEvent) => {
  event.preventDefault()
  const studentId = draggedStudent.value
  if (!studentId) return

  const assignments = store.draft.assignments as string[][]
  assignments.forEach((group: string[]) => {
    if (group) {
      let idx = group.indexOf(studentId)
      while (idx > -1) {
        group.splice(idx, 1)
        idx = group.indexOf(studentId)
      }
    }
  })

  if (!assignments[groupIndex]) {
    assignments[groupIndex] = []
  }
  if (!assignments[groupIndex].includes(studentId)) {
    assignments[groupIndex].push(studentId)
  }

  dragOverGroup.value = null
}

const handleDropOnUnassigned = (event: DragEvent) => {
  event.preventDefault()
  const studentId = draggedStudent.value
  if (!studentId) return

  const assignments = store.draft.assignments as string[][]
  assignments.forEach((group: string[]) => {
    if (group) {
      let idx = group.indexOf(studentId)
      while (idx > -1) {
        group.splice(idx, 1)
        idx = group.indexOf(studentId)
      }
    }
  })

  dragOverUnassigned.value = false
}

const removeFromGroup = (studentId: string, groupIndex: number) => {
  const assignments = store.draft.assignments as string[][]
  const group = assignments[groupIndex]
  if (group) {
    const idx = group.indexOf(studentId)
    if (idx > -1) group.splice(idx, 1)
  }
}

const shuffleStudents = () => {
  const allStudents = [...store.draft.studentIds]
  
  // Fisher-Yates shuffle with explicit null check.
  for (let i = allStudents.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = allStudents[i]
    allStudents[i] = allStudents[j] ?? ''
    allStudents[j] = temp ?? ''
  }
  
  const studentsPerGroup = Math.floor(allStudents.length / store.draft.groupCount)
  const remainder = allStudents.length % store.draft.groupCount
  
  const assignments = store.draft.assignments as string[][]
  let currentIndex = 0
  for (let i = 0; i < store.draft.groupCount; i++) {
    const groupSize = studentsPerGroup + (i < remainder ? 1 : 0)
    assignments[i] = allStudents.slice(currentIndex, currentIndex + groupSize)
    currentIndex += groupSize
  }
}

const clearAllAssignments = () => {
  const assignments = store.draft.assignments as string[][]
  for (let i = 0; i < store.draft.groupCount; i++) {
    assignments[i] = []
  }
}

const handleNext = () => router.push({ name: 'deployment.variables' }) 
const handleBack = () => router.push({ name: 'deployment.config' })
</script>

<template>
  <div class="max-w-[1800px] mx-auto w-full px-4">
    
    <div class="bg-gradient-to-br from-white to-gray-50 rounded-2xl border-2 border-gray-200 shadow-xl min-h-[700px] flex flex-col overflow-hidden">
      
      <!-- Header -->
      <div class="p-8 pb-6 bg-white border-b-2 border-gray-200">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
            <Users :size="28" class="text-white" />
          </div>
          <h1 class="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            {{ t('deployment.title') }}
          </h1>
        </div>
        <DeploymentProgressBar :current-step="2" />
      </div>

      <!-- Controls Section -->
      <div class="p-6 bg-white border-b-2 border-gray-200">
        <div class="flex flex-wrap items-center justify-between gap-4">
          
          <!-- Mode Selection -->
          <div class="flex gap-2">
            <button @click="setOneGroup" 
              class="px-5 py-2.5 rounded-xl font-semibold transition-all text-sm border-2"
              :class="mode === 'one' 
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-lg shadow-emerald-600/30' 
                : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50'">
              {{ t('deployment.groups.one') }}
            </button>
            <button @click="setEachUser" 
              class="px-5 py-2.5 rounded-xl font-semibold transition-all text-sm border-2"
              :class="mode === 'eachUser' 
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-lg shadow-emerald-600/30' 
                : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50'">
              {{ t('deployment.groups.eachUser') }}
            </button>
            <button @click="setCustom" 
              class="px-5 py-2.5 rounded-xl font-semibold transition-all text-sm border-2"
              :class="mode === 'custom' 
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-lg shadow-emerald-600/30' 
                : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50'">
              {{ t('deployment.groups.custom') }}
            </button>
          </div>

          <!-- Team Counter -->
          <div v-if="showControls" class="flex items-center gap-3 bg-gray-100 px-4 py-2 rounded-xl border-2 border-gray-200">
            <button @click="decrement" 
              class="w-9 h-9 rounded-lg bg-white border border-gray-300 hover:border-red-400 hover:bg-red-50 flex items-center justify-center transition-all text-red-600 disabled:opacity-40 disabled:cursor-not-allowed" 
              :disabled="groupCount <= 1">
              <Minus :size="18" />
            </button>
            <div class="flex items-center gap-2">
              <span class="text-3xl font-bold text-gray-900 w-12 text-center tabular-nums">{{ groupCount }}</span>
              <span class="text-sm font-semibold text-gray-600">{{ t('deployment.assignment.teamsLabel') }}</span>
            </div>
            <button @click="increment" 
              class="w-9 h-9 rounded-lg bg-white border border-gray-300 hover:border-emerald-400 hover:bg-emerald-50 flex items-center justify-center transition-all text-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed" 
              :disabled="groupCount >= totalStudents">
              <Plus :size="18" />
            </button>
          </div>

          <!-- Action Buttons -->
          <div class="flex gap-2">
            <button @click="shuffleStudents" 
              class="px-4 py-2.5 rounded-xl bg-purple-100 text-purple-700 font-semibold hover:bg-purple-200 transition-all flex items-center gap-2 border-2 border-purple-200"
              :title="t('deployment.assignment.shuffleTooltip')">
              <Shuffle :size="18" />
              {{ t('deployment.assignment.shuffle') }}
            </button>
            <button @click="clearAllAssignments" 
              class="px-4 py-2.5 rounded-xl bg-red-100 text-red-700 font-semibold hover:bg-red-200 transition-all flex items-center gap-2 border-2 border-red-200"
              :title="t('deployment.assignment.resetTooltip')">
              <Trash2 :size="18" />
              {{ t('deployment.assignment.reset') }}
            </button>
          </div>
        </div>

        <!-- Info Banner -->
        <div class="mt-4 bg-blue-50 border-2 border-blue-200 rounded-xl p-4 flex items-start gap-3">
          <div class="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
            <GripVertical :size="16" class="text-white" />
          </div>
          <div>
            <p class="font-semibold text-blue-900 mb-1">{{ t('deployment.assignment.dragDropTitle') }}</p>
            <p class="text-sm text-blue-700">{{ t('deployment.assignment.dragDropText') }}</p>
          </div>
        </div>
      </div>

      <!-- Main Content Grid -->
      <div class="flex-grow p-6 overflow-hidden">
        <div class="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
          
          <!-- Unassigned Students Pool -->
          <div class="lg:col-span-1">
            <div class="h-full flex flex-col bg-white rounded-xl border-2 border-gray-300 overflow-hidden shadow-lg">
              <div class="bg-white px-4 py-3 border-b-2 border-gray-200 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <UserPlus :size="20" class="text-gray-700" />
                  <h3 class="font-bold text-gray-900">{{ t('deployment.assignment.unassigned') }}</h3>
                </div>
                <span class="px-2.5 py-1 bg-gray-100 rounded-full text-xs font-bold text-gray-700 border-2 border-gray-200">
                  {{ unassignedStudents.length }}
                </span>
              </div>
              
              <div 
                class="flex-grow p-3 overflow-y-auto bg-gray-50"
                :class="dragOverUnassigned ? 'bg-gray-200 ring-4 ring-gray-400' : ''"
                @dragover="handleDragOver"
                @dragenter="handleDragEnterUnassigned"
                @dragleave="handleDragLeaveUnassigned"
                @drop="handleDropOnUnassigned">
                
                <div v-if="unassignedStudents.length === 0" 
                  class="h-full flex items-center justify-center text-gray-400 text-sm italic text-center px-4 border-2 border-dashed border-gray-300 rounded-lg bg-white">
                  {{ t('deployment.assignment.allAssigned') }}
                </div>
                
                <div v-else class="space-y-2">
                  <div v-for="studentId in unassignedStudents" 
                    :key="studentId"
                    draggable="true"
                    @dragstart="(e) => handleDragStart(studentId, e)"
                    @dragend="handleDragEnd"
                    class="group bg-white rounded-lg px-4 py-3 border-2 border-gray-200 cursor-move hover:border-gray-400 hover:shadow-lg hover:scale-[1.02] transition-all flex items-center gap-3">
                    <GripVertical :size="18" class="text-gray-400 group-hover:text-gray-600 transition-colors" />
                    <span class="font-semibold text-gray-700 group-hover:text-gray-900 flex-1 transition-colors">
                      {{
                        (() => {
                          const s = studentCache[studentId]
                          if (!s) return studentId;
                          if (s.firstName || s.lastName) return `${s.firstName || ''} ${s.lastName || ''}`.trim();
                          if (s.username) return s.username;
                          if (s.email) return s.email;
                          return studentId;
                        })()
                      }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Teams Grid -->
          <div class="lg:col-span-3">
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 h-full overflow-y-auto pr-2">
              <div v-for="(assignments, index) in (store.draft.assignments as string[][]).slice(0, groupCount)" 
                :key="index"
                class="flex flex-col bg-white rounded-xl border-2 shadow-lg overflow-hidden transition-all"
                :class="dragOverGroup === index 
                  ? 'border-emerald-500 ring-4 ring-emerald-200 shadow-2xl scale-[1.02]' 
                  : 'border-gray-200 hover:border-emerald-300 hover:shadow-xl'">
                
                <!-- Team Header -->
                <div class="bg-white px-4 py-3 border-b-2 border-gray-200">
                  <input 
                    type="text"
                    v-model="groupNames[index]"
                    :placeholder="t('deployment.assignment.vmDefaultName', { index: index + 1 })"
                    class="w-full bg-gray-50 text-gray-900 placeholder-gray-400 px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 focus:outline-none font-bold text-center transition-all"
                  />
                  <div class="mt-2 flex items-center justify-center gap-2 bg-emerald-50 rounded-lg px-3 py-1.5">
                    <Users :size="16" class="text-emerald-600" />
                    <span class="text-sm font-semibold text-emerald-700">
                      {{ t('DeploymentDetailView.deploymentStudentCount', assignments?.length || 0) }}
                    </span>
                  </div>
                </div>

                <!-- Drop Zone -->
                <div 
                  class="flex-grow p-3 min-h-[200px] overflow-y-auto"
                  :class="dragOverGroup === index ? 'bg-emerald-50' : 'bg-gray-50'"
                  @dragover="handleDragOver"
                  @dragenter="() => handleDragEnterGroup(index)"
                  @dragleave="handleDragLeaveGroup"
                  @drop="(e) => handleDropOnGroup(index, e)">
                  
                  <div v-if="!assignments || assignments.length === 0" 
                    class="h-full flex flex-col items-center justify-center text-gray-400 text-sm italic border-2 border-dashed border-gray-300 rounded-lg p-4 bg-white">
                    <UserPlus :size="32" class="mb-2 opacity-50" />
                    <p>{{ t('deployment.assignment.dropZone') }}</p>
                  </div>
                  
                  <div v-else class="space-y-2">
                    <div v-for="studentId in assignments" 
                      :key="studentId"
                      draggable="true"
                      @dragstart="(e) => handleDragStart(studentId, e)"
                      @dragend="handleDragEnd"
                      class="group bg-white rounded-lg px-3 py-2.5 border-2 border-gray-200 cursor-move hover:border-emerald-400 hover:shadow-lg hover:scale-[1.02] transition-all flex items-center gap-2">
                      <GripVertical :size="16" class="text-gray-400 group-hover:text-emerald-600 transition-colors flex-shrink-0" />
                      <span class="font-semibold text-gray-700 group-hover:text-gray-900 flex-1 text-sm transition-colors">
                        {{
                          (() => {
                            const s = studentCache[studentId]
                            if (!s) return studentId;
                            if (s.firstName || s.lastName) return `${s.firstName || ''} ${s.lastName || ''}`.trim();
                            if (s.username) return s.username;
                            if (s.email) return s.email;
                            return studentId;
                          })()
                        }}
                      </span>
                      <button
                        @click="removeFromGroup(studentId, index)"
                        data-testid="btn-remove-student"
                        class="opacity-0 group-hover:opacity-100 transition-all p-1.5 hover:bg-red-100 rounded-lg"
                        :title="t('deployment.assignment.removeStudent')">
                        <X :size="14" class="text-red-600" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- Footer -->
      <div class="flex justify-between items-center p-6 pt-4 bg-white border-t-2 border-gray-200">
        <button
          @click="handleBack"
          data-testid="btn-back"
          class="flex items-center gap-2 px-8 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-all shadow-md">
          <ArrowLeft :size="20" />
          {{ t('deployment.actions.back') }}
        </button>
        
        <div class="text-center">
          <p class="text-sm text-gray-500 mb-1">{{ t('deployment.assignment.progress') }}</p>
          <p class="text-lg font-bold text-emerald-600">
            {{ t('deployment.assignment.assignedCount', { assigned: totalStudents - unassignedStudents.length, total: totalStudents }) }}
          </p>
        </div>
        
        <button
          @click="handleNext"
          data-testid="btn-next"
          :disabled="unassignedStudents.length > 0 || (store.draft.assignments as string[][]).slice(0, groupCount).some((g: string[]) => !g || g.length === 0) || groupNames.slice(0, groupCount).some((name: string) => !name || name.trim() === '')"
          class="flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed">
          {{ t('deployment.actions.next') }}
          <ArrowRight :size="20" />
        </button>
      </div>

    </div>
  </div>
</template>
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { GraduationCap, Trash2, Plus, Users, Search, ChevronRight } from 'lucide-react'
import { useCourseStore } from '@/stores/course.store'
import { useToast } from '@/composables/useToast'
import { extractErrorMessage } from '@/utils/http-error'
import { useRole } from '@/composables/useRole'
import { courseApi } from '@/api/course.api'
import { translateHtml } from '@/i18n/html'
import { paths } from '@/router/paths'
import Card from '@/components/ui/Card'
import BaseButton from '@/components/ui/BaseButton'
import BaseInput from '@/components/ui/BaseInput'
import Modal from '@/components/ui/Modal'
import PageHeader from '@/components/ui/PageHeader'
import EntityListState from '@/components/ui/EntityListState'
import './CoursesView.css'

export default function CoursesView() {
  const { t } = useTranslation()
  const toast = useToast()
  const navigate = useNavigate()
  const courses = useCourseStore((s) => s.courses)
  const isLoading = useCourseStore((s) => s.isLoading)
  // Permission mirror: course CRUD is staff-only in the UI (the backend still
  // enforces course-teacher membership on edit/delete). ``isStaff`` covers
  // teacher + admin.
  const { isStaff } = useRole()

  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [courseName, setCourseName] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [courseToDelete, setCourseToDelete] = useState<{ courseId: string; name: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({})

  const filteredCourses = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase()
    return courses.filter((c) => c.name.toLocaleLowerCase().includes(q))
  }, [courses, searchQuery])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const store = useCourseStore.getState()
        await store.fetchCourses()
        if (isStaff) {
          const list = useCourseStore.getState().courses
          const entries = await Promise.all(
            list.map(async (c) => {
              try {
                const { data } = await courseApi.listMembers(c.courseId)
                return [c.courseId, data.length] as const
              } catch {
                return [c.courseId, 0] as const
              }
            }),
          )
          if (!cancelled) setMemberCounts(Object.fromEntries(entries))
        }
      } catch {
        if (!cancelled) toast.error(t('CoursesView.toasts.loadError'))
      }
    })()
    return () => {
      cancelled = true
    }
    // Mount-only load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openCreateModal = () => {
    setCourseName('')
    setShowModal(true)
  }

  const saveCourse = async () => {
    try {
      const created = await useCourseStore.getState().createCourse({ name: courseName })
      toast.success(t('CoursesView.toasts.createSuccess'))
      setShowModal(false)
      // Navigate to the detail page right after creation.
      if (created?.courseId) navigate(paths.course(created.courseId))
    } catch (error) {
      toast.error(extractErrorMessage(error, t('CoursesView.toasts.createError')))
    }
  }

  const requestDelete = (course: { courseId: string; name: string }) => {
    setCourseToDelete(course)
    setShowDeleteModal(true)
  }

  const closeDeleteModal = () => {
    if (isDeleting) return
    setShowDeleteModal(false)
    setCourseToDelete(null)
  }

  const confirmDelete = async () => {
    if (!courseToDelete) return
    const { courseId } = courseToDelete
    setIsDeleting(true)
    try {
      await useCourseStore.getState().deleteCourse(courseId)
      setMemberCounts((m) => {
        const next = { ...m }
        delete next[courseId]
        return next
      })
      toast.success(t('CoursesView.toasts.deleteSuccess'))
      setShowDeleteModal(false)
      setCourseToDelete(null)
    } catch (error) {
      toast.error(extractErrorMessage(error, t('CoursesView.toasts.deleteError')))
    } finally {
      setIsDeleting(false)
    }
  }

  const createButton = isStaff ? (
    <BaseButton onClick={openCreateModal} className="flex items-center gap-2">
      <Plus size={16} />
      {t('CoursesView.newCourse')}
    </BaseButton>
  ) : null

  return (
    <div className="app-page">
      <PageHeader
        eyebrow={t('nav.courses')}
        title={t('CoursesView.title')}
        subtitle={t('CoursesView.subtitle')}
        actions={
          <>
            <label className="search-field">
              <Search size={16} aria-hidden="true" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                type="search"
                placeholder={t('workspace.searchCourses')}
                aria-label={t('workspace.searchCourses')}
              />
            </label>
            {createButton}
          </>
        }
      />

      <div className="catalog-tabs">
        <span className="catalog-tab" aria-pressed="true">
          {t('workspace.allCourses')} <span className="catalog-count">{courses.length}</span>
        </span>
      </div>

      <EntityListState
        isLoading={isLoading && courses.length === 0}
        isEmpty={!isLoading && filteredCourses.length === 0}
        icon={GraduationCap}
        emptyMessage={t('CoursesView.noCourses')}
        loadingMessage={t('CoursesView.loading')}
        emptyAction={
          isStaff ? <BaseButton onClick={openCreateModal}>{t('CoursesView.createFirst')}</BaseButton> : null
        }
      >
        <div className="course-list">
          {filteredCourses.map((course, index) => {
            const count = memberCounts[course.courseId] ?? 0
            return (
              <Card key={course.courseId} className="course-row">
                <Link to={paths.course(course.courseId)} className="course-link">
                  <span className="course-icon" data-tone={index % 4}>
                    <GraduationCap size={25} strokeWidth={1.5} />
                  </span>
                  <span className="course-copy">
                    <span className="course-name">{course.name}</span>
                    {isStaff ? (
                      <span className="course-caption">
                        <Users size={13} /> {count}{' '}
                        {count === 1 ? t('CoursesView.memberSingular') : t('CoursesView.memberPlural')}
                      </span>
                    ) : (
                      <span className="course-caption">{t('CoursesView.openToView')}</span>
                    )}
                  </span>
                  <ChevronRight size={18} className="ml-auto text-textMuted" />
                </Link>
                {isStaff ? (
                  <button
                    type="button"
                    className="course-delete"
                    onClick={() => requestDelete(course)}
                    aria-label={t('CoursesView.deleteTitle')}
                  >
                    <Trash2 size={16} />
                  </button>
                ) : null}
              </Card>
            )
          })}
        </div>
      </EntityListState>

      <Modal
        show={showModal}
        onClose={() => setShowModal(false)}
        header={<h2 className="text-xl font-semibold">{t('CoursesView.createModal.title')}</h2>}
        body={
          <div className="space-y-5">
            <p className="text-sm text-textMuted">{t('CoursesView.createModal.intro')}</p>
            <div>
              <label className="block text-sm font-medium text-textMuted mb-1.5">
                {t('CoursesView.createModal.nameLabel')}
              </label>
              <BaseInput
                value={courseName}
                onChange={setCourseName}
                placeholder={t('CoursesView.createModal.namePlaceholder')}
                required
                onKeyUp={(e) => {
                  if (e.key === 'Enter' && courseName) void saveCourse()
                }}
              />
            </div>
          </div>
        }
        footer={
          <div className="flex justify-end gap-3">
            <BaseButton variant="text" onClick={() => setShowModal(false)}>
              {t('CoursesView.createModal.cancel')}
            </BaseButton>
            <BaseButton onClick={() => void saveCourse()} disabled={!courseName}>
              {t('CoursesView.createModal.create')}
            </BaseButton>
          </div>
        }
      />

      <Modal
        show={showDeleteModal}
        onClose={closeDeleteModal}
        header={<h2 className="text-xl font-semibold text-red-700">{t('CoursesView.deleteModal.title')}</h2>}
        body={
          <div className="space-y-3">
            <p
              className="text-textMuted"
              dangerouslySetInnerHTML={{
                __html: translateHtml('CoursesView.deleteModal.confirmPrompt', { name: courseToDelete?.name ?? '' }, t),
              }}
            />
            <p className="text-sm text-textMuted">{t('CoursesView.deleteModal.warning')}</p>
          </div>
        }
        footer={
          <div className="flex justify-end gap-3">
            <BaseButton variant="text" onClick={closeDeleteModal} disabled={isDeleting}>
              {t('CoursesView.deleteModal.cancel')}
            </BaseButton>
            <BaseButton variant="destructive" onClick={() => void confirmDelete()} disabled={isDeleting}>
              {isDeleting ? t('CoursesView.deleteModal.deleting') : t('CoursesView.deleteModal.delete')}
            </BaseButton>
          </div>
        }
      />
    </div>
  )
}

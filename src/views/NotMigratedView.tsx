/**
 * Placeholder for views that have not been ported from Vue to React yet.
 * Removed together with the last usage in `router/index.tsx`.
 */
export default function NotMigratedView({ name }: { name: string }) {
  return (
    <div role="status" className="p-8 text-textMuted">
      <p className="font-medium">{name}</p>
      <p className="text-sm">This view has not been migrated to React yet.</p>
    </div>
  )
}

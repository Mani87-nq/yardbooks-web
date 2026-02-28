/**
 * Employee Portal route group layout.
 * Minimal wrapper — no dashboard sidebar/nav.
 * Full-screen, kiosk-friendly container.
 *
 * Auth is NOT enforced here (handled per-page) because the login page
 * is also inside this group and must be publicly accessible.
 */
export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {children}
    </div>
  );
}

/**
 * Employee Portal route group layout.
 * Minimal wrapper — no dashboard sidebar/nav.
 * Full-screen, kiosk-friendly container.
 *
 * Auth is NOT enforced here (handled per-page) because the login page
 * is also inside this group and must be publicly accessible.
 *
 * `force-dynamic` is required so that middleware's CSP nonce (set via the
 * `x-nonce` request header) is available to the server renderer. Without
 * this, Next.js statically generates the pages at build time, where no
 * request headers exist → inline scripts have no nonce → CSP blocks them
 * → React cannot hydrate → pages stuck on "Loading…" in production.
 */
export const dynamic = 'force-dynamic';

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

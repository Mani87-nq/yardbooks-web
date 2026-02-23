import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DashboardLayoutClient } from './DashboardLayoutClient';

export default async function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side auth check
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken')?.value;
  
  // No token = redirect to login
  if (!accessToken) {
    redirect('/login');
  }
  
  return <DashboardLayoutClient>{children}</DashboardLayoutClient>;
}

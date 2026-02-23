import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken')?.value;
  
  // If user has a token, go to dashboard (middleware will validate it)
  // If not, go to login
  if (accessToken) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}

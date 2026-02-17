'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/appStore';

export default function HomePage() {
  const router = useRouter();
  const { user } = useAppStore();

  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  }, [user, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-2xl mx-auto mb-4">
          YB
        </div>
        <p className="text-gray-500">Loading YardBooks...</p>
      </div>
    </div>
  );
}

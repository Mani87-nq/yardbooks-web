'use client';

import { useRouter } from 'next/navigation';
import { useKioskPosStore } from '@/store/kioskPosStore';

export default function NewSaleWidget() {
  const router = useRouter();
  const { currentSession } = useKioskPosStore();

  return (
    <button
      onClick={() => router.push('/employee/pos')}
      className="w-full bg-gradient-to-br from-blue-500 to-blue-700 dark:from-blue-600 dark:to-blue-800 rounded-2xl p-5 text-white text-left shadow-sm hover:shadow-md active:scale-[0.98] touch-manipulation transition-all"
    >
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-bold">New Sale</h3>
          <p className="text-sm text-white/70">
            {currentSession ? 'Session open — ready to sell' : 'Open a session to start'}
          </p>
        </div>
        <svg className="w-5 h-5 ml-auto text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}

'use client';

/**
 * Reusable loading skeleton components for YaadBooks.
 */

function Shimmer({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-gray-200 rounded ${className}`}
    />
  );
}

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex gap-4 p-4 border-b border-gray-200">
        {Array.from({ length: columns }).map((_, i) => (
          <Shimmer key={`th-${i}`} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={`row-${rowIdx}`} className="flex gap-4 p-4 border-b border-gray-100">
          {Array.from({ length: columns }).map((_, colIdx) => (
            <Shimmer key={`cell-${rowIdx}-${colIdx}`} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <Shimmer className="h-5 w-1/3" />
      <Shimmer className="h-8 w-1/2" />
      <Shimmer className="h-4 w-2/3" />
    </div>
  );
}

export function CardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={`card-${i}`} />
      ))}
    </div>
  );
}

export function FormSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <div className="space-y-6 max-w-2xl">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={`field-${i}`} className="space-y-2">
          <Shimmer className="h-4 w-24" />
          <Shimmer className="h-10 w-full" />
        </div>
      ))}
      <Shimmer className="h-10 w-32 mt-4" />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Shimmer className="h-8 w-48" />
          <Shimmer className="h-4 w-64" />
        </div>
        <Shimmer className="h-10 w-32" />
      </div>
      {/* Stat cards */}
      <CardGridSkeleton />
      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <TableSkeleton />
      </div>
    </div>
  );
}

export default PageSkeleton;

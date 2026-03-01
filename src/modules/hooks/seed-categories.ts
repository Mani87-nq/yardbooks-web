/**
 * Module Activation Hook — Seed Default Categories
 *
 * Listens for `module.activated` events and creates default categories
 * for restaurant (MenuCategory) and salon (SalonServiceCategory) modules.
 *
 * Idempotent: uses `skipDuplicates` so re-activating a module won't
 * create duplicate categories.
 */
import { eventBus } from '@/modules/event-bus';
import { prisma } from '@/lib/db';
import {
  RESTAURANT_DEFAULT_CATEGORIES,
  SALON_DEFAULT_CATEGORIES,
} from '@/lib/defaults/industry-categories';

/**
 * Register the category seed handler on the event bus.
 * Call this once at module init time.
 */
export function registerCategorySeedHandler(): void {
  eventBus.on(
    'module.activated',
    async (payload) => {
      const { moduleId, companyId } = payload;

      try {
        if (moduleId === 'restaurant') {
          await seedRestaurantCategories(companyId);
        } else if (moduleId === 'salon') {
          await seedSalonCategories(companyId);
        }
      } catch (error) {
        // Log but don't throw — category seeding failure shouldn't
        // block module activation
        console.error(
          `[seed-categories] Failed to seed default categories for module "${moduleId}":`,
          error
        );
      }
    },
    'core'
  );
}

async function seedRestaurantCategories(companyId: string): Promise<void> {
  // Check if any categories already exist
  const existing = await (prisma as any).menuCategory.count({
    where: { companyId },
  });

  if (existing > 0) {
    // Don't overwrite user-created categories
    return;
  }

  await (prisma as any).menuCategory.createMany({
    data: RESTAURANT_DEFAULT_CATEGORIES.map((cat) => ({
      companyId,
      name: cat.name,
      sortOrder: cat.sortOrder,
      isActive: true,
    })),
    skipDuplicates: true,
  });

  console.log(
    `[seed-categories] Seeded ${RESTAURANT_DEFAULT_CATEGORIES.length} menu categories for company ${companyId}`
  );
}

async function seedSalonCategories(companyId: string): Promise<void> {
  // Check if any categories already exist
  const existing = await (prisma as any).salonServiceCategory.count({
    where: { companyId },
  });

  if (existing > 0) {
    return;
  }

  await (prisma as any).salonServiceCategory.createMany({
    data: SALON_DEFAULT_CATEGORIES.map((cat) => ({
      companyId,
      name: cat.name,
      sortOrder: cat.sortOrder,
      isActive: true,
    })),
    skipDuplicates: true,
  });

  console.log(
    `[seed-categories] Seeded ${SALON_DEFAULT_CATEGORIES.length} salon service categories for company ${companyId}`
  );
}

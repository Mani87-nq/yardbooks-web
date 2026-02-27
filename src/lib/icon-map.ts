/**
 * Shared HeroIcon name → component map.
 *
 * Module manifests reference icons by string name (e.g. "ScissorsIcon").
 * This map resolves those strings to actual React components.
 *
 * Used by: Sidebar, ModuleCard, and any other component that needs
 * to render icons from manifest data.
 */
import {
  HomeIcon,
  ShoppingCartIcon,
  DocumentTextIcon,
  UserGroupIcon,
  CubeIcon,
  BanknotesIcon,
  BookOpenIcon,
  WrenchScrewdriverIcon,
  UsersIcon,
  BuildingLibraryIcon,
  ChartBarIcon,
  SparklesIcon,
  Cog6ToothIcon,
  ClockIcon,
  CalendarDaysIcon,
  StarIcon,
  TagIcon,
  IdentificationIcon,
  Squares2X2Icon,
  FireIcon,
  BuildingStorefrontIcon,
  ShoppingBagIcon,
  ScissorsIcon,
  ArrowRightStartOnRectangleIcon,
  Square3Stack3DIcon,
  MapPinIcon,
  PuzzlePieceIcon,
} from '@heroicons/react/24/outline';

export const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  HomeIcon,
  ShoppingCartIcon,
  DocumentTextIcon,
  UserGroupIcon,
  CubeIcon,
  BanknotesIcon,
  BookOpenIcon,
  WrenchScrewdriverIcon,
  UsersIcon,
  BuildingLibraryIcon,
  ChartBarIcon,
  SparklesIcon,
  Cog6ToothIcon,
  ClockIcon,
  CalendarDaysIcon,
  StarIcon,
  TagIcon,
  IdentificationIcon,
  Squares2X2Icon,
  FireIcon,
  BuildingStorefrontIcon,
  ShoppingBagIcon,
  ScissorsIcon,
  ArrowRightStartOnRectangleIcon,
  Square3Stack3DIcon,
  MapPinIcon,
  PuzzlePieceIcon,
};

/** Fallback icon when a manifest references an unknown icon name. */
export const FallbackIcon = PuzzlePieceIcon;

/**
 * Resolve an icon string name to its component, with fallback.
 */
export function resolveIcon(iconName: string): React.ComponentType<{ className?: string }> {
  return ICON_MAP[iconName] || FallbackIcon;
}

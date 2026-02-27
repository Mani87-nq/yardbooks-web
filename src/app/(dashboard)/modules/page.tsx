import { ModuleMarketplace } from '@/components/modules/ModuleMarketplace';

export const metadata = {
  title: 'Module Marketplace — YaadBooks',
  description: 'Browse and activate industry modules to extend your YaadBooks platform.',
};

export default function ModulesPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <ModuleMarketplace />
    </div>
  );
}

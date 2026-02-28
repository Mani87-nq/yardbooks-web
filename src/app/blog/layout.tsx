import MarketingNav from '@/components/marketing/MarketingNav';
import MarketingFooter from '@/components/marketing/MarketingFooter';

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <MarketingNav activeLink="blog" />
      <main className="pt-16">{children}</main>
      <MarketingFooter />
    </div>
  );
}

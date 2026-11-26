import { MobileTabBar, SiteFooter, SiteHeader } from "@/components/layout/site-header";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="pb-20 lg:pb-0">
        {children}
      </main>
      <SiteFooter />
      <MobileTabBar />
    </>
  );
}

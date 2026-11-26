import { RequireAuth } from "@/components/layout/auth-guards";
import { MobileTabBar, SiteHeader } from "@/components/layout/site-header";

export default function TravelerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="pb-24 lg:pb-12">
        <RequireAuth>{children}</RequireAuth>
      </main>
      <MobileTabBar />
    </>
  );
}

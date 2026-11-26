import Image from "next/image";
import { Logo } from "@/components/layout/site-header";
import { RedirectIfAuthed } from "@/components/layout/auth-guards";

// Hampi, Karnataka — Wikimedia Commons (CC BY-SA). Swap via NEXT_PUBLIC_AUTH_IMAGE.
const AUTH_IMAGE =
  process.env.NEXT_PUBLIC_AUTH_IMAGE ??
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/dd/Wide_angle_of_Galigopuram_of_Virupaksha_Temple%2C_Hampi_%2804%29_%28cropped%29.jpg/1280px-Wide_angle_of_Galigopuram_of_Virupaksha_Temple%2C_Hampi_%2804%29_%28cropped%29.jpg";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <Logo />
        <main id="main" className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <RedirectIfAuthed>{children}</RedirectIfAuthed>
          </div>
        </main>
      </div>
      <div className="relative hidden overflow-hidden bg-forest lg:block">
        <Image src={AUTH_IMAGE} alt="Stone temple towers at Hampi at golden hour" fill sizes="55vw" className="object-cover opacity-85" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-forest/80 via-forest/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-12 text-on-forest">
          <p className="max-w-md font-display text-3xl font-semibold leading-tight text-white">
            Plan the trip. Keep the plan. Remember the trip.
          </p>
          <p className="mt-3 max-w-md text-sm text-white/75">
            Itineraries, maps, budgets and packing lists, together in one place.
          </p>
        </div>
      </div>
    </div>
  );
}

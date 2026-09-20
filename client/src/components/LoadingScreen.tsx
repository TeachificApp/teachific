import { Clapperboard } from "lucide-react";
import { COURSE360_PLATFORM_LOGO_ALT, COURSE360_PLATFORM_LOGO_URL } from "@/config/platformBrand";

/**
 * Full-page branded loading screen shown while auth state resolves.
 * Displays a spinning clapperboard icon and "Lights, camera, learning..." in teal.
 */
export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white gap-5">
      {/* Spinning clapperboard */}
      <div className="relative flex items-center justify-center">
        {/* Outer pulsing ring */}
        <span className="absolute inline-flex h-20 w-20 rounded-full bg-teal-400/20 animate-ping" />
        {/* Icon wrapper — spins */}
        <span
          className="relative inline-flex h-16 w-16 items-center justify-center rounded-full bg-teal-50"
          style={{ animation: "spin 1.8s linear infinite" }}
        >
          <Clapperboard className="h-8 w-8 text-teal-500" strokeWidth={1.5} />
        </span>
      </div>

      <img src={COURSE360_PLATFORM_LOGO_URL} alt={COURSE360_PLATFORM_LOGO_ALT} className="h-24 w-24 object-contain" />

      {/* Tagline */}
      <p
        className="text-sm font-semibold tracking-wide text-teal-500"
        style={{ animation: "pulse 2s ease-in-out infinite" }}
      >
        Lights, camera, learning…
      </p>
    </div>
  );
}

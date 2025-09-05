"use client";

import React, { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { MapPin, Map, Route, RefreshCw, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * leafet-map.tsx
 *
 * Wrapper yang melakukan dynamic import pada komponen map (google-maps-client).
 * Tujuan:
 * - Hindari SSR rendering error (maps APIs only run in browser).
 * - Tambahkan controls overlay (mode pick, mode dest, toggle route).
 * - Forward semua props ke Map component sambil menambahkan beberapa props kontrol.
 *
 * UPDATED: Sekarang menggunakan Google Maps Platform sebagai pengganti OpenStreetMap
 */

/* Dynamic import: google-maps-client.tsx */
const MapComponent = dynamic(() => import("./google-maps-client"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-80 rounded-lg bg-slate-100 flex items-center justify-center">
      <span className="text-sm text-slate-500">Loading map…</span>
    </div>
  ),
});

type MapWrapperProps = {
  // Terima prop apapun dan teruskan ke MapComponent.
  // Kamu bisa mengganti `any` dengan tipe spesifik yang cocok untuk project-mu.
  [key: string]: any;
};

export default function LeafletMapWrapper(props: MapWrapperProps) {
  // Local control state
  const [mapClickMode, setMapClickMode] = useState<"pickup" | "destination" | null>(null);
  const [showRoute, setShowRoute] = useState<boolean>(true);
  const [resetToggle, setResetToggle] = useState<number>(0); // simple counter to trigger child reset if needed

  // Toggle pickup/destination click mode (only one active at a time)
  const toggleMode = useCallback((mode: "pickup" | "destination") => {
    setMapClickMode((prev) => (prev === mode ? null : mode));
  }, []);

  const handleReset = useCallback(() => {
    // Increase counter so child can use as key or effect dependency to reset internal UI.
    setResetToggle((s) => s + 1);
    // Also reset controls
    setMapClickMode(null);
    // Optionally, if parent passed any callbacks to clear selection, call them here
    if (typeof props.onReset === "function") {
      try { props.onReset(); } catch {}
    }
  }, [props]);

  // Memoize props passed to MapComponent to avoid excessive re-renders
  const forwardedProps = useMemo(() => {
    return {
      ...props,
      // Add our control props
      mapClickMode,
      showRoute,
      // Pass a reset token so child can clear local inputs when this value changes
      resetToken: resetToggle,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props, mapClickMode, showRoute, resetToggle]);

  return (
    <div className="relative w-full h-full min-h-[320px] rounded-lg overflow-hidden">
      {/* Google Maps */}
      <MapComponent
        {...forwardedProps}
        currentLocation={props.currentLocation}
      />

      {/* Controls overlay */}
      <div
        className="absolute left-4 top-4 z-50"
        style={{ pointerEvents: "auto" }}
      >
        <div className="bg-white/95 p-2 rounded-lg shadow-md w-[260px]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                title={mapClickMode === "pickup" ? "Batalkan mode pickup" : "Mode pilih pickup"}
                onClick={() => toggleMode("pickup")}
                className={`flex items-center gap-2 px-2 py-1 rounded-md border ${
                  mapClickMode === "pickup" ? "border-indigo-600 bg-indigo-50" : "border-gray-200 bg-white"
                }`}
                aria-pressed={mapClickMode === "pickup"}
                type="button"
              >
                <MapPin size={16} />
                <span className="text-sm">Pickup</span>
              </button>

              <button
                title={mapClickMode === "destination" ? "Batalkan mode tujuan" : "Mode pilih tujuan"}
                onClick={() => toggleMode("destination")}
                className={`flex items-center gap-2 px-2 py-1 rounded-md border ${
                  mapClickMode === "destination" ? "border-rose-600 bg-rose-50" : "border-gray-200 bg-white"
                }`}
                aria-pressed={mapClickMode === "destination"}
                type="button"
              >
                <Route size={16} />
                <span className="text-sm">Tujuan</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                title={showRoute ? "Sembunyikan rute" : "Tampilkan rute"}
                onClick={() => setShowRoute((s) => !s)}
                className="p-2 rounded-md border border-gray-200 bg-white"
                type="button"
                aria-pressed={showRoute}
              >
                {showRoute ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>

              <button
                title="Reset input / markers"
                onClick={handleReset}
                className="p-2 rounded-md border border-gray-200 bg-white"
                type="button"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

          {/* Optional hint line */}
          <div className="mt-2 text-xs text-slate-500">
            Klik peta untuk memilih lokasi bila mode aktif. Menggunakan Google Maps Platform.
          </div>
        </div>
      </div>
    </div>
  );
}
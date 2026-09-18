"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { PublicLocation } from "@/shared/interfaces/Domain";
import { collectPinCategories } from "@/shared/lib/mapPins";
import { EmptyState, Spinner } from "@/shared/components/ui";
import { MapLegend } from "@/shared/components/map/MapLegend";
import { LocationEditModal } from "@/app/admin/kaart/LocationEditModal";
import { CreatePinModal } from "@/app/admin/kaart/CreatePinModal";

// MapView imports react-leaflet/leaflet, which touch `window` at module-evaluation
// time — it must never reach the server bundle, hence ssr:false rather than just a
// "use client" directive.
const MapView = dynamic(
  () => import("@/shared/components/map/MapView").then((mod) => mod.MapView),
  { ssr: false, loading: () => <Spinner label="Kaart laai tans..." /> },
);

export function KaartClient({ locations }: { locations: PublicLocation[] }) {
  const categories = useMemo(() => collectPinCategories(locations), [locations]);
  const [activeSlugs, setActiveSlugs] = useState<Set<string> | null>(null);
  const [editingPin, setEditingPin] = useState<PublicLocation | null>(null);
  const [creatingAt, setCreatingAt] = useState<{ lat: number; lng: number } | null>(null);

  const visibleLocations = useMemo(() => {
    if (activeSlugs === null) return locations;
    return locations.filter((location) => activeSlugs.has(location.categorySlug));
  }, [locations, activeSlugs]);

  function toggleCategory(slug: string) {
    setActiveSlugs((current) => {
      const base = current ?? new Set(categories.map((category) => category.categorySlug));
      const next = new Set(base);

      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }

      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {locations.length === 0 && <EmptyState message="Nog geen liggings nie." />}

      {categories.length > 1 && (
        <MapLegend categories={categories} activeSlugs={activeSlugs} onToggle={toggleCategory} />
      )}

      <p className="text-xs text-(--text-secondary)">
        Klik &apos;n oop plek op die kaart om &apos;n nuwe punt te skep, of &apos;n bestaande punt
        en dan &quot;Wysig ligging&quot; om dit te verskuif of te verwyder.
      </p>

      <div className="h-[60vh] min-h-80 overflow-hidden rounded-lg border border-(--panel-border) sm:h-[70vh]">
        <MapView
          locations={visibleLocations}
          onEdit={setEditingPin}
          // Disabled while a pin is already open for editing or creation — a stray
          // click meant for that dialog (or its own mini map picker) must never also
          // register as "start a new pin" on the map underneath it.
          onCreate={
            editingPin === null && creatingAt === null
              ? (lat, lng) => setCreatingAt({ lat, lng })
              : undefined
          }
        />
      </div>

      <LocationEditModal pin={editingPin} onClose={() => setEditingPin(null)} />
      <CreatePinModal coordinates={creatingAt} onClose={() => setCreatingAt(null)} />
    </div>
  );
}

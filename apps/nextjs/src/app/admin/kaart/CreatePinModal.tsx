"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Field,
  Input,
  Select,
  Spinner,
  Textarea,
} from "@/shared/components/ui";
import { Modal } from "@/shared/components/Modal";
import { AssetType, Visibility } from "@/shared/interfaces/Domain";
import { ASSET_TYPE_LABELS } from "@/shared/lib/assetTypeLabels";
import { getSafeUserMessageFromUnknownError } from "@/shared/lib/apiError";
import { getCategories } from "@/shared/services/adminService";
import { createContent, createLocation, type ContentInput } from "@/shared/services/contentService";

// LocationMapPicker imports react-leaflet/leaflet, which touch `window` at
// module-evaluation time — it must never reach the server bundle, hence ssr:false
// rather than just a "use client" directive (same reasoning as KaartClient).
const LocationMapPicker = dynamic(
  () => import("@/shared/components/map/LocationMapPicker").then((mod) => mod.LocationMapPicker),
  { ssr: false, loading: () => <Spinner label="Kaart laai tans..." /> },
);

type NewPinForm = {
  title: string;
  categoryId: number;
  description: string | null;
  assetType: AssetType;
  assetReference: string | null;
  latitude: number;
  longitude: number;
};

/**
 * Opened by clicking empty map space on the admin map. A pin is a content item that
 * has coordinates (see CLAUDE.md) — there's no combined "create a pin" endpoint, so
 * this creates the Content item first and then attaches a LocationDetail to it. If
 * the second call fails, the content item is left behind without a location; it can
 * still be found and given one from `/admin/inhoud` → "Ligging".
 */
export function CreatePinModal({
  coordinates,
  onClose,
}: {
  coordinates: { lat: number; lng: number } | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<NewPinForm | null>(null);
  const [openedAt, setOpenedAt] = useState<{ lat: number; lng: number } | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
    enabled: coordinates !== null,
  });

  // "Adjusting state when a prop changes" (react.dev): seed the form once per open,
  // from the clicked point and the first available category — not on every render.
  if (coordinates && (openedAt?.lat !== coordinates.lat || openedAt?.lng !== coordinates.lng)) {
    setOpenedAt(coordinates);
    setForm({
      title: "",
      categoryId: categoriesQuery.data?.[0]?.id ?? 0,
      description: null,
      assetType: AssetType.None,
      assetReference: null,
      latitude: coordinates.lat,
      longitude: coordinates.lng,
    });
    setFeedback(null);
  } else if (!coordinates && openedAt !== null) {
    setOpenedAt(null);
    setForm(null);
  }

  // Categories load asynchronously and may still be empty when the block above first
  // seeds the form — pick up the default once they arrive, but only if the admin
  // hasn't already chosen one (categoryId is still the unset placeholder).
  if (form && form.categoryId === 0 && categoriesQuery.data && categoriesQuery.data.length > 0) {
    setForm({ ...form, categoryId: categoriesQuery.data[0].id });
  }

  const createMutation = useMutation({
    mutationFn: async (input: NewPinForm) => {
      const contentInput: ContentInput = {
        categoryId: input.categoryId,
        title: input.title,
        description: input.description,
        body: null,
        assetType: input.assetType,
        assetReference: input.assetReference,
        // A pin created from the map is meant to be visible immediately — the API
        // only ever includes a location in the public feed when its content has a
        // past PublishedAt (LocationDetailRepository.cs), so leaving this null would
        // create an invisible draft.
        publishedAt: new Date().toISOString(),
        unpublishedAt: null,
        eventStart: null,
        eventEnd: null,
        recurrence: null,
        visibility: Visibility.Public,
        visibleToRoles: [],
      };

      const content = await createContent(contentInput);
      await createLocation({
        contentId: content.id,
        latitude: input.latitude,
        longitude: input.longitude,
        label: null,
        addressLine: null,
        notes: null,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["public-locations"] });
      void queryClient.invalidateQueries({ queryKey: ["content"] });
      onClose();
    },
    onError: (error) => setFeedback(getSafeUserMessageFromUnknownError(error)),
  });

  const categories = categoriesQuery.data ?? [];
  const isRangeValid = form
    ? form.latitude >= -90 && form.latitude <= 90 && form.longitude >= -180 && form.longitude <= 180
    : false;
  const canSave = !!form && form.title.trim().length > 0 && form.categoryId !== 0 && isRangeValid;

  return (
    <Modal
      isOpen={coordinates !== null}
      title="Nuwe punt op die kaart"
      onClose={onClose}
      footer={
        form && (
          <>
            <Button variant="secondary" onClick={onClose}>
              Kanselleer
            </Button>
            <Button
              onClick={() => form && createMutation.mutate(form)}
              disabled={!canSave || createMutation.isPending}
            >
              {createMutation.isPending ? "Skep tans..." : "Skep punt"}
            </Button>
          </>
        )
      }
    >
      {feedback && <Alert tone="danger">{feedback}</Alert>}

      {!form || categoriesQuery.isLoading ? (
        <Spinner />
      ) : categories.length === 0 ? (
        <Alert tone="warning">Skep eers &apos;n kategorie voordat jy &apos;n punt byvoeg.</Alert>
      ) : (
        <div className="flex flex-col gap-4">
          <LocationMapPicker
            latitude={form.latitude}
            longitude={form.longitude}
            onPick={(latitude, longitude) => setForm({ ...form, latitude, longitude })}
          />

          <Field label="Titel" htmlFor="new-pin-title">
            <Input
              id="new-pin-title"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </Field>

          <Field label="Kategorie" htmlFor="new-pin-category">
            <Select
              id="new-pin-category"
              value={form.categoryId}
              onChange={(event) => setForm({ ...form, categoryId: Number(event.target.value) })}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Beskrywing" htmlFor="new-pin-description">
            <Textarea
              id="new-pin-description"
              rows={2}
              value={form.description ?? ""}
              onChange={(event) => setForm({ ...form, description: event.target.value || null })}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Mediatipe" htmlFor="new-pin-assetType">
              <Select
                id="new-pin-assetType"
                value={form.assetType}
                onChange={(event) =>
                  setForm({ ...form, assetType: Number(event.target.value) as AssetType })
                }
              >
                {Object.entries(ASSET_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Mediaverwysing" htmlFor="new-pin-assetReference" hint="Beeld-URL, S3-sleutel of YouTube-id.">
              <Input
                id="new-pin-assetReference"
                value={form.assetReference ?? ""}
                onChange={(event) =>
                  setForm({ ...form, assetReference: event.target.value || null })
                }
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Breedtegraad"
              htmlFor="new-pin-latitude"
              error={!isRangeValid ? "Moet tussen -90 en 90 wees." : undefined}
            >
              <Input
                id="new-pin-latitude"
                type="number"
                step="0.000001"
                min={-90}
                max={90}
                value={form.latitude}
                onChange={(event) => setForm({ ...form, latitude: Number(event.target.value) })}
              />
            </Field>
            <Field
              label="Lengtegraad"
              htmlFor="new-pin-longitude"
              error={!isRangeValid ? "Moet tussen -180 en 180 wees." : undefined}
            >
              <Input
                id="new-pin-longitude"
                type="number"
                step="0.000001"
                min={-180}
                max={180}
                value={form.longitude}
                onChange={(event) => setForm({ ...form, longitude: Number(event.target.value) })}
              />
            </Field>
          </div>
        </div>
      )}
    </Modal>
  );
}

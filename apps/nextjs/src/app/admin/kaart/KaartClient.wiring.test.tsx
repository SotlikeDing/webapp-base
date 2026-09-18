import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { PublicLocation } from "@/shared/interfaces/Domain";
import { KaartClient } from "@/app/admin/kaart/KaartClient";

// MapView itself (react-leaflet/leaflet, real tile rendering, marker interaction) and
// LocationEditModal's own map picker are explicitly out of scope for automated tests
// — see the plan's Testing section. Stubbing next/dynamic (hoisted above this file's
// imports by vitest) keeps this file from ever touching Leaflet.
vi.mock("next/dynamic", () => ({
  default: () => MapStub,
}));

function MapStub({
  locations,
  onEdit,
  onCreate,
}: {
  locations: PublicLocation[];
  onEdit?: (location: PublicLocation) => void;
  onCreate?: (latitude: number, longitude: number) => void;
}) {
  return (
    <div data-testid="map-stub">
      {locations.map((location) => location.name).join(",")}
      {onEdit && locations[0] && (
        <button type="button" onClick={() => onEdit(locations[0])}>
          Wysig ligging (toets)
        </button>
      )}
      {onCreate && (
        <button type="button" onClick={() => onCreate(-25.7, 28.1)}>
          Klik oop plek (toets)
        </button>
      )}
    </div>
  );
}

// LocationEditModal and CreatePinModal both pull in react-query mutations and their
// own dynamic map picker — shallow stubs are enough to prove KaartClient wires the
// selected pin / clicked coordinates through to them.
vi.mock("@/app/admin/kaart/LocationEditModal", () => ({
  LocationEditModal: ({ pin }: { pin: PublicLocation | null }) => (
    <div data-testid="edit-modal-stub">{pin?.name ?? "geen"}</div>
  ),
}));

vi.mock("@/app/admin/kaart/CreatePinModal", () => ({
  CreatePinModal: ({ coordinates }: { coordinates: { lat: number; lng: number } | null }) => (
    <div data-testid="create-modal-stub">{coordinates ? `${coordinates.lat},${coordinates.lng}` : "geen"}</div>
  ),
}));

afterEach(cleanup);

function location(overrides: Partial<PublicLocation> & { id: number }): PublicLocation {
  return {
    contentId: overrides.id,
    name: `Punt ${overrides.id}`,
    shortDescription: null,
    categoryId: 1,
    categoryName: "Geskiedenis",
    categorySlug: "geskiedenis",
    categoryColour: "#7b1f2b",
    photoReference: null,
    latitude: -25.7766,
    longitude: 28.1753,
    addressLine: null,
    tourStopId: null,
    arAnchorId: null,
    nfcTagId: null,
    ...overrides,
  };
}

describe("KaartClient (admin)", () => {
  it("shows an empty-state note but still renders the map so a first pin can be added", () => {
    render(<KaartClient locations={[]} />);

    expect(screen.getByText("Nog geen liggings nie.")).toBeTruthy();
    expect(screen.getByTestId("map-stub")).toBeTruthy();
  });

  it("passes every location through to the map by default", () => {
    const locations = [
      location({ id: 1, categorySlug: "geskiedenis", categoryName: "Geskiedenis" }),
      location({ id: 2, categorySlug: "natuur", categoryName: "Natuur", categoryColour: null }),
    ];

    render(<KaartClient locations={locations} />);

    expect(screen.getByTestId("map-stub").textContent).toContain("Punt 1,Punt 2");
  });

  it("narrows the map to the toggled category when a legend chip is clicked", () => {
    const locations = [
      location({ id: 1, categorySlug: "geskiedenis", categoryName: "Geskiedenis" }),
      location({ id: 2, categorySlug: "natuur", categoryName: "Natuur", categoryColour: null }),
    ];

    render(<KaartClient locations={locations} />);

    fireEvent.click(screen.getByRole("button", { name: "Natuur" }));

    expect(screen.getByTestId("map-stub").textContent).toContain("Punt 1");
  });

  it("opens the edit modal with the selected pin when a marker's edit action fires", () => {
    const locations = [location({ id: 1 })];

    render(<KaartClient locations={locations} />);

    expect(screen.getByTestId("edit-modal-stub").textContent).toBe("geen");

    fireEvent.click(screen.getByRole("button", { name: "Wysig ligging (toets)" }));

    expect(screen.getByTestId("edit-modal-stub").textContent).toBe("Punt 1");
  });

  it("disables click-to-create on the map while a pin is already open for editing", () => {
    const locations = [location({ id: 1 })];

    render(<KaartClient locations={locations} />);

    expect(screen.getByRole("button", { name: "Klik oop plek (toets)" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Wysig ligging (toets)" }));

    expect(screen.queryByRole("button", { name: "Klik oop plek (toets)" })).toBeNull();
  });

  it("opens the create modal with the clicked coordinates when empty map space is clicked", () => {
    render(<KaartClient locations={[location({ id: 1 })]} />);

    expect(screen.getByTestId("create-modal-stub").textContent).toBe("geen");

    fireEvent.click(screen.getByRole("button", { name: "Klik oop plek (toets)" }));

    expect(screen.getByTestId("create-modal-stub").textContent).toBe("-25.7,28.1");
    expect(screen.queryByRole("button", { name: "Klik oop plek (toets)" })).toBeNull();
  });
});

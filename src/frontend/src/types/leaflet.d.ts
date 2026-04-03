declare module "leaflet" {
  export interface Map {
    setView(center: [number, number], zoom: number): this;
    on(event: string, handler: (e: any) => void): this;
    remove(): void;
  }

  export interface Marker {
    addTo(map: Map): this;
    setLatLng(latlng: [number, number]): this;
    getLatLng(): { lat: number; lng: number };
    on(event: string, handler: () => void): this;
    bindPopup(content: string): this;
    openPopup(): this;
  }

  export interface TileLayer {
    addTo(map: Map): this;
  }

  export interface LeafletMouseEvent {
    latlng: { lat: number; lng: number };
  }

  export interface IconDefault {
    prototype: { _getIconUrl?: unknown };
    mergeOptions(options: {
      iconUrl: string;
      iconRetinaUrl: string;
      shadowUrl: string;
    }): void;
  }

  export const Icon: {
    Default: IconDefault;
  };

  export function map(element: HTMLElement, options?: object): Map;
  export function tileLayer(
    urlTemplate: string,
    options?: { attribution?: string },
  ): TileLayer;
  export function marker(
    latlng: [number, number],
    options?: { draggable?: boolean },
  ): Marker;
}

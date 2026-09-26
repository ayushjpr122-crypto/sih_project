/* Approximate geographic positions for East Coast India ports.
   Used ONLY for the operational plot on the Ports page.
   Source: public gazetteer coordinates, rounded to ~0.05deg (plot-scale). */

export interface PortCoord {
  port_name: string;
  lat: number;
  lon: number;
  /** Pixel nudge so near-coincident markers (Vizag/Gangavaram) stay selectable. */
  dx?: number;
  dy?: number;
}

export const PORT_COORDS: PortCoord[] = [
  { port_name: "Paradip", lat: 20.25, lon: 86.7 },
  { port_name: "Dhamra", lat: 20.8, lon: 87.0 },
  { port_name: "Gopalpur", lat: 19.25, lon: 84.9 },
  { port_name: "Visakhapatnam", lat: 17.7, lon: 83.3, dx: -9, dy: 7 },
  { port_name: "Gangavaram", lat: 17.62, lon: 83.23, dx: 10, dy: -8 },
  { port_name: "Kakinada", lat: 16.93, lon: 82.23 },
  { port_name: "Chennai", lat: 13.1, lon: 80.3 },
  { port_name: "Haldia", lat: 22.03, lon: 88.1 },
];

/** Loading-region origins behind the trade lanes (plot-scale, approximate). */
export const ORIGIN_COORDS: { key: string; label: string; lat: number; lon: number }[] = [
  { key: "Australia_Hedland", label: "Port Hedland", lat: -20.3, lon: 118.6 },
  { key: "Indonesia_Banjarmasin", label: "Banjarmasin", lat: -3.3, lon: 114.6 },
  { key: "SouthAfrica_RichardsBay", label: "Richards Bay", lat: -28.8, lon: 32.0 },
  { key: "Brazil_Tubarao", label: "Tubarao", lat: -20.3, lon: -40.5 },
];

/** Coarse Indian-subcontinent outline for the stylized landmass (lon/lat pairs). */
export const INDIA_OUTLINE: [number, number][] = [
  [68.2, 23.5], [70.2, 22.2], [72.5, 20.5], [73.0, 18.5], [74.5, 15.5],
  [76.0, 12.0], [77.5, 8.5], [80.3, 8.0], [80.2, 10.5], [80.3, 13.5],
  [82.3, 16.5], [84.0, 18.5], [86.5, 20.2], [88.0, 21.7], [89.0, 22.0],
  [92.0, 22.5], [92.5, 20.0], [90.5, 21.5], [88.5, 25.0], [85.0, 26.5],
  [80.0, 28.5], [76.0, 30.5], [72.0, 32.0], [70.0, 31.0], [68.5, 27.0],
];

export function coordFor(portName: string | undefined | null): PortCoord | undefined {
  if (!portName) return undefined;
  return PORT_COORDS.find((c) => c.port_name.toLowerCase() === portName.toLowerCase());
}

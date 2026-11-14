/**
 * Links de Google Maps a partir de coordenadas. Usan "Maps URLs", que es
 * gratis y no necesita clave: abren la app de Maps en el celular o la web en
 * la computadora. https://developers.google.com/maps/documentation/urls
 */

/** El punto marcado en el mapa. */
export const mapsPointUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

/**
 * Indicaciones para llegar manejando. Sin origen: Maps arranca desde donde
 * está el celular, que es lo que necesita el que sale a entregar.
 */
export const mapsDirectionsUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

/** "7,4 km" con la coma decimal de Paraguay. */
export const formatKm = (km: number) =>
  `${km.toLocaleString("es-PY", { maximumFractionDigits: 1 })} km`;

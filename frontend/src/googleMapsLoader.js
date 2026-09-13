/**
 * Road-routing helpers.
 * Uses the backend proxy (/api/demo/road-route) which calls the Google Directions REST API
 * server-side.  Falls back to straight-line interpolation if the backend is unreachable.
 * The Maps JavaScript API (for displaying the map widget) is NOT used here — map rendering
 * is handled by Leaflet / CARTO dark tiles which require no key.
 */

const GOOGLE_MAPS_API_KEY = "AIzaSyAvc7Ffnb_w9jw05zcymnBv257UDM88fRM";

let googleMapsPromise = null;
const directionsCache = new Map();

export function loadGoogleMaps() {
  if (googleMapsPromise) return googleMapsPromise;

  if (window.google && window.google.maps) {
    googleMapsPromise = Promise.resolve(window.google.maps);
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById("google-maps-script");
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.google.maps));
      existingScript.addEventListener("error", (e) => reject(e));
      return;
    }

    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.type = "text/javascript";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      if (window.google && window.google.maps) {
        resolve(window.google.maps);
      } else {
        reject(new Error("Google Maps API loaded but window.google.maps is undefined"));
      }
    };
    script.onerror = (err) => reject(err);

    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

function makeFallback(origin, destination, waypoints = []) {
  const fallbackPts = [origin, ...waypoints, destination];
  const interpolated = [];
  for (let i = 0; i < fallbackPts.length - 1; i++) {
    const p1 = fallbackPts[i];
    const p2 = fallbackPts[i + 1];
    for (let step = 0; step <= 15; step++) {
      const t = step / 15;
      interpolated.push({
        lat: p1.lat + (p2.lat - p1.lat) * t,
        lng: p1.lng + (p2.lng - p1.lng) * t,
      });
    }
  }
  return {
    path: interpolated,
    distanceMeters: 0,
    durationSeconds: 0,
    source: "fallback",
  };
}

async function fetchViaBackend(origin, destination, waypoints) {
  // 25s timeout — gives the backend enough time to call Google Directions REST API
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch("/api/demo/road-route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin, destination, waypoints }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`road-route ${res.status}`);
    const data = await res.json();
    if (!data?.path?.length) throw new Error("empty road path");
    return {
      path: data.path,
      distanceMeters: data.distanceMeters || 0,
      durationSeconds: data.durationSeconds || 0,
      source: data.source || "google",
    };
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

async function fetchViaJsApi(origin, destination, waypoints) {
  const maps = await Promise.race([
    loadGoogleMaps(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout loading Google Maps")), 8000)
    ),
  ]);

  if (!maps?.DirectionsService) throw new Error("DirectionsService unavailable");

  const directionsService = new maps.DirectionsService();
  const request = {
    origin: new maps.LatLng(origin.lat, origin.lng),
    destination: new maps.LatLng(destination.lat, destination.lng),
    waypoints: waypoints.map((wp) => ({
      location: new maps.LatLng(wp.lat, wp.lng),
      stopover: true,
    })),
    travelMode: maps.TravelMode.DRIVING,
    optimizeWaypoints: false,
  };

  return await new Promise((resolve, reject) => {
    directionsService.route(request, (result, status) => {
      if (status === maps.DirectionsStatus.OK && result?.routes?.length) {
        const route = result.routes[0];
        const detailedPath = [];
        let totalDistance = 0;
        let totalDuration = 0;

        route.legs.forEach((leg) => {
          totalDistance += leg.distance ? leg.distance.value : 0;
          totalDuration += leg.duration ? leg.duration.value : 0;
          leg.steps.forEach((step) => {
            if (step.path?.length) {
              step.path.forEach((pt) => {
                detailedPath.push({
                  lat: typeof pt.lat === "function" ? pt.lat() : pt.lat,
                  lng: typeof pt.lng === "function" ? pt.lng() : pt.lng,
                });
              });
            }
          });
        });

        const finalPath =
          detailedPath.length > 0
            ? detailedPath
            : route.overview_path.map((pt) => ({
                lat: typeof pt.lat === "function" ? pt.lat() : pt.lat,
                lng: typeof pt.lng === "function" ? pt.lng() : pt.lng,
              }));

        resolve({
          path: finalPath,
          distanceMeters: totalDistance,
          durationSeconds: totalDuration,
          source: "google-js",
        });
      } else {
        reject(new Error(`Directions status: ${status}`));
      }
    });
  });
}

/**
 * Fetch real driving polyline between stops.
 * 1. Try backend proxy (calls Google Directions REST API server-side) — cached on success.
 * 2. Fall back to straight-line interpolation if backend is unreachable (never cached).
 */
export async function getActualRoadRoute(origin, destination, waypoints = []) {
  const cacheKey = JSON.stringify({ origin, destination, waypoints });
  if (directionsCache.has(cacheKey)) {
    const cached = directionsCache.get(cacheKey);
    if (cached?.path?.length > 20 && cached.source !== "fallback") {
      return cached;
    }
  }

  try {
    const viaBackend = await fetchViaBackend(origin, destination, waypoints);
    if (viaBackend.source !== "fallback" && viaBackend.path?.length > 20) {
      directionsCache.set(cacheKey, viaBackend);
      return viaBackend;
    }
  } catch (err) {
    console.warn("[road-route] backend proxy failed, using straight-line fallback without caching", err);
  }
  return makeFallback(origin, destination, waypoints);
}

export const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#18181b" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#18181b" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#a1a1aa" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#f4f4f5" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#71717a" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#27272a" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#27272a" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#18181b" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9ca3af" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#3f3f46" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#27272a" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#27272a" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#09090b" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#52525b" }],
  },
];

import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { Device } from '@capacitor/device';


/* ────────────────── Helpers erreurs géoloc ────────────────── */
function normalizeGeoError(err) {
  if (err && typeof err.code === 'number') {
    if (err.code === 1) return { code: 'PERMISSION_DENIED', message: 'Permission refusée (navigateur ou OS).' };
    if (err.code === 2) return { code: 'POSITION_UNAVAILABLE', message: 'Position indisponible (capteurs/réseau).' };
    if (err.code === 3) return { code: 'TIMEOUT', message: 'Délai dépassé pour obtenir la position.' };
  }
  return { code: 'ERROR', message: String(err?.message || err || 'Erreur inconnue') };
}

/* ────────────────── Warm-up iOS: 1ère position via watch, puis stop ────────────────── */
function warmupWatchPositionWeb({ enableHighAccuracy = true, timeout = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      reject({ code: 2, message: 'Geolocation non disponible dans ce navigateur' });
      return;
    }
    let watchId = null;
    const tid = setTimeout(() => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      reject({ code: 3, message: 'Timeout watchPosition' });
    }, timeout);

    watchId = navigator.geolocation.watchPosition(
      (p) => {
        clearTimeout(tid);
        navigator.geolocation.clearWatch(watchId);
        resolve(p.coords);
      },
      (err) => {
        clearTimeout(tid);
        navigator.geolocation.clearWatch(watchId);
        reject(err);
      },
      { enableHighAccuracy, maximumAge: 0 }
    );
  });
}


// ─── Position (GPS) ─────────────────────────────────────────────
export async function getPosition() {
  const platform = Capacitor.getPlatform();
  const device = await Device.getInfo().catch(() => null);

  let permissions = null;
  try {
    permissions = await Geolocation.checkPermissions();

  } catch (_) {
    // iOS web peut ne pas exposer ça
  }

  // 1) Tentative via Capacitor (natif en app)
  try {
    permissions = await Geolocation.requestPermissions();

    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 0,
    });

    console.log('Geo Capacitor position obtenue', pos);

    return {
      ok: true,
      source: 'capacitor',
      platform,
      permissions,
      coords: pos.coords,
      accuracy: pos.coords?.accuracy ?? null,
      timestamp: pos.timestamp ?? Date.now(),
      device,
    };
  } catch (e1) {
    console.error('Erreur Geo (capacitor)', e1);

    // 2) Fallback web + warm-up si on est dans un navigateur
    if (platform === 'web' && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      try {
        // iOS a souvent besoin d’un watch pour “réveiller” le GPS
        const coords = await warmupWatchPositionWeb({ enableHighAccuracy: true, timeout: 30000 });
        return {
          ok: true,
          source: 'web-watch',
          platform,
          permissions,
          coords,
          accuracy: coords?.accuracy ?? null,
          timestamp: Date.now(),
          device,
        };
      } catch (eWatch) {
        console.error('Erreur Geo (web-watch)', eWatch);

        try {
          const coords2 = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              (p) => resolve(p.coords),
              (err) => reject(err),
              { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
            );
          });
          return {
            ok: true,
            source: 'web-once',
            platform,
            permissions,
            coords: coords2,
            accuracy: coords2?.accuracy ?? null,
            timestamp: Date.now(),
            device,
          };
        } catch (e2) {
          const errObj = normalizeGeoError(e2);
          console.error('Erreur Geo (web-once)', e2);

          return {
            ok: false,
            source: 'web',
            platform,
            permissions,
            coords: null,
            accuracy: null,
            timestamp: Date.now(),
            device,
            error: errObj,
          };
        }
      }
    }

    // 3) Échec total (ni Capacitor, ni web utilisable)
    const errObj = normalizeGeoError(e1);
    console.error('Erreur Geo (échec total)', e1);

    return {
      ok: false,
      source: 'capacitor',
      platform,
      permissions,
      coords: null,
      accuracy: null,
      timestamp: Date.now(),
      device,
      error: errObj,
    };
  }
}

function locationToString(location) {
        if (location == null || location == undefined) {
          return ""
        }
        let stringRepresentation = 'Position'

        const timeRepresentation = location.timestamp ? new Date(location.timestamp).toISOString() : '-'
        stringRepresentation += `- Time: ${timeRepresentation}\n`
        stringRepresentation += `- Latitute: ${location?.coords.latitude}\n- Longitude: ${location?.coords.longitude}\n`
        if (location?.coords.altitude || location?.coords.heading || location?.coords.speed) {
          stringRepresentation += `- Altitude: ${location?.coords.altitude}\n- Heading: ${location?.coords.heading}\n- Speed: ${location?.coords.speed}\n`
        }
        stringRepresentation += `- Accuracy: ${location?.coords.accuracy}\n`
        if (location?.coords.altitudeAccuracy) {
          stringRepresentation += `- Altitude accuracy: ${location?.coords.altitudeAccuracy}\n`
        }
        return stringRepresentation
      }


// bouton getPosition
document.getElementById("OLD_Pos")?.addEventListener("click", () => {
  let location = getPosition();
  console.log(location);
  let output = locationToString(location);
  console.log(output);
});
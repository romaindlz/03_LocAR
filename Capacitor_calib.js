import { appendLog, saveLogsToFile, clearLogs } from './logger.js';
import { getPosition } from './getPosition.js';



/* ────────────────── Calibration GPS ────────────────── */
// Point fixe de calibration
const LatPFP = 46.22560;
const LonPFP = 7.37000;

// Correction (à appliquer aux positions futures)
let calibLat = 0; // en degrés
let calibLon = 0;

function metersPerDeg(latDeg) {
  const mPerDegLat = 111320; // approx
  const mPerDegLon = 111320 * Math.cos((latDeg * Math.PI) / 180);
  return { mPerDegLat, mPerDegLon };
}

function mean(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function std(arr) {
  const m = mean(arr);
  const v = arr.length ? arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length : 0;
  return Math.sqrt(v);
}


/* ───────── Calibration avec getPosition() + filtrage outliers ───────── */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

//https://statisticsbyjim.com/basics/outliers/
/** Filtrage outliers 2D par z-score sur lat et lon (garde si |z|<=thr pour les deux) */
function filterOutliers2D(points, zThreshold = 2.5) {
  if (!points.length) return [];

  const lats = points.map(p => p.lat);
  const lons = points.map(p => p.lon);
  const mLat = mean(lats), sLat = std(lats);
  const mLon = mean(lons), sLon = std(lons);

  // si pas de dispersion, rien à filtrer
  if (sLat === 0 && sLon === 0) return points.slice();

  return points.filter(p => {
    const zLat = sLat === 0 ? 0 : Math.abs((p.lat - mLat) / sLat);
    const zLon = sLon === 0 ? 0 : Math.abs((p.lon - mLon) / sLon);
    return zLat <= zThreshold && zLon <= zThreshold;
  });
}

/**
 * Calibre via getPosition() en bouclant pendant >= minDurationMs et >= minSamples.
 * @param {number} latKnown
 * @param {number} lonKnown
 */
async function calibrateGpsFromGetPosition(latKnown, lonKnown) {
  const minDurationMs   = 5000;
  const minSamples      = 10;
  const sampleIntervalMs= 500;
  const zThreshold      = 2.5;

  const start = Date.now();
  const samples = [];

  // si tu as un service GPS interne
  try { window?.locar?.stopGps?.(); } catch(e) {}

  // Échantillonnage en boucle avec getPosition()
  while ((Date.now() - start) < minDurationMs || samples.length < minSamples) {
    try {
      const res = await getPosition(); // ← ta fonction existante
      if (res?.ok && res.coords?.latitude != null && res.coords?.longitude != null) {
        samples.push({ lat: res.coords.latitude, lon: res.coords.longitude });
        appendLog(`lat: ${res.coords.latitude}, lon: ${coords.longitude}`);
      }
    } catch (e) {
      // on ignore cet échantillon
    }
    await sleep(sampleIntervalMs);
  }

  if (!samples.length) {
    throw new Error("Aucun échantillon reçu pendant la calibration.");
  }

  // Filtrage outliers 2D (z-score sur lat et lon)
  const filtered = filterOutliers2D(samples, zThreshold);
  const removed = samples.length - filtered.length;

  const latMean = mean(filtered.map(p => p.lat));
  const lonMean = mean(filtered.map(p => p.lon));

  // Correction = connu - mesuré
  const dLatDeg = latKnown - latMean;
  const dLonDeg = lonKnown - lonMean;

  // Stats de dispersion (sur résidus post-correction)
  const latResiduals = filtered.map(p => (latKnown - p.lat) - dLatDeg);
  const lonResiduals = filtered.map(p => (lonKnown - p.lon) - dLonDeg);
  const latStdDeg = std(latResiduals);
  const lonStdDeg = std(lonResiduals);

  appendLog(`lat std: ${latStdDeg}, lon std: ${lonStdDeg}`);

  // Conversion en mètres (Nord/Est)
  const { mPerDegLat, mPerDegLon } = metersPerDeg(latKnown);
  const dNorth = dLatDeg * mPerDegLat;
  const dEast  = dLonDeg * mPerDegLon;

  appendLog(`dNorth: ${dNorth}, dEast: ${dEast}`);
  appendLog(`Calibration: ${samples.length} échantillons (−${removed} outliers, thr=${zThreshold})`);


  return {
    avgDeltaDeg: { dLat: dLatDeg, dLon: dLonDeg },
    avgDeltaMeters: { dNorth, dEast },
    stats: {
      samplesTotal: samples.length,
      samplesUsed: filtered.length,
      zThreshold,
      latMeasuredMean: latMean,
      lonMeasuredMean: lonMean,
      latResidualStdDeg: latStdDeg,
      lonResidualStdDeg: lonStdDeg,
    },
  };
}


// ────────────────── Bouton de calibration ──────────────────
document.getElementById('Calib')?.addEventListener('click', async () => {
  console.log('Calib clicked');
  alert('Calibration en cours… Placez-vous exactement sur le point connu et restez immobile ~5 s.');
  try {
    const res = await calibrateGpsFromGetPosition(LatPFP, LonPFP);

    calibLat = res.avgDeltaDeg.dLat;
    calibLon = res.avgDeltaDeg.dLon;

    const meters = `≈ dNorth ${res.avgDeltaMeters.dNorth.toFixed(2)} m, dEast ${res.avgDeltaMeters.dEast.toFixed(2)} m`;
    const degs   = `Δlat ${calibLat.toFixed(8)}°, Δlon ${calibLon.toFixed(8)}°`;
    const spread = `σ: lat ${res.stats.latResidualStdDeg.toExponential(2)}°, lon ${res.stats.lonResidualStdDeg.toExponential(2)}°  | utilisés: ${res.stats.samplesUsed}/${res.stats.samplesTotal}`;

    appendLog?.(`✅ Calibration OK\n${degs}\n${meters}\n${spread}`);
    alert(`Calibration OK.\n${meters}`);
  } catch (e) {
    appendLog?.(`❌ Calibration échouée: ${e?.message || e}`);
    alert(`Calibration échouée: ${e?.message || e}`);
  }
});


/* ────────────────── Fake GPS Loop (start/stop) ────────────────── */
const FAKE_GPS_INTERVAL = 1000; // en ms
let fakeGpsLoopActive = false;
let fakeGpsIntervalId = null;

async function startLiveCorrectedFakeGps() {
  // coupe toute boucle existante
  if (fakeGpsIntervalId) clearInterval(fakeGpsIntervalId);
  fakeGpsLoopActive = false;

  // on arrête le provider interne LocAR avant de simuler
  try { window?.locar?.stopGps?.(); } catch {}

  // test initial (et injection immédiate)
  let res;
  try { res = await getPosition(); }
  catch (e) { appendLog(`❌ getPosition exception: ${e?.message || e}`); return; }

  if (!res?.ok || !res.coords) {
    appendLog(`❌ getPosition a échoué: ${res?.error?.code || 'UNKNOWN'}`);
    return;
  }

  // première injection (instantanée) pour éviter un "trou" visuel
  try {
    const first = applyCorrectionToCoords(res.coords.latitude, res.coords.longitude);
    window?.locar?.fakeGps?.(first.longitude, first.latitude);
    appendLog(`🚀 Fake GPS LIVE démarrée (lat: ${first.latitude.toFixed(6)}, lon: ${first.longitude.toFixed(6)})`);
  } catch (e) {
    appendLog(`⚠️ Impossible d'initialiser la fake GPS : ${e.message || e}`);
  }

  // boucle LIVE
  fakeGpsLoopActive = true;
  fakeGpsIntervalId = setInterval(async () => {
    if (!fakeGpsLoopActive) return;
    try {
      const r = await getPosition();
      if (!r?.ok || !r.coords) return; // on ignore ce tick

      const corrected = applyCorrectionToCoords(r.coords.latitude, r.coords.longitude);
      window?.locar?.fakeGps?.(corrected.longitude, corrected.latitude);

      appendLog(`📍 Fake GPS LIVE → lat: ${corrected.latitude.toFixed(6)}, lon: ${corrected.longitude.toFixed(6)}`);
    } catch (err) {
      appendLog(`⚠️ Erreur tick fake GPS: ${err?.message || err}`);
    }
  }, FAKE_GPS_INTERVAL);
}

async function stopFakeGpsLoop() {
  // 1) Coupe TOUTES les boucles fake actives
  try {
    if (fakeGpsIntervalId) clearInterval(fakeGpsIntervalId);
  } catch {}
  fakeGpsIntervalId = null;
  fakeGpsLoopActive = false;

  try { window?.locar?.stopGps?.(); } catch {}
  await sleep(100);
  try {
    await window?.locar?.startGps?.();
    appendLog('🛑 Fake GPS stoppée. ✅ Retour au GPS du smartphone.');
  } catch (e) {
    appendLog(`❌ startGps a échoué: ${e?.message || e}`);
  }
}


/**
 * Applique la correction de calibration à une position donnée
 */
function applyCorrectionToCoords(lat, lon) {
  return {
    latitude: lat + calibLat,
    longitude: lon + calibLon
  };
}

// Bouton START : démarre la simulation GPS continue
document.getElementById("ApplyCalib")?.addEventListener("click", async () => {
  try {
    await startLiveCorrectedFakeGps();
  } catch (e) {
    appendLog(`❌ startLiveCorrectedFakeGps: ${e?.message || e}`);
  }
});

// Bouton STOP : arrête la boucle
document.getElementById("StopCalib")?.addEventListener("click", async () => {
  try {
    await stopFakeGpsLoop();
  } catch (e) {
    appendLog(`❌ stopFakeGpsLoop: ${e?.message || e}`);
  }
});

// Arrêt automatique quand on ferme la page
window.addEventListener("beforeunload", () => {
  try { if (fakeGpsIntervalId) clearInterval(fakeGpsIntervalId); } catch {}
  fakeGpsIntervalId = null;
  fakeGpsLoopActive = false;
});


// bouton pour enregistrer les logs
document.getElementById("saveLogs")?.addEventListener("click", () => {
  console.log('saveLogs clicked');
  saveLogsToFile("calibration_logs.txt");
});

// bouton pour effacer les logs
document.getElementById("clearLogs")?.addEventListener("click", () => {
  console.log('clearLogs clicked');
  clearLogs();
  alert("Logs effacés.");
});
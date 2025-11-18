import * as THREE from 'three';
import * as LocAR from 'locar';
import { appendLog } from './logger.js';

const latObj = 46.22543;
const lonObj = 7.36980;


window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('glscene');

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true
  });

  const camera = new THREE.PerspectiveCamera(
    80,
    (canvas.clientWidth || 1) / (canvas.clientHeight || 1),
    0.001,
    1000
  );

  const scene = new THREE.Scene();

  // LocAR
  const locar = new LocAR.LocationBased(scene, camera);
  window.locar = locar;
  const cam = new LocAR.Webcam({ video: { facingMode: 'environment' }, audio: false }, null);



  cam.on('webcamstarted', ev => {
    scene.background = ev.texture;
    appendLog?.('Webcam started');
  });
  cam.on('webcamerror', err => alert(`Webcam error: code ${err.code} message ${err.message}`));

  const deviceOrientationControls = new LocAR.DeviceOrientationControls(camera);
  deviceOrientationControls.on('deviceorientationgranted', ev => { ev.target.connect(); appendLog?.('Device motion granted'); });
  deviceOrientationControls.on('deviceorientationerror', err => alert(`Device orientation error: ${err.message || err}`));
  deviceOrientationControls.init();

  locar.on('gpserror', err => alert(`GPS error: ${err.code}`));

  let firstLocation = true;
  locar.on('gpsupdate', ev => {
    if (!firstLocation) return;
    appendLog?.(`Initial fix: lon ${ev.position.coords.longitude}, lat ${ev.position.coords.latitude}`);

    // Exemple: repère fixe
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(8, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x0000ff, transparent: true, opacity: 0.5 })
    );
    locar.add(sphere, lonObj, latObj);
    firstLocation = false;
  });


  // Ajuster le renderer au canvas (plein écran)
  function resizeToCanvas() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);  // false = ne pas toucher au style CSS
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  // Observez le canvas + changements d’orientation
  new ResizeObserver(resizeToCanvas).observe(canvas);
  window.addEventListener('resize', resizeToCanvas);
  window.addEventListener('orientationchange', resizeToCanvas);

  resizeToCanvas();

  // Démarrage (sur certains mobiles, il vaut mieux déclencher après un geste utilisateur)
  locar.startGps();

  // Boucle de rendu
  function animate() {
    requestAnimationFrame(animate);
    deviceOrientationControls.update?.();
    renderer.render(scene, camera);
  }

  animate();
});


/* ────────────────── Test GPSUpdate (LocAR) ────────────────── */

// Fonction exportable
export function startLiveGps(callback) {
  const handler = (ev) => {
    const { latitude, longitude } = ev.position.coords;
    callback({ latitude, longitude, raw: ev });
  };

  // On démarre l'écoute
  locar.on("gpsupdate", handler);
  console.log("[startLiveGps] Listener gpsupdate enregistré");

  // On retourne une fonction d'arrêt *best effort*
  return () => {
    console.log("[startLiveGps] Tentative d'arrêt du listener gpsupdate");

    if (typeof locar.off === "function") {
      locar.off("gpsupdate", handler);
    } else if (typeof locar.removeListener === "function") {
      locar.removeListener("gpsupdate", handler);
    } else if (typeof locar.removeEventListener === "function") {
      locar.removeEventListener("gpsupdate", handler);
    } else if (typeof locar.removeAllListeners === "function") {
      locar.removeAllListeners("gpsupdate");
    } else {
      console.warn(
        "[startLiveGps] Impossible de détacher gpsupdate proprement : aucune méthode off/removeListener/removeEventListener/removeAllListeners trouvée."
      );
    }
  };
}


const indexedObjects = {};
let buildingsVisible = false;

async function loadBuildings() {
    const response = await fetch(`https://hikar.org/webapp/map?bbox=${lonObj-0.02},${latObj-0.02},${lonObj+0.02},${latObj+0.02}&layers=poi&outProj=4326`);
    const pois = await response.json();

    pois.features.forEach ( poi => {
        if(!indexedObjects[poi.properties.osm_id]) {
            const mat  = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.6 });
            const cube = new THREE.BoxGeometry(20, 20, 20);
            const mesh = new THREE.Mesh(
                cube,
                mat
            );                

            locar.add(mesh, poi.geometry.coordinates[0], poi.geometry.coordinates[1], 0, poi.properties);
            indexedObjects[poi.properties.osm_id] = mesh;
        }
    });
  }


document.getElementById("Serveur")?.addEventListener("click", () => {
  loadBuildings();
});

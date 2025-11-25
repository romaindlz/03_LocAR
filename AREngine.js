import * as THREE from 'three';
import * as LocAR from 'locar';
import { appendLog } from './logger.js';
/*
//Uvrier
// Coordonnées des points fixes (calibration)
const latNav1 = 46.24678;
const lonNav1 = 7.41180;

const latNav2 = 46.24666;
const lonNav2 = 7.41182;

// Coordonnées object
const latObj = 46.24668;
const lonObj = 7.41200;
*/


//IG Group
// Coordonnées des points fixes (calibration)
const latNav1 = 46.22549;
const lonNav1 = 7.36996;

const latNav2 = 46.22556;
const lonNav2 = 7.36965;

// Coordonnées object
const latObj = 46.22544;
const lonObj = 7.36983;

// "catalogue"
const contenuAR = {
  sphere: {
    type: 'sphere',
    lon: lonObj,
    lat: latObj
  },
  box: {
    type: 'box',
    lon: lonObj,
    lat: latObj
  },
  nav_pf1: {
      type: 'arrow',
      lon: lonNav1,
      lat: latNav1
  },
  nav_pf2: {
      type: 'arrow',
      lon: lonNav2,
      lat: latNav2
    },
};

let locar, scene, camera, renderer;
let elementsActuels = [];

/* ────────────────── Initialisation LocAR.js ────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('glscene');

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true
  });

  camera = new THREE.PerspectiveCamera(
    80,
    (canvas.clientWidth || 1) / (canvas.clientHeight || 1),
    0.001,
    1000
  );

  scene = new THREE.Scene();

  // LocAR
  locar = new LocAR.LocationBased(scene, camera);
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

    //AREngine(contenuAR.sphere);

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



/* ────────────────── Fonction AR ────────────────── */
function hideAllARElements() {
  elementsActuels.forEach(mesh => {
    mesh.visible = false;
    scene.remove(mesh);
  });
  elementsActuels = [];
}

function AREngine(input) {
  if (!locar || !scene) {
    console.warn('LocAR ou scene non initialisés');
    return;
  }

  // 1) Normaliser l'entrée : objet unique → tableau avec 1 élément
  const elements = Array.isArray(input) ? input : [input];

  console.log('AREngine reçu =', input);
  console.log('Normalisé en tableau =', elements);

  hideAllARElements();

  // 3) Créer et ajouter les nouveaux éléments
  elements.forEach(desc => {
    // 👉 desc a bien ton format { type, lon, lat, ... }
    const mesh = createMesh(desc);       // ta fonction existante qui gère "sphere", "arrowGround", ...

    if (typeof desc.lon !== 'number' || typeof desc.lat !== 'number') {
      console.warn('desc.lon / desc.lat invalides pour', desc);
      return;
    }

    // 👉 C'est ICI que les coordonnées sont utilisées
    locar.add(mesh, desc.lon, desc.lat);

    elementsActuels.push(mesh);
  });

  console.log('elementsActuels après AREngine =', elementsActuels);
}

function createMesh(desc) {

  switch (desc.type) {
    case 'box': {

      const [sx, sy, sz] = [5, 5, 5];
      const geom = new THREE.BoxGeometry(sx, sy, sz);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.8
      });

      return new THREE.Mesh(geom, mat);

    }  
    
    case 'sphere': {

      const geometry = new THREE.SphereGeometry(8, 32, 32);
      const material = new THREE.MeshBasicMaterial({ color: 0x0000ff, transparent: true, opacity: 0.5 });
      const sphere = new THREE.Mesh(geometry, material);

      return sphere;

    }

    case 'arrow': {

      const height = 8;                    // hauteur totale (en "m")
      const headHeight = height * 0.4;              // partie pointe
      const headRadius  = headHeight * 0.6; // largeur de la pointe
      const color = 0x0000ff;
      const opacity = 0.8;

      const group = new THREE.Group();

      // Matériau commun
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity
      });

      // Tige de la flèche (cylindre)
      const shaftHeight = height - headHeight;
      const shaftRadius = headRadius * 0.25;

      const shaftGeom = new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftHeight, 16);
      const shaft = new THREE.Mesh(shaftGeom, mat);

      shaft.position.y = shaftHeight / 2;
      group.add(shaft);

      // Pointe (cône)
      const headGeom = new THREE.ConeGeometry(headRadius, headHeight, 16);
      const head = new THREE.Mesh(headGeom, mat);
      head.position.y = shaftHeight + headHeight / 2;
      group.add(head);

      group.rotation.z = Math.PI;

      return group;
      }
    }
}


/* ────────────────── Bouton d'affichage/suppression des mesh ────────────────── */
let sphereVisible = false;
let boxVisible = false;
let arowVisible = false;

document.getElementById('sphere').addEventListener('click', () => {
  if (!sphereVisible) {
    AREngine(contenuAR.sphere);
    sphereVisible = true;
  } else {
    hideAllARElements();
    sphereVisible = false;
  }
});


document.getElementById('box').addEventListener('click', () => {
  if (!boxVisible) {
    AREngine(contenuAR.box);
    boxVisible = true;
  } else {
    hideAllARElements();
    boxVisible = false;
  }
});

document.getElementById('arrow').addEventListener('click', () => {
  if (!arowVisible) {
    AREngine(contenuAR.nav_pf1);
    arowVisible = true;
  } else {
    hideAllARElements();
    arowVisible = false;
  }
});

/* ────────────────── Import GEOJSON ────────────────── */
const indexedObjects = {};

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

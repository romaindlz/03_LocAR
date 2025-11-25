import * as THREE from 'three';
import * as LocAR from 'locar';
import { appendLog } from './logger.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Coordonnées des points fixes (calibration)
const latNav1 = 46.24678;
const lonNav1 = 7.41180;

const latNav2 = 46.24666;
const lonNav2 = 7.41182;

// Coordonnées GPS object
const latObj = 46.24668;
const lonObj = 7.41200;


let locar, scene, camera, renderer;
let deviceOrientationControls;
let elementsActuels = [];

// Exemple de "catalogue" à afficher
const contenuAR = {
  nav_pf1: [
    {
      type: 'arrowGround',
      lon: lonNav1,
      lat: latNav1
    }
  ],
  nav_pf2: [
    {
      type: 'arrowGround',
      lon: lonNav2,
      lat: latNav2
    }
  ],
  sceneFinale: [
    {
      type: 'box',
      lon: lonObj,
      lat: latObj,
      size: [10, 20, 10],
      color: 0xff0000,
      opacity: 0.7
    }
  ],
  sceneGLTF: [
    {
      type: 'gltf',
      url: 'models/batiment.glb',
      lon: lonObj,
      lat: latObj
    }
  ],
  sphere: [
    {
      type: 'sphere',
      lon: lonObj,
      lat: latObj
    }
  ]
};

window.addEventListener('DOMContentLoaded', () => {
  console.log('INIT AR SCRIPT');


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
  console.log('locar =', locar);
  window.locar = locar;

  const cam = new LocAR.Webcam(
    { video: { facingMode: 'environment' }, audio: false },
    null
  );

  cam.on('webcamstarted', ev => {
    scene.background = ev.texture;
    appendLog?.('Webcam started');
  });

  cam.on('webcamerror', err =>
    alert(`Webcam error: code ${err.code} message ${err.message}`)
  );

  deviceOrientationControls = new LocAR.DeviceOrientationControls(camera);
  deviceOrientationControls.on('deviceorientationgranted', ev => {
    ev.target.connect();
    appendLog?.('Device motion granted');
  });
  deviceOrientationControls.on('deviceorientationerror', err =>
    alert(`Device orientation error: ${err.message || err}`)
  );
  deviceOrientationControls.init();

  locar.on('gpserror', err => {
    console.error('GPS ERROR', err);
    alert(`GPS error: code ${err.code}, message: ${err.message}`);
  });

  //let firstLocation = true;
  locar.on('gpsupdate', ev => {
    console.log('GPS UPDATE RAW EVENT', ev);
  });


  function resizeToCanvas() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  new ResizeObserver(resizeToCanvas).observe(canvas);
  window.addEventListener('resize', resizeToCanvas);
  window.addEventListener('orientationchange', resizeToCanvas);

  resizeToCanvas();

  console.log('Calling locar.startGps()');
  locar.startGps();

  function animate() {
    requestAnimationFrame(animate);
    deviceOrientationControls.update?.();
    renderer.render(scene, camera);
  }

  animate();
});


// =====================================================
// Fonction "tout-terrain" pour afficher des éléments AR
// =====================================================

function AREngine(elements) {
  if (!locar || !scene) {
    console.warn('LocAR ou scène non initialisés');
    return;
  }

  // 1) Nettoyer / masquer les anciens éléments
  elementsActuels.forEach(mesh => {
    mesh.visible = false;
    scene.remove(mesh);
  });
  elementsActuels = [];

  // 2) Créer et ajouter les nouveaux éléments
  elements.forEach(desc => {
    if (desc.type === 'gltf') {
      chargerGLTF(desc);
    } else {
      const mesh = createMesh(desc);
      elementsActuels.push(mesh);
      locar.add(mesh, desc.lon, desc.lat);
    }
  });
}


// Fabrique de mesh générique à partir d'une "description"
function createMesh(desc) {
  switch (desc.type) {
    case 'box': {
      const [sx, sy, sz] = desc.size ?? [5, 5, 5];
      const geom = new THREE.BoxGeometry(sx, sy, sz);
      const mat = new THREE.MeshBasicMaterial({
        color: desc.color ?? 0xffffff,
        transparent: true,
        opacity: desc.opacity ?? 0.8
      });
      return new THREE.Mesh(geom, mat);
    }

    case 'sphere': {
      lon = desc.lonObj;
      lat = desc.latObj;

      const geom = new THREE.SphereGeometry(8, 32, 32);
      const material = new THREE.MeshBasicMaterial({ color: 0x0000ff, transparent: true, opacity: 0.5 });

      const sphere = new THREE.Mesh(geom, material);

      locar.add(sphere, lon, lat);
      return sphere;
    }

    case 'arrowGround': {
      const height = 2;                    // hauteur totale (en "m")
      const headHeight = 0.4;              // partie pointe
      const headRadius  = headHeight* 0.6; // largeur de la pointe
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

    default: {
      console.warn('Type non reconnu, utilisation d’une sphère par défaut');
      const geom = new THREE.SphereGeometry(5, 32, 32);
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      return new THREE.Mesh(geom, mat);
    }
  }
}

/* Chargement d’un modèle glTF externe */
const gltfLoader = new GLTFLoader();

function chargerGLTF(desc) {
  gltfLoader.load(
    desc.url,
    gltf => {
      const root = gltf.scene;

      // Échelle
      const s =  1;
      root.scale.set(s, s, s);

      // Ajout à la scène via LocAR (comme un mesh classique)
      locar.add(root, desc.lon, desc.lat);
      elementsActuels.push(root);

      appendLog?.(`Modèle glTF chargé: ${desc.url}`);
    },
    undefined,
    error => {
      console.error('Erreur chargement glTF', error);
      appendLog?.(`Erreur glTF: ${desc.url}`);
    }
  );
}


/*  Chargement des bâtiments depuis le serveur hikar.org  */
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

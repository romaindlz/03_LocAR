import * as THREE from 'three';
import * as LocAR from 'locar';

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let fixedSphere;

const camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.001, 1000);

const renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('glscene')
});
renderer.setSize(window.innerWidth, window.innerHeight);
//document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const locar = new LocAR.LocationBased(scene, camera);

const cam = new LocAR.Webcam( { 
    video: { facingMode: 'environment' }
}, null);

cam.on("webcamstarted", ev => {
    scene.background = ev.texture;
});

cam.on("webcamerror", error => {
    alert(`Webcam error: code ${error.code} message ${error.message}`);
});

window.addEventListener("resize", ev => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

let firstLocation = true;

let deviceOrientationControls = new LocAR.DeviceOrientationControls(camera);

deviceOrientationControls.on("deviceorientationgranted", ev => {
    ev.target.connect();
});

deviceOrientationControls.on("deviceorientationerror", error => {
    alert(`Device orientation error: code ${error.code} message ${error.message}`);
});

deviceOrientationControls.init();

locar.on("gpserror", error => {
    alert(`GPS error: ${error.code}`);
});

locar.on("gpsupdate", ev => {
    if(firstLocation) {
        alert(`Got the initial location: longitude ${ev.position.coords.longitude}, latitude ${ev.position.coords.latitude}`);

        const boxProps = [{
            latDis: 0.0005,
            lonDis: 0,
            colour: 0xff0000
        }, {
            latDis: -0.0005,
            lonDis: 0,
            colour: 0xffff00
        }, {
            latDis: 0,
            lonDis: -0.0005,
            colour: 0x00ffff
        }, {
            latDis: 0,
            lonDis: 0.0005,
            colour: 0x00ff00
        }];

        const geom = new THREE.BoxGeometry(2,2,2);

        for(const boxProp of boxProps) {
            const mesh = new THREE.Mesh(
                geom, 
                new THREE.MeshBasicMaterial({color: boxProp.colour})
            );

            locar.add(
                mesh, 
                ev.position.coords.longitude + boxProp.lonDis, 
                ev.position.coords.latitude + boxProp.latDis
            );
        }

        // === AJOUT D’UNE SPHERE À DES COORDONNÉES DÉFINIES ===
        const fixedLatitude  = 46.22543;
        const fixedLongitude = 7.36980;

        const sphereGeom = new THREE.SphereGeometry(8, 32, 32);
        const sphereMat = new THREE.MeshBasicMaterial({
            color: 0x0000ff,
            transparent: true,
            opacity: 0.5
        });

        fixedSphere = new THREE.Mesh(sphereGeom, sphereMat);
        fixedSphere.name = "fixedSphere";
        fixedSphere.userData = { selected: false, baseScale: 1, baseColor: 0x0000ff };

        locar.add(fixedSphere, fixedLongitude, fixedLatitude);

        const canvas = renderer.domElement;

        function getPointerNDC(ev) {
            const rect = canvas.getBoundingClientRect();
            const cx = (ev.clientX ?? ev.touches?.[0]?.clientX) - rect.left;
            const cy = (ev.clientY ?? ev.touches?.[0]?.clientY) - rect.top;
            pointer.x =  (cx / rect.width)  * 2 - 1;
            pointer.y = -(cy / rect.height) * 2 + 1;
        }

        function onPointerDown(ev) {
            getPointerNDC(ev);
            raycaster.setFromCamera(pointer, camera);

            if (!fixedSphere) return;
                const hit = raycaster.intersectObject(fixedSphere, true);

            if (hit.length) {
                // Toggle d’état visuel simple
                fixedSphere.userData.selected = !fixedSphere.userData.selected;
                if (fixedSphere.userData.selected) {
                fixedSphere.material.color.set(0xff1493); // rose vif
                fixedSphere.scale.setScalar(fixedSphere.userData.baseScale * 1.3);
                fixedSphere.material.opacity = 0.9;
                // Exemple d’action : afficher des infos
                // alert("Sphère sélectionnée !");
                } else {
                fixedSphere.material.color.set(fixedSphere.userData.baseColor);
                fixedSphere.scale.setScalar(fixedSphere.userData.baseScale);
                fixedSphere.material.opacity = 0.6;
                }
            }
        }

        canvas.addEventListener("pointerdown", onPointerDown, { passive: true });
        canvas.addEventListener("touchstart",  onPointerDown, { passive: true });

        // ================================================
        
        firstLocation = false;
    }
});

locar.startGps();

document.getElementById("setFakeLoc").addEventListener("click", e => {
    alert("Using fake input GPS, not real GPS location");
    locar.stopGps();
    locar.fakeGps(
        parseFloat(document.getElementById("fakeLon").value),
        parseFloat(document.getElementById("fakeLat").value)
    );
});

renderer.setAnimationLoop(animate);

function animate() {
    deviceOrientationControls?.update();
    renderer.render(scene, camera);
}

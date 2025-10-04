const socket = io(); // se connecte automatiquement au serveur
import * as THREE from 'three'; 
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.157.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.157.0/examples/jsm/loaders/GLTFLoader.js';

socket.on('swing', (data) => {
  angularVelocity += data.impulse;
});


let scene, camera, renderer, controls, loader;
let currentAvatar = null;
let sapins = [];
let balancoire = null;
let siegeBalancoire = null;
let ropeBalancoire = null;
let angle = 0;
let angularVelocity = 0;
let angularAcceleration = 0;
let playerGenre = null;
const gravity = 5;
const ropeLenghtMeters = 2;
const damping = 0.02;
const impulseStrength = 0.1
const maxAngle = Math.PI / 2;

const menu = document.getElementById('menu');
initMenu();

function initMenu() {
  document.getElementById('btnGarcon').onclick = () => startGame('garcon');
  document.getElementById('btnFille').onclick = () => startGame('fille');
}

function startGame(genre) {
  playerGenre = genre;
  menu.style.display = 'none';
  initScene();
  loadScene();
  loadBalancoire();
  animate();

}

function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa0d8f0);

  // Camera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  // Lights
 // Lumière ambiante douce violet clair
// Lumière ambiante violet doux
 const ambient = new THREE.AmbientLight(0xE0BBE4, 0.6); // violet clair légèrement plus saturé
 scene.add(ambient);

// Lumière directionnelle principale violette
 const dir = new THREE.DirectionalLight(0xCBA0E3, 0.9); // violet doux, un peu plus intense
 dir.position.set(5, 10, 5);
 dir.castShadow = true;

// Ombres douces
 dir.shadow.mapSize.width = 1024;
 dir.shadow.mapSize.height = 1024;
 dir.shadow.radius = 6; 
 dir.shadow.bias = -0.0001; 

 scene.add(dir);

// Lumière ponctuelle secondaire pour accentuer le violet
 const pointLight = new THREE.PointLight(0xD8B0FF, 0.4, 15); // violet clair, faible intensité
 pointLight.position.set(-5, 3, 5);
 scene.add(pointLight);



  // Sol de secours
  const groundGeo = new THREE.PlaneGeometry(200, 200);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x2f8b2f });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // OrbitControls (juste regarder autour)
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.maxPolarAngle = Math.PI / 2;

  loader = new GLTFLoader();
  window.addEventListener('resize', onWindowResize);
}

function loadScene() {
  loader.load(
    'scene.glb',
    (gltf) => {
      const model = gltf.scene;
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          // Détection sapins
          if (child.name.startsWith("Cylinder")) {
            sapins.push(child);
          }
        }
      });
      scene.add(model);

      // Centrage caméra
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
      cameraZ = cameraZ * 1.2 + 1;

      camera.position.set(center.x, center.y + size.y / 2 + 1.5, center.z + cameraZ);
      controls.target.copy(center);
      controls.update();
    },
    undefined,
    (err) => {
      console.warn('Erreur chargement scene.glb :', err);
    }
  );
}

function loadBalancoire() {
  loader.load(
    'balancoirecomplet.glb',
    (gltf) => {
      balancoire = gltf.scene;
      balancoire.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;

          // Détection de la chaise et de la rope
          if (child.name === "Seat" || child.name === "siege") {
            siegeBalancoire = child;
          }
          
          if (child.name === "Rope" || child.name === "rope") {
            ropeBalancoire = child;
          }

        }
      });

      balancoire.position.set(0.65, 0.55, 0.10);
      balancoire.rotation.y = Math.PI / 4; 
      balancoire.scale.set(0.04, 0.04, 0.04);

      scene.add(balancoire);
    },
    undefined,
    (err) => {
      console.error('Erreur chargement swing.glb :', err);
    }
  );

  // Touches scale balançoire entière
  document.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'b') {
    if (playerGenre === 'garcon') {
      if (Math.abs(angle) < 0.05 && angularVelocity >= 0) {
        angularVelocity += impulseStrength;
        socket.emit('swing', { impulse: impulseStrength });
      }
    }
  }
});

}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  updatePhysics(delta);



  // Animation vent sapins
  sapins.forEach((sapin, i) => {
    sapin.rotation.y = 0.05 * Math.sin(Date.now() * 0.002 + i);
    sapin.rotation.x = 0.05 * Math.sin(Date.now() * 0.002 + i);
  });

  controls.update();
  updateCameraFollowSeat();
  renderer.render(scene, camera);
}

function updatePhysics(deltaTime) {
  angularAcceleration = -(gravity / ropeLenghtMeters) * Math.sin(angle) - damping * angularVelocity;
  angularVelocity += angularAcceleration * deltaTime;
  angle += angularVelocity * deltaTime;

  if (angle > maxAngle) {
        angle = maxAngle;
        angularVelocity = 0;
    } else if (angle < -maxAngle) {
        angle = -maxAngle;
        angularVelocity = 0;
    }

  ropeBalancoire.rotation.x = angle;
  siegeBalancoire.rotation.x = angle;
}

function updateCameraFollowSeat() {
    if (!siegeBalancoire) return;

    // Distance derrière le siège
    const offsetBack = 0.5;
    const offsetUp = 0.3;

    // Position du siège dans le monde
    const seatWorldPos = new THREE.Vector3();
    siegeBalancoire.getWorldPosition(seatWorldPos);

    // Direction “avant” du siège (en prenant sa rotation)
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(siegeBalancoire.getWorldQuaternion(new THREE.Quaternion()));

    // Calcul position caméra : derrière + un peu au-dessus
    const cameraPos = seatWorldPos.clone()
        .add(forward.clone().multiplyScalar(-offsetBack))
        .add(new THREE.Vector3(0, offsetUp, 0));

    // Appliquer position
    camera.position.lerp(cameraPos, 0.1); // lerp pour un suivi doux

    // Regarder vers le siège
    camera.lookAt(seatWorldPos);
}




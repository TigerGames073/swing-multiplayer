//const socket = io(); // se connecte automatiquement au serveur
import * as THREE from 'three'; 
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.157.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.157.0/examples/jsm/loaders/GLTFLoader.js';

//socket.on('swing', (data) => {
 // angularVelocity += data.impulse;
//});

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
let pitch = 0; // rotation haut/bas
let yaw = 0;   // rotation gauche/droite
let isPointerDown = false;
let lastPointerX = 0;
let lastPointerY = 0;
let cameraPivot = new THREE.Object3D(); // pivot de la caméra
const gravity = 5;
const ropeLenghtMeters = 2;
const damping = 0.02;
const impulseStrength = 0.1;
const maxAngle = Math.PI / 2;

const menu = document.getElementById('menu');
initMenu();

function initMenu() {
  document.getElementById('btnGarcon').onclick = () => startGame('garcon');
  document.getElementById('btnFille').onclick = () => startGame('fille');
}

function startGame(genre) {
  playerGenre = genre;
  const pushBtn = document.getElementById('btnPush');
  if (playerGenre === 'garcon') {
    pushBtn.style.display = 'block';
  } else {
    pushBtn.style.display = 'none';
  }

  menu.style.display = 'none';
  initScene();
  loadScene();
  loadBalancoire();
  animate();
}

function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa0d8f0);

  // Camera avec FOV élargi
  camera = new THREE.PerspectiveCamera(120, window.innerWidth / window.innerHeight, 0.1, 1000);

  // Pivot pour suivre le siège
  cameraPivot = new THREE.Object3D();
  scene.add(cameraPivot);
  cameraPivot.add(camera);

  // Initial offset caméra légèrement reculé pour effet perspective
  camera.position.set(0, -0.2, 0.03); // reculé au lieu de -0.5

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  // --- Souris ---
  window.addEventListener('mousedown', (e) => { 
    isPointerDown = true; 
    lastPointerX = e.clientX; 
    lastPointerY = e.clientY; 
  });
  window.addEventListener('mouseup', () => { isPointerDown = false; });
  window.addEventListener('mousemove', (e) => {
    if (!isPointerDown) return;
    const dx = e.clientX - lastPointerX;
    const dy = e.clientY - lastPointerY;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    const sensitivity = 0.002;
    yaw   -= dx * sensitivity;
    pitch -= dy * sensitivity;
    pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch));
  });

  // --- Touch (mobile) ---
  window.addEventListener('touchstart', (e) => {
    if(e.touches.length === 1) {
        isPointerDown = true;
        lastPointerX = e.touches[0].clientX;
        lastPointerY = e.touches[0].clientY;
    }
  });
  window.addEventListener('touchend', () => { isPointerDown = false; });
  window.addEventListener('touchmove', (e) => {
    if(!isPointerDown || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - lastPointerX;
    const dy = e.touches[0].clientY - lastPointerY;
    lastPointerX = e.touches[0].clientX;
    lastPointerY = e.touches[0].clientY;
    const sensitivity = 0.005;
    yaw   -= dx * sensitivity;
    pitch -= dy * sensitivity;
    pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch));
  });

  // Lights
  const ambient = new THREE.AmbientLight(0xE0BBE4, 0.6);
  scene.add(ambient);
  const dir = new THREE.DirectionalLight(0xCBA0E3, 0.9);
  dir.position.set(5, 10, 5);
  dir.castShadow = true;
  dir.shadow.mapSize.width = 1024;
  dir.shadow.mapSize.height = 1024;
  dir.shadow.radius = 6; 
  dir.shadow.bias = -0.0001; 
  scene.add(dir);
  const pointLight = new THREE.PointLight(0xD8B0FF, 0.4, 15);
  pointLight.position.set(-5, 3, 5);
  scene.add(pointLight);

  // Sol
  const groundGeo = new THREE.PlaneGeometry(200, 200);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x2f8b2f });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

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
          if (child.name.startsWith("Cylinder")) sapins.push(child);
        }
      });
      scene.add(model);
    },
    undefined,
    (err) => { console.warn('Erreur chargement scene.glb :', err); }
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
          if (child.name === "Seat" || child.name === "siege") siegeBalancoire = child;
          if (child.name === "Rope" || child.name === "rope") ropeBalancoire = child;
        }
      });
      balancoire.position.set(0.65, 0.55, 0.10);
      balancoire.rotation.y = Math.PI / 4; 
      balancoire.scale.set(0.04, 0.04, 0.04);
      scene.add(balancoire);
    },
    undefined,
    (err) => { console.error('Erreur chargement swing.glb :', err); }
  );

  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'b' && playerGenre === 'garcon') {
      if (Math.abs(angle) < 0.05 && angularVelocity >= 0) {
        angularVelocity += impulseStrength;
        //socket.emit('swing', { impulse: impulseStrength });
      }
    }
  });

  // --- Bouton tactile pour pousser la balançoire ---
  document.getElementById('btnPush').addEventListener('click', () => {
    if (playerGenre === 'garcon' && siegeBalancoire) {
      if (Math.abs(angle) < 0.05 && angularVelocity >= 0) {
        angularVelocity += impulseStrength;
        //socket.emit('swing', { impulse: impulseStrength }); // si tu veux le réseau plus tard
      }
    }
  });

}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateCameraFollowSeat() {
    if (!siegeBalancoire) return;

    // Mettre le pivot au pivot du siège
    const seatWorldPos = new THREE.Vector3();
    siegeBalancoire.getWorldPosition(seatWorldPos);
    cameraPivot.position.lerp(seatWorldPos, 0.1);

    // Rotation du pivot = rotation de la balançoire
    const seatWorldQuat = new THREE.Quaternion();
    siegeBalancoire.getWorldQuaternion(seatWorldQuat);
    cameraPivot.quaternion.slerp(seatWorldQuat, 0.1);

    // Rotation libre caméra (pitch/yaw)
    const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
    const freeQuat = new THREE.Quaternion().setFromEuler(euler);
    camera.quaternion.copy(freeQuat);

    // --- Nouvelle partie : gestion du changement de vue ---
    const targetZ = vueProche ? 0 : 0.35; // -1 = proche, -3 = éloignée
    const currentZ = camera.position.z;
    camera.position.z = THREE.MathUtils.lerp(currentZ, targetZ, 0.05); // transition douce
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

    updateCameraFollowSeat(); // pivot + rotation libre

    renderer.render(scene, camera);
}

// === Gestion du changement de vue ===
let vueProche = true;

document.getElementById('btnVue').addEventListener('click', () => {
  vueProche = !vueProche;
});





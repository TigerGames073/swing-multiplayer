const socket = io(); // connexion auto au serveur

import * as THREE from 'three'; 
import { FontLoader } from 'https://cdn.jsdelivr.net/npm/three@0.157.0/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'https://cdn.jsdelivr.net/npm/three@0.157.0/examples/jsm/geometries/TextGeometry.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.157.0/examples/jsm/loaders/GLTFLoader.js';

socket.on('swing', (data) => {
  angularVelocity += data.impulse;
});

let scene, camera, renderer, loader;
let balancoire = null;
let siegeBalancoire = null;
let ropeBalancoire = null;
let sapins = [];
let angle = 0;
let angularVelocity = 0;
let angularAcceleration = 0;
let playerGenre = null;
let pitch = 0;
let yaw = 0;
let isPointerDown = false;
let lastPointerX = 0;
let lastPointerY = 0;
let cameraPivot;
let targetYaw = 0, targetPitch = 0;
let vueProche = true;
let particles, particlePositions;

const PARTICLE_COUNT = 200; // nombre de particules
const gravity = 5;
const ropeLengthMeters = 2;
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
  createParticles();
  createPanoramicText();
  loadScene();
  loadBalancoire();
  animate();
}

function initScene() {
  scene = new THREE.Scene();

  // 🌙 Ambiance nocturne
  scene.background = new THREE.Color(0x0b0d26);
  const ambient = new THREE.AmbientLight(0x404080, 0.4);
  scene.add(ambient);

  const moonLight = new THREE.DirectionalLight(0xb0c4de, 0.8);
  moonLight.position.set(5, 10, -5);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.width = 512;
  moonLight.shadow.mapSize.height = 512;
  moonLight.shadow.bias = -0.0001;
  scene.add(moonLight);

  const fillLight = new THREE.HemisphereLight(0x222244, 0x080820, 0.3);
  scene.add(fillLight);

  // Camera
  camera = new THREE.PerspectiveCamera(100, window.innerWidth / window.innerHeight, 0.1, 1000);
  cameraPivot = new THREE.Object3D();
  scene.add(cameraPivot);
  cameraPivot.add(camera);
  camera.position.set(0, -0.2, 0.05);

  // Sol
  const groundGeo = new THREE.PlaneGeometry(200, 200);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x223322 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  loader = new GLTFLoader();
  window.addEventListener('resize', onWindowResize);

  // === Contrôle fluide caméra ===
  let lastUpdate = 0;

  window.addEventListener('mousedown', (e) => {
    isPointerDown = true;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
  });

  window.addEventListener('mouseup', () => { isPointerDown = false; });

  window.addEventListener('mousemove', (e) => {
    if (!isPointerDown) return;
    const now = performance.now();
    if (now - lastUpdate < 16) return;
    lastUpdate = now;

    const dx = e.clientX - lastPointerX;
    const dy = e.clientY - lastPointerY;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;

    const sensitivity = 0.002;
    targetYaw   -= dx * sensitivity;
    targetPitch -= dy * sensitivity;
    targetPitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, targetPitch));
  });

  // --- Touch (mobile)
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
    targetYaw   -= dx * sensitivity;
    targetPitch -= dy * sensitivity;
    targetPitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, targetPitch));
  });
}



let particleBasePositions; // positions relatives initiales

function createParticles() {
  const geometry = new THREE.BufferGeometry();
  particlePositions = new Float32Array(PARTICLE_COUNT * 3);
  particleBasePositions = new Float32Array(PARTICLE_COUNT * 3);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const x = (Math.random() - 0.5) * 2;
    const y = Math.random() * 2;
    const z = (Math.random() - 0.5) * 2;

    particlePositions[i*3 + 0] = x;
    particlePositions[i*3 + 1] = y;
    particlePositions[i*3 + 2] = z;

    particleBasePositions[i*3 + 0] = x;
    particleBasePositions[i*3 + 1] = y;
    particleBasePositions[i*3 + 2] = z;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.005,
    transparent: true,
    opacity: 0.7
  });

  particles = new THREE.Points(geometry, material);
  scene.add(particles);
}

function updateParticles() {
  if (!particles) return;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    // descend
    particleBasePositions[i*3 + 1] -= 0.01;

    // réinitialiser si trop bas
    if (particleBasePositions[i*3 + 1] < -3) {
      particleBasePositions[i*3 + 1] = 2 + Math.random() * 1; // on remet en haut
      particleBasePositions[i*3 + 0] = (Math.random() - 0.5) * 2;
      particleBasePositions[i*3 + 2] = (Math.random() - 0.5) * 2;
    }

    // appliquer position relative à la caméra
    particlePositions[i*3 + 0] = particleBasePositions[i*3 + 0] + camera.position.x;
    particlePositions[i*3 + 1] = particleBasePositions[i*3 + 1] + camera.position.y;
    particlePositions[i*3 + 2] = particleBasePositions[i*3 + 2] + camera.position.z;
  }

  particles.geometry.attributes.position.needsUpdate = true;
}


let zeinaTextMesh; // variable globale pour y accéder dans animate()

function createPanoramicText() {
    const fontLoader = new FontLoader();
    fontLoader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', (font) => {
        const textGeo = new TextGeometry('Zeina', {
            font: font,
            size: 10,
            height: 0.5,
            curveSegments: 4,
            bevelEnabled: false,
            bevelThickness: 0.2,
            bevelSize: 0.1,
            bevelSegments: 3
        });

        const textMat = new THREE.MeshStandardMaterial({
            color: 0x9900ff,      // violet
            emissive: 0x6600ff,   // violet scintillant
            emissiveIntensity: 1,
            metalness: 0.2,
            roughness: 0.3
        });

        zeinaTextMesh = new THREE.Mesh(textGeo, textMat);
        zeinaTextMesh.position.set(-20, 30, -50);  // position panoramique
        zeinaTextMesh.rotation.y = -Math.PI / 8;   // légère inclinaison

        scene.add(zeinaTextMesh);

        // Ajouter une petite lumière pour refléter le violet sur la scène (optionnel et léger)
        const textLight = new THREE.PointLight(0x9900ff, 0.2, 50);
        textLight.position.set(-20, 30, -50);
        scene.add(textLight);
    });
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
    (err) => console.warn('Erreur chargement scene.glb :', err)
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
    (err) => console.error('Erreur chargement swing.glb :', err)
  );

  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'b' && playerGenre === 'garcon') pousserBalancoire();
  });

  document.getElementById('btnPush').addEventListener('click', () => {
    if (playerGenre === 'garcon') pousserBalancoire();
  });

  document.getElementById('btnVue').addEventListener('click', () => {
    vueProche = !vueProche;
  });
}

function pousserBalancoire() {
  if (Math.abs(angle) < 0.05 && angularVelocity >= 0) {
    angularVelocity += impulseStrength;
    if (socket && socket.connected) socket.emit('swing', { impulse: impulseStrength });
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateCameraFollowSeat() {
  if (!siegeBalancoire) return;

  const seatWorldPos = new THREE.Vector3();
  siegeBalancoire.getWorldPosition(seatWorldPos);
  cameraPivot.position.lerp(seatWorldPos, 0.1);

  const seatWorldQuat = new THREE.Quaternion();
  siegeBalancoire.getWorldQuaternion(seatWorldQuat);
  cameraPivot.quaternion.slerp(seatWorldQuat, 0.1);

  yaw += (targetYaw - yaw) * 0.1;
  pitch += (targetPitch - pitch) * 0.1;

  const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
  const freeQuat = new THREE.Quaternion().setFromEuler(euler);
  camera.quaternion.copy(freeQuat);

  const targetZ = vueProche ? 0 : 0.35;
  camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, 0.05);
}

function updatePhysics(dt) {
  angularAcceleration = -(gravity / ropeLengthMeters) * Math.sin(angle) - damping * angularVelocity;
  angularVelocity += angularAcceleration * dt;
  angle += angularVelocity * dt;

  if (angle > maxAngle) { angle = maxAngle; angularVelocity = 0; }
  if (angle < -maxAngle) { angle = -maxAngle; angularVelocity = 0; }

  if (ropeBalancoire) ropeBalancoire.rotation.x = angle;
  if (siegeBalancoire) siegeBalancoire.rotation.x = angle;
}

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  updatePhysics(delta);

  // Animation sapins optimisée
  if (sapins.length > 0 && Date.now() % 2 === 0) { // toutes les 2ms
    for(let i = 0; i < sapins.length; i++) {
      sapins[i].rotation.y = 0.01 * Math.sin(Date.now() * 0.002 + i);
      sapins[i].rotation.x = 0.01 * Math.sin(Date.now() * 0.002 + i);
    }
  }

  updateCameraFollowSeat();
  updateParticles();


  if (zeinaTextMesh) {
    zeinaTextMesh.material.emissiveIntensity = 0.8 + 0.05 * Math.sin(Date.now() * 0.001);
  }

  renderer.render(scene, camera);
}






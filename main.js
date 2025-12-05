import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';
import { PointerLockControls } from 'https://unpkg.com/three@0.161.0/examples/jsm/controls/PointerLockControls.js';

let camera, scene, renderer;
let controls;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;

let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let prevTime = performance.now();

const objects = [];      // collidable world
const enemies = [];      // enemy targets
let health = 100;
let kills = 0;

// HUD elements
const overlay = document.getElementById('overlay');
const healthEl = document.getElementById('health');
const killsEl = document.getElementById('kills');

init();
animate();

function init() {
  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101010);
  scene.fog = new THREE.Fog(0x101010, 10, 200);

  // Camera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

  // Lights
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
  hemiLight.position.set(0, 200, 0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(5, 20, 10);
  scene.add(dirLight);

  // Pointer lock controls
  controls = new PointerLockControls(camera, document.body);
  controls.getObject().position.set(0, 5, 0);
  scene.add(controls.getObject());

  overlay.addEventListener('click', () => {
    controls.lock();
  });

  controls.addEventListener('lock', () => {
    overlay.style.display = 'none';
  });

  controls.addEventListener('unlock', () => {
    overlay.style.display = 'flex';
  });

  // Floor
  const floorGeo = new THREE.PlaneGeometry(400, 400);
  const floorMat = new THREE.MeshPhongMaterial({ color: 0x222222, depthWrite: true });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Some walls / cover
  createWorld();

  // Enemies
  spawnEnemies(15);

  // Events
  const onKeyDown = function (event) {
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        moveForward = true;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        moveLeft = true;
        break;
      case 'ArrowDown':
      case 'KeyS':
        moveBackward = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        moveRight = true;
        break;
      case 'Space':
        if (canJump === true) velocity.y += 8;
        canJump = false;
        break;
    }
  };

  const onKeyUp = function (event) {
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        moveForward = false;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        moveLeft = false;
        break;
      case 'ArrowDown':
      case 'KeyS':
        moveBackward = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        moveRight = false;
        break;
    }
  };

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);

  // Shooting
  document.addEventListener('mousedown', (e) => {
    if (controls.isLocked === true && e.button === 0) {
      shoot();
    }
  });

  window.addEventListener('resize', onWindowResize);
}

function createWorld() {
  const wallMat = new THREE.MeshPhongMaterial({ color: 0x555555 });
  const crateMat = new THREE.MeshPhongMaterial({ color: 0x444444 });

  // Perimeter walls
  const wallGeoLong = new THREE.BoxGeometry(400, 10, 2);
  const wallGeoShort = new THREE.BoxGeometry(2, 10, 400);

  const wall1 = new THREE.Mesh(wallGeoLong, wallMat);
  wall1.position.set(0, 5, -200);
  scene.add(wall1);
  objects.push(wall1);

  const wall2 = wall1.clone();
  wall2.position.set(0, 5, 200);
  scene.add(wall2);
  objects.push(wall2);

  const wall3 = new THREE.Mesh(wallGeoShort, wallMat);
  wall3.position.set(-200, 5, 0);
  scene.add(wall3);
  objects.push(wall3);

  const wall4 = wall3.clone();
  wall4.position.set(200, 5, 0);
  scene.add(wall4);
  objects.push(wall4);

  // Some random crates / cover
  const crateGeo = new THREE.BoxGeometry(5, 5, 5);
  for (let i = 0; i < 30; i++) {
    const crate = new THREE.Mesh(crateGeo, crateMat);
    crate.position.set(
      (Math.random() - 0.5) * 300,
      2.5,
      (Math.random() - 0.5) * 300
    );
    scene.add(crate);
    objects.push(crate);
  }
}

function spawnEnemies(count) {
  const enemyGeo = new THREE.BoxGeometry(3, 5, 3);
  const enemyMat = new THREE.MeshPhongMaterial({ color: 0xaa0000 });

  for (let i = 0; i < count; i++) {
    const enemy = new THREE.Mesh(enemyGeo, enemyMat.clone());
    enemy.position.set(
      (Math.random() - 0.5) * 300,
      2.5,
      (Math.random() - 0.5) * 300
    );
    enemy.userData.health = 100;
    scene.add(enemy);
    enemies.push(enemy);
  }
}

function shoot() {
  const raycaster = new THREE.Raycaster();
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);

  raycaster.set(camera.position, dir);

  const intersects = raycaster.intersectObjects(enemies, false);

  if (intersects.length > 0) {
    const hit = intersects[0].object;
    hit.userData.health -= 100; // one-shot kill for now

    // Simple "flash" feedback
    hit.material.emissive = new THREE.Color(0xffffff);
    setTimeout(() => {
      hit.material.emissive = new THREE.Color(0x000000);
    }, 100);

    if (hit.userData.health <= 0) {
      scene.remove(hit);
      const idx = enemies.indexOf(hit);
      if (idx > -1) enemies.splice(idx, 1);
      kills++;
      killsEl.textContent = kills.toString();
    }
  }
}

function enemyAI(delta) {
  // Very simple: enemies slowly move toward player and do damage if close
  const playerPos = controls.getObject().position;

  enemies.forEach(enemy => {
    const dir = new THREE.Vector3().subVectors(playerPos, enemy.position);
    const distance = dir.length();

    if (distance > 5 && distance < 80) {
      dir.normalize();
      const speed = 5;
      enem

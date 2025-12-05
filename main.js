// Uses global THREE and THREE.PointerLockControls from script tags in index.html

let camera, scene, renderer;
let controls;

let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let isSprinting = false;
let canJump = false;

let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let prevTime = performance.now();

const objects = [];
const enemies = [];

let health = 100;
let kills = 0;

let lastDamageTime = 0;
const REGEN_DELAY = 3;
const REGEN_RATE = 15;

const MAG_SIZE = 30;
let ammoInMag = MAG_SIZE;
let reserveAmmo = 120;
let isReloading = false;
const RELOAD_TIME = 1.5;

const menuOverlay = document.getElementById('menuOverlay');
const playButton = document.getElementById('playButton');
const pauseOverlay = document.getElementById('pauseOverlay');

const healthEl = document.getElementById('health');
const ammoEl = document.getElementById('ammo');
const reserveAmmoEl = document.getElementById('reserveAmmo');
const killsEl = document.getElementById('kills');
const reloadHintEl = document.getElementById('reloadHint');
const hitmarkerEl = document.getElementById('hitmarker');
const killfeedEl = document.getElementById('killfeed');

let gameStarted = false;
let gunGroup;

init();
animate();

function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050505);
  scene.fog = new THREE.Fog(0x050505, 10, 250);

  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x222222, 0.6);
  hemiLight.position.set(0, 200, 0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
  dirLight.position.set(30, 50, -30);
  scene.add(dirLight);

  controls = new THREE.PointerLockControls(camera, document.body);
  controls.getObject().position.set(0, 5, 0);
  scene.add(controls.getObject());

  playButton.addEventListener('click', () => {
    startGame();
  });

  controls.addEventListener('lock', () => {
    pauseOverlay.style.display = 'none';
  });

  controls.addEventListener('unlock', () => {
    if (gameStarted) {
      pauseOverlay.style.display = 'flex';
    }
  });

  const floorGeo = new THREE.PlaneGeometry(400, 400);
  const floorMat = new THREE.MeshPhongMaterial({ color: 0x202020, depthWrite: true });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  createMap();
  spawnEnemies(18);
  createGunModel();

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);

  document.addEventListener('mousedown', (e) => {
    if (!gameStarted) return;
    if (controls.isLocked && e.button === 0) {
      handleShoot();
    } else if (gameStarted && !controls.isLocked) {
      controls.lock();
    }
  });

  pauseOverlay.addEventListener('click', () => {
    if (!controls.isLocked && gameStarted) {
      controls.lock();
    }
  });

  window.addEventListener('resize', onWindowResize);

  updateHUD();
}

function startGame() {
  menuOverlay.style.display = 'none';
  gameStarted = true;
  controls.lock();
}

function createMap() {
  const wallMat = new THREE.MeshPhongMaterial({ color: 0x404040 });
  const buildingMat = new THREE.MeshPhongMaterial({ color: 0x262626 });
  const crateMat = new THREE.MeshPhongMaterial({ color: 0x353535 });

  const wallGeoLong = new THREE.BoxGeometry(400, 12, 2);
  const wallGeoShort = new THREE.BoxGeometry(2, 12, 400);

  const wall1 = new THREE.Mesh(wallGeoLong, wallMat);
  wall1.position.set(0, 6, -200);
  scene.add(wall1);
  objects.push(wall1);

  const wall2 = wall1.clone();
  wall2.position.set(0, 6, 200);
  scene.add(wall2);
  objects.push(wall2);

  const wall3 = new THREE.Mesh(wallGeoShort, wallMat);
  wall3.position.set(-200, 6, 0);
  scene.add(wall3);
  objects.push(wall3);

  const wall4 = wall3.clone();
  wall4.position.set(200, 6, 0);
  scene.add(wall4);
  objects.push(wall4);

  const buildingGeo = new THREE.BoxGeometry(25, 25, 25);
  const buildingPositions = [
    [-100, 12.5, -100],
    [100, 12.5, -100],
    [-100, 12.5, 100],
    [100, 12.5, 100],
    [0, 12.5, -140],
    [0, 12.5, 140],
  ];

  for (const pos of buildingPositions) {
    const b = new THREE.Mesh(buildingGeo, buildingMat);
    b.position.set(pos[0], pos[1], pos[2]);
    scene.add(b);
    objects.push(b);
  }

  const crateGeo = new THREE.BoxGeometry(5, 5, 5);
  for (let i = 0; i < 40; i++) {
    const crate = new THREE.Mesh(crateGeo, crateMat);
    crate.position.set(
      (Math.random() - 0.5) * 320,
      2.5,
      (Math.random() - 0.5) * 320
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
    enemy.userData.maxHealth = 100;
    enemy.userData.lastHitTime = 0;
    scene.add(enemy);
    enemies.push(enemy);
  }
}

function createGunModel() {
  gunGroup = new THREE.Group();

  const gunBodyGeo = new THREE.BoxGeometry(1.2, 0.6, 2.8);
  const gunBodyMat = new THREE.MeshPhongMaterial({ color: 0x111111 });
  const gunBody = new THREE.Mesh(gunBodyGeo, gunBodyMat);
  gunBody.position.set(0, -0.4, -1.2);

  const barrelGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.4, 16);
  const barrelMat = new THREE.MeshPhongMaterial({ color: 0x222222 });
  const barrel = new THREE.Mesh(barrelGeo, barrelMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, -0.35, -2.1);

  gunGroup.add(gunBody);
  gunGroup.add(barrel);

  gunGroup.position.set(0.4, -0.3, -0.8);
  camera.add(gunGroup);
}

function onKeyDown(event) {
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
    case 'ShiftLeft':
    case 'ShiftRight':
      isSprinting = true;
      break;
    case 'KeyR':
      tryReload();
      break;
  }
}

function onKeyUp(event) {
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
    case 'ShiftLeft':
    case 'ShiftRight':
      isSprinting = false;
      break;
  }
}

function handleShoot() {
  if (!gameStarted || isReloading) return;

  if (ammoInMag <= 0) {
    showReloadHint('Out of ammo – press R to reload');
    return;
  }

  ammoInMag--;
  updateHUD();

  const raycaster = new THREE.Raycaster();
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  raycaster.set(camera.position.clone(), dir);

  const intersects = raycaster.intersectObjects(enemies, false);

  if (intersects.length > 0) {
    const hit = intersects[0].object;

    const damage = 50;
    hit.userData.health -= damage;
    hit.userData.lastHitTime = performance.now() / 1000;

    showHitmarker();

    if (hit.userData.health <= 0) {
      addKill(hit);
    }
  }

  if (gunGroup) {
    gunGroup.position.z = -0.9;
    setTimeout(() => {
      gunGroup.position.z = -0.8;
    }, 80);
  }
}

function tryReload() {
  if (isReloading) return;
  if (ammoInMag >= MAG_SIZE) return;
  if (reserveAmmo <= 0) {
    showReloadHint('No reserve ammo');
    return;
  }

  isReloading = true;
  reloadHintEl.textContent = 'Reloading...';
  reloadHintEl.style.display = 'block';

  setTimeout(() => {
    const needed = MAG_SIZE - ammoInMag;
    const toLoad = Math.min(needed, reserveAmmo);
    ammoInMag += toLoad;
    reserveAmmo -= toLoad;

    isReloading = false;
    reloadHintEl.style.display = 'none';
    updateHUD();
  }, RELOAD_TIME * 1000);
}

function showHitmarker() {
  hitmarkerEl.classList.add('active');
  setTimeout(() => {
    hitmarkerEl.classList.remove('active');
  }, 100);
}

function addKill(enemy) {
  scene.remove(enemy);
  const idx = enemies.indexOf(enemy);
  if (idx > -1) enemies.splice(idx, 1);

  kills++;
  killsEl.textContent = kills.toString();

  const line = document.createElement('div');
  line.textContent = `You eliminated enemy`;
  killfeedEl.prepend(line);

  while (killfeedEl.children.length > 5) {
    killfeedEl.removeChild(killfeedEl.lastChild);
  }
}

function showReloadHint(msg) {
  reloadHintEl.textContent = msg;
  reloadHintEl.style.display = 'block';
  setTimeout(() => {
    if (!isReloading) {
      reloadHintEl.style.display = 'none';
    }
  }, 1200);
}

function updateHUD() {
  healthEl.textContent = Math.floor(health).toString();
  ammoEl.textContent = ammoInMag.toString();
  reserveAmmoEl.textContent = reserveAmmo.toString();
}

function enemyAI(delta) {
  const playerPos = controls.getObject().position;

  enemies.forEach(enemy => {
    const dir = new THREE.Vector3().subVectors(playerPos, enemy.position);
    const distance = dir.length();

    if (distance > 6 && distance < 90) {
      dir.normalize();
      const speed = 8;
      enemy.position.addScaledVector(dir, speed * delta);
    } else if (distance >= 90) {
      enemy.position.x += (Math.random() - 0.5) * 2 * delta * 15;
      enemy.position.z += (Math.random() - 0.5) * 2 * delta * 15;
    }

    if (distance <= 4) {
      const damagePerSecond = 12;
      health -= damagePerSecond * delta;
      if (health < 0) health = 0;
      lastDamageTime = performance.now() / 1000;
      updateHUD();
      if (health <= 0) handleDeath();
    }
  });
}

function handleDeath() {
  health = 0;
  updateHUD();
  gameStarted = false;
  controls.unlock();
  pauseOverlay.style.display = 'flex';
  pauseOverlay.innerHTML = `
    <h2>You Died</h2>
    <p>Kills: ${kills}</p>
    <p>Refresh the page to restart</p>
  `;
}

function regenHealth(delta) {
  const now = performance.now() / 1000;
  if (now - lastDamageTime > REGEN_DELAY && health > 0 && health < 100) {
    health += REGEN_RATE * delta;
    if (health > 100) health = 100;
    updateHUD();
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);

  const time = performance.now();
  const delta = (time - prevTime) / 1000;

  if (gameStarted && controls.isLocked === true) {
    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;
    velocity.y -= 9.8 * 5.0 * delta;

    direction.z = Number(moveForward) - Number(moveBackward);
    direction.x = Number(moveRight) - Number(moveLeft);
    direction.normalize();

    const baseSpeed = 45.0;
    const sprintMultiplier = isSprinting ? 1.7 : 1.0;
    const speed = baseSpeed * sprintMultiplier;

    if (moveForward || moveBackward) velocity.z -= direction.z * speed * delta;
    if (moveLeft || moveRight) velocity.x -= direction.x * speed * delta;

    const controlObject = controls.getObject();
    const oldPosition = controlObject.position.clone();

    controlObject.position.x += velocity.x * delta;
    controlObject.position.z += velocity.z * delta;
    controlObject.position.y += velocity.y * delta;

    if (controlObject.position.y < 2) {
      velocity.y = 0;
      controlObject.position.y = 2;
      canJump = true;
    }

    const playerBox = new THREE.Box3().setFromCenterAndSize(
      controlObject.position,
      new THREE.Vector3(2, 6, 2)
    );

    for (let i = 0; i < objects.length; i++) {
      const box = new THREE.Box3().setFromObject(objects[i]);
      if (box.intersectsBox(playerBox)) {
        controlObject.position.x = oldPosition.x;
        controlObject.position.z = oldPosition.z;
        break;
      }
    }

    enemyAI(delta);
    regenHealth(delta);
  }

  prevTime = time;
  renderer.render(scene, camera);
}

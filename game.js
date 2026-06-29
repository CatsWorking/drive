import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// --- GAME STATE ---
const state = {
    running: false,
    speed: 0,
    gear: 0, // -1 (R), 0 (N), 1, 2, 3, 4
    health: 100,
    windowsOpen: false,
    headlightsOn: false,
    cameraView: 'third', // 'third' or 'first'
    timeOfDay: 0 // 0 to Math.PI * 2
};

const keys = { w: false, a: false, s: false, d: false, c: false, space: false };

// --- AUDIO MANAGER ---
const audioCache = {};
let currentEngineSound = null;

// Helper to load sounds
function loadSound(name) {
    const audio = new Audio(`media/${name}.mp3`);
    audio.loop = true;
    audioCache[name] = audio;
    return audio;
}

// Preload all user-specified sounds
const soundsToLoad = [
    'firstgearv8close', 'firstgearv8open', 'fourthgearv8close', 'fourthgearv8open',
    'idlev8close', 'idlev8open', 'secondgearv8close', 'secondgearv8open',
    'thirdgearv8close', 'thirdgearv8open'
];
soundsToLoad.forEach(loadSound);

const sfxStartClose = new Audio('media/startv8close.mp3');
const sfxStartOpen = new Audio('media/startv8open.mp3');
const sfxHeadlights = new Audio('media/headlights.mp3');

function updateEngineAudio() {
    if (currentEngineSound) currentEngineSound.pause();
    
    let windowState = state.windowsOpen ? 'open' : 'close';
    let soundName = `idlev8${windowState}`;

    if (state.gear === 1 || state.gear === -1) soundName = `firstgearv8${windowState}`;
    else if (state.gear === 2) soundName = `secondgearv8${windowState}`;
    else if (state.gear === 3) soundName = `thirdgearv8${windowState}`;
    else if (state.gear === 4) soundName = `fourthgearv8${windowState}`;

    currentEngineSound = audioCache[soundName];
    if (currentEngineSound) {
        // Adjust pitch/volume based on speed for realism
        currentEngineSound.playbackRate = 0.8 + (Math.abs(state.speed) / 100);
        currentEngineSound.play().catch(e => console.log("Audio play blocked", e));
    }
}

// --- THREE.JS SETUP ---
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.015);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Post-Processing (Bloom)
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = 0.5;
bloomPass.strength = 1.2;
composer.addPass(bloomPass);

// --- CAR SETUP ---
const carGroup = new THREE.Group();
scene.add(carGroup);

// Exterior (Simple Box)
const bodyGeo = new THREE.BoxGeometry(2, 1, 4);
const bodyMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
const carBody = new THREE.Mesh(bodyGeo, bodyMat);
carBody.position.y = 0.5;
carBody.castShadow = true;
carGroup.add(carBody);

// Primitive Interior (Visible in 1st person)
const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.05, 16);
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
const steeringWheel = new THREE.Mesh(wheelGeo, wheelMat);
steeringWheel.rotation.x = Math.PI / 4;
steeringWheel.position.set(-0.5, 0.8, -0.5);
carGroup.add(steeringWheel);

// Headlights
const leftHeadlight = new THREE.SpotLight(0xffffff, 0, 100, Math.PI/6, 0.5, 1);
leftHeadlight.position.set(-0.8, 0.5, -2);
leftHeadlight.target.position.set(-0.8, 0.5, -10);
leftHeadlight.castShadow = true;
carGroup.add(leftHeadlight);
carGroup.add(leftHeadlight.target);

const rightHeadlight = new THREE.SpotLight(0xffffff, 0, 100, Math.PI/6, 0.5, 1);
rightHeadlight.position.set(0.8, 0.5, -2);
rightHeadlight.target.position.set(0.8, 0.5, -10);
rightHeadlight.castShadow = true;
carGroup.add(rightHeadlight);
carGroup.add(rightHeadlight.target);

// --- ENVIRONMENT SETUP ---
const sunLight = new THREE.DirectionalLight(0xffeedd, 1);
sunLight.castShadow = true;
scene.add(sunLight);

const ambientLight = new THREE.AmbientLight(0x222222);
scene.add(ambientLight);

// Infinite Road Variables
const roadSegments = [];
const segmentLength = 50;
const roadGeo = new THREE.PlaneGeometry(20, segmentLength);
const roadMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });

for (let i = 0; i < 10; i++) {
    const segment = new THREE.Mesh(roadGeo, roadMat);
    segment.rotation.x = -Math.PI / 2;
    segment.position.z = -i * segmentLength;
    segment.receiveShadow = true;
    scene.add(segment);
    roadSegments.push(segment);
}

// --- INPUT HANDLING ---
window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (keys.hasOwnProperty(k) || k === ' ') keys[k === ' ' ? 'space' : k] = true;

    if (!state.running) return;

    // Gear Up
    if (k === 'e') {
        if (!keys.c && state.gear !== 0) damageEngine();
        if (state.gear < 4) state.gear++;
        updateUI();
        updateEngineAudio();
    }
    // Gear Down
    if (k === 'q') {
        if (!keys.c && state.gear !== 0) damageEngine();
        if (state.gear > -1) state.gear--;
        updateUI();
        updateEngineAudio();
    }
    // Windows
    if (k === 'r') {
        state.windowsOpen = !state.windowsOpen;
        updateEngineAudio();
    }
    // Headlights
    if (k === 'f') {
        state.headlightsOn = !state.headlightsOn;
        const intensity = state.headlightsOn ? 50 : 0;
        leftHeadlight.intensity = intensity;
        rightHeadlight.intensity = intensity;
        sfxHeadlights.currentTime = 0;
        sfxHeadlights.play().catch(e => {});
    }
    // Camera
    if (k === 'v') {
        state.cameraView = state.cameraView === 'third' ? 'first' : 'third';
    }
});

window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (keys.hasOwnProperty(k) || k === ' ') keys[k === ' ' ? 'space' : k] = false;
});

function damageEngine() {
    state.health -= 5;
    const warn = document.getElementById('clutchWarning');
    warn.innerText = "CLUTCH DAMAGE! USE 'C'";
    setTimeout(() => warn.innerText = "", 1000);
    if (state.health <= 0) alert("Engine Blown!");
}

function updateUI() {
    document.getElementById('gearDisplay').innerText = state.gear === -1 ? 'R' : (state.gear === 0 ? 'N' : state.gear);
    document.getElementById('healthDisplay').innerText = state.health;
}

// --- GAME LOOP ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    if (state.running && state.health > 0) {
        // Day/Night Cycle (Simple rotation)
        state.timeOfDay += delta * 0.05;
        sunLight.position.x = Math.cos(state.timeOfDay) * 100;
        sunLight.position.y = Math.sin(state.timeOfDay) * 100;
        sunLight.intensity = Math.max(0, Math.sin(state.timeOfDay) * 2);
        
        // Adjust ambient light and fog based on time of day
        const nightFactor = Math.max(0, Math.sin(state.timeOfDay));
        ambientLight.intensity = 0.1 + (nightFactor * 0.5);
        scene.fog.color.setHSL(0.6, 0.2, 0.05 + (nightFactor * 0.5));
        scene.background = scene.fog.color;

        // Acceleration & Physics
        let maxSpeed = state.gear * 30; // Max speed based on gear
        if (state.gear === -1) maxSpeed = -15;
        if (state.gear === 0) maxSpeed = 0;

        if (keys.w && state.gear !== 0) state.speed += (state.gear > 0 ? 0.5 : -0.5);
        if (keys.s) state.speed *= 0.95; // Brake
        if (keys.space) state.speed *= 0.85; // Handbrake
        
        // Drag and coasting
        if (!keys.w) state.speed *= 0.99;
        
        // Limit speed to gear
        if (state.gear > 0 && state.speed > maxSpeed) state.speed = maxSpeed;
        if (state.gear === -1 && state.speed < maxSpeed) state.speed = maxSpeed;

        // Steering
        if (state.speed !== 0) {
            const turnSpeed = (0.02 / (Math.abs(state.speed) * 0.05 + 1)); 
            if (keys.a) carGroup.rotation.y += turnSpeed;
            if (keys.d) carGroup.rotation.y -= turnSpeed;
            steeringWheel.rotation.y = keys.a ? 0.5 : (keys.d ? -0.5 : 0);
        }

        // Move Car
        carGroup.translateZ(-state.speed * delta);

        // Infinite Road Logic
        roadSegments.forEach(segment => {
            // If segment is too far behind the car, move it in front
            if (segment.position.z > carGroup.position.z + segmentLength) {
                segment.position.z -= segmentLength * roadSegments.length;
            }
        });

        // Camera positioning
        if (state.cameraView === 'third') {
            const relativeCameraOffset = new THREE.Vector3(0, 3, 7);
            const cameraOffset = relativeCameraOffset.applyMatrix4(carGroup.matrixWorld);
            camera.position.lerp(cameraOffset, 0.1);
            camera.lookAt(carGroup.position);
        } else {
            // First Person
            const relativeCameraOffset = new THREE.Vector3(-0.5, 1.2, -0.5);
            const cameraOffset = relativeCameraOffset.applyMatrix4(carGroup.matrixWorld);
            camera.position.copy(cameraOffset);
            
            // Look slightly ahead
            const lookPos = new THREE.Vector3(0, 1.2, -5).applyMatrix4(carGroup.matrixWorld);
            camera.lookAt(lookPos);
        }

        // Audio pitch update
        if (currentEngineSound) {
            currentEngineSound.playbackRate = 0.8 + (Math.abs(state.speed) / (maxSpeed || 1) * 0.5);
        }

        document.getElementById('speedDisplay').innerText = Math.abs(Math.floor(state.speed * 3.6)); // roughly to km/h
    }

    composer.render();
}

// Initialization (Required to unlock audio policies in browsers)
document.getElementById('startBtn').addEventListener('click', () => {
    document.getElementById('start-screen').style.display = 'none';
    
    const startSfx = state.windowsOpen ? sfxStartOpen : sfxStartClose;
    startSfx.play().catch(e => console.error(e));
    
    setTimeout(() => {
        state.running = true;
        updateEngineAudio();
        animate();
    }, 1500); // Wait for start sound to finish roughly
});

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

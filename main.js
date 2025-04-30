

import * as THREE from
  'https://cdn.jsdelivr.net/npm/three@0.164/build/three.module.js';
import { PointerLockControls } from
  'https://cdn.jsdelivr.net/npm/three@0.164/examples/jsm/controls/PointerLockControls.js';
import { GLTFLoader } from
  'https://cdn.jsdelivr.net/npm/three@0.164/examples/jsm/loaders/GLTFLoader.js';
import { ImprovedNoise } from
  'https://cdn.jsdelivr.net/npm/three@0.164/examples/jsm/math/ImprovedNoise.js';
import { Sky } from
  'https://cdn.jsdelivr.net/npm/three@0.164/examples/jsm/objects/Sky.js';
import GUI from
  'https://cdn.jsdelivr.net/npm/lil-gui@0.19/+esm';
  

/* ──────────────────────────────────────────────────────────
   1.  BASIC THREE SET-UP
   ────────────────────────────────────────────────────────── */
const scene     = new THREE.Scene();
scene.background = new THREE.Color(0x100020);   // deep violet
scene.fog        = new THREE.FogExp2(0x090012, 0.0012);  

const renderer  = new THREE.WebGLRenderer({ antialias:true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);


const camera    = new THREE.PerspectiveCamera(60,
                      innerWidth/innerHeight, 0.1, 2000);
const EYE = 5;
camera.position.set(0, EYE, 60);


/* ──────────────────────────────────────────────────────────
   2.  POINTER-LOCK CONTROLS
   ────────────────────────────────────────────────────────── */
const controls  = new PointerLockControls(camera, renderer.domElement);
scene.add(controls.getObject());

const hud = document.createElement('div');
hud.id   = 'hud';
hud.innerHTML = `<p>Click to start<br>WASD + mouse to move<br>G → GUI</p>`;
document.body.appendChild(hud);
controls.addEventListener('lock',   () => hud.style.display='none');
controls.addEventListener('unlock', () => hud.style.display='');
document.body.addEventListener('click', () => controls.lock());

/* movement state */
const move = {f:0,b:0,l:0,r:0};
addEventListener('keydown', e=>{switch(e.code){
  case'KeyW':case'ArrowUp'  :move.f=1;break;
  case'KeyS':case'ArrowDown':move.b=1;break;
  case'KeyA':case'ArrowLeft':move.l=1;break;
  case'KeyD':case'ArrowRight':move.r=1;break;
}});
addEventListener('keyup',   e=>{switch(e.code){
  case'KeyW':case'ArrowUp'  :move.f=0;break;
  case'KeyS':case'ArrowDown':move.b=0;break;
  case'KeyA':case'ArrowLeft':move.l=0;break;
  case'KeyD':case'ArrowRight':move.r=0;break;
}});

/* ──────────────────────────────────────────────────────────
   3.  GLOBAL PARAMS & GUI
   ────────────────────────────────────────────────────────── */
const params = {
  terrainHeight : 18,
  moveSpeed     : 400
};
const gui = new GUI({title:'Debug', width:310});
gui.hide();
addEventListener('keydown', e=>{
  if(e.code==='KeyG'){ gui._hidden ? gui.show() : gui.hide(); }
});
gui.add(params,'terrainHeight',5,40,.1).onChange(()=>buildTerrain());
gui.add(params,'moveSpeed',100,900,10);

/* ──────────────────────────────────────────────────────────
   4.  LIGHTING + ATMOSPHERE
   ────────────────────────────────────────────────────────── */
scene.add(new THREE.HemisphereLight(0x3355aa, 0x080814, 0.4));   // cool moon-wash
const sun = new THREE.DirectionalLight(0x99aaff, 0.35);  
sun.position.set(120,300,-200);
sun.castShadow = true;
scene.add(sun);

/* soft ambient for night glow */
scene.add(new THREE.AmbientLight(0x101830, 0.55)); 

/* physical sky */
const sky = new Sky();
sky.scale.setScalar(4000);
scene.add(sky);

const skyUniforms = sky.material.uniforms;
skyUniforms['rayleigh'].value         = 0.4;    // faint purple scattering
skyUniforms['mieCoefficient'].value   = 0.001;
skyUniforms['mieDirectionalG'].value  = 0.7;

/* sun position for the sky shader */
const sunVec   = new THREE.Vector3();
const phi      = THREE.MathUtils.degToRad(90+8);   // sun ~8° horizon
const theta    = THREE.MathUtils.degToRad(-120);   // azimuth
sunVec.setFromSphericalCoords(1, phi, theta);
sky.material.uniforms['sunPosition'].value.copy(sunVec);
sun.position.copy(sunVec.multiplyScalar(400));

/* ──────────────────────────────────────────────────────────
   5.  TERRAIN (unchanged)
   ────────────────────────────────────────────────────────── */
const SIZE=600, RES=256;
const noise = new ImprovedNoise();
let terrain, terrainGeo, heights=[];
const tex = new THREE.TextureLoader();
function t(name,repeat=16){
  const m=tex.load(`./assets/textures/${name}`);
  m.wrapS = m.wrapT = THREE.RepeatWrapping;
  m.repeat.set(repeat,repeat);
  return m;
}
const terrainMat = new THREE.MeshStandardMaterial({
  map:t('sand_albedo.jpg'), normalMap:t('sand_normal.jpg'),
  roughnessMap:t('sand_rough.jpg'), roughness:1
});
function buildTerrain(){
  if(terrain){scene.remove(terrain); terrainGeo.dispose();}
  heights.length=0;
  terrainGeo = new THREE.PlaneGeometry(SIZE,SIZE,RES,RES);
  terrainGeo.rotateX(-Math.PI/2);
  const pos=terrainGeo.attributes.position;
  for(let i=0;i<pos.count;i++){
    const x=i%(RES+1), z=Math.floor(i/(RES+1));
    const e=noise.noise(x/20,z/20,0)*.6+noise.noise(x/8,z/8,2)*.3;
    heights.push(e);
    pos.setY(i,e*params.terrainHeight);
  }
  pos.needsUpdate=true; terrainGeo.computeVertexNormals();
  terrain=new THREE.Mesh(terrainGeo,terrainMat);
  terrain.receiveShadow=true;
  scene.add(terrain);
}
buildTerrain();
function heightAt(x,z){
  const nx=((x/SIZE)+.5)*RES, nz=((z/SIZE)+.5)*RES;
  const ix=Math.min(Math.max(Math.floor(nx),0),RES);
  const iz=Math.min(Math.max(Math.floor(nz),0),RES);
  return heights[iz*(RES+1)+ix]*params.terrainHeight;
}


/* ──────────────────────────────────────────────────────────
   6.  MODELS
   ────────────────────────────────────────────────────────── */
const gltf = new GLTFLoader();
['Space rover.glb','Space probe.glb','Planet.glb','Moon.glb'].forEach(f=>{
  gltf.load(`./assets/models/${f}`,g=>{
    const root=g.scene||g.scenes?.[0]; if(!root) return;
    root.scale.multiplyScalar(5);
    root.traverse(n=>{if(n.isMesh){n.castShadow=n.receiveShadow=true;}});
    root.position.set(
      THREE.MathUtils.randFloatSpread(SIZE*.8),0,
      THREE.MathUtils.randFloatSpread(SIZE*.8));
    root.position.y = heightAt(root.position.x,root.position.z)+.1;
    root.rotation.y = Math.random()*Math.PI*2;
    scene.add(root);
  });
});

/* ──────────────────────────────────────────────────────────
   7.  MAIN LOOP
   ────────────────────────────────────────────────────────── */
const clock=new THREE.Clock();
const velocity=new THREE.Vector3(), dir=new THREE.Vector3();
function animate(){
  requestAnimationFrame(animate);
  const dt=clock.getDelta();

  if(controls.isLocked){
    velocity.x-=velocity.x*10*dt;
    velocity.z-=velocity.z*10*dt;
    dir.set(move.r-move.l,0,move.b-move.f).normalize();
    if(move.f||move.b) velocity.z-=dir.z*params.moveSpeed*dt;
    if(move.l||move.r) velocity.x-=dir.x*params.moveSpeed*dt;
    controls.moveRight (-velocity.x*dt);
    controls.moveForward(-velocity.z*dt);
    const p=controls.getObject().position;
    p.y=heightAt(p.x,p.z)+EYE;
  }

  renderer.render(scene,camera);
}
animate();

/* ──────────────────────────────────────────────────────────
   8.  RESIZE
   ────────────────────────────────────────────────────────── */
addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});
const intro = document.getElementById('intro');
document.body.addEventListener('click', ()=>{
  intro?.classList.add('fadeOut');
},{ once:true });
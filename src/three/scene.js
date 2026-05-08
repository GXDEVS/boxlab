import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createScene(canvasParent) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f1218);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(40, 30, 40);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  canvasParent.append(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dir = new THREE.DirectionalLight(0xffffff, 0.6);
  dir.position.set(20, 30, 20);
  scene.add(dir);

  const group = new THREE.Group();
  scene.add(group);

  let raf = 0;
  function loop() {
    controls.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }
  loop();

  function resize() {
    const w = canvasParent.clientWidth;
    const h = canvasParent.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvasParent);

  function dispose() {
    cancelAnimationFrame(raf);
    ro.disconnect();
    renderer.dispose();
    if (renderer.domElement.parentNode) renderer.domElement.remove();
  }

  function resetCamera() {
    camera.position.set(40, 30, 40);
    controls.target.set(0, 0, 0);
  }

  return { scene, group, camera, controls, dispose, resetCamera };
}

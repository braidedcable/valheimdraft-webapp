<script lang="ts">
  import { onMount } from 'svelte';
  import * as THREE from 'three';
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
  import piecesData from '../data/pieces.json';
  import { geometryForPiece, type PieceShape } from './scene/geometry';
  import { colorForFamily } from './scene/materials';

  let canvas: HTMLCanvasElement;

  const CAMERA_PRESETS: Record<string, THREE.Vector3> = {
    iso: new THREE.Vector3(14, 14, 14),
    top: new THREE.Vector3(0, 20, 0.01), // slight z offset avoids OrbitControls' straight-up gimbal lock
    front: new THREE.Vector3(0, 3, 20),
  };

  let setPreset: (name: keyof typeof CAMERA_PRESETS) => void = () => {};

  onMount(() => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1d22);

    const camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.1, 500);
    camera.position.copy(CAMERA_PRESETS.iso);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;

    setPreset = (name) => {
      camera.position.copy(CAMERA_PRESETS[name]);
      controls.target.set(0, 0, 0);
      controls.update();
    };

    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(10, 20, 10);
    scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ color: 0x2e3b2e })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // Arrange the whole palette in a grid, purely to sanity-check the art
    // strategy (procedural shapes + flat material colors) end to end.
    // NOT real placement UX yet — that's separate, substantial work.
    const cols = Math.ceil(Math.sqrt(piecesData.pieces.length));
    const spacing = 4;
    for (const [i, piece] of piecesData.pieces.entries()) {
      const geometry = geometryForPiece(piece.shape as PieceShape, piece.bounds);
      const material = new THREE.MeshStandardMaterial({ color: colorForFamily(piece.materialFamily) });
      const mesh = new THREE.Mesh(geometry, material);
      const col = i % cols;
      const row = Math.floor(i / cols);
      mesh.position.set((col - cols / 2) * spacing, piece.bounds.y / 2, (row - cols / 2) * spacing);
      scene.add(mesh);
    }

    let frameId: number;
    function animate() {
      frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    function handleResize() {
      camera.aspect = canvas.clientWidth / canvas.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    }
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  });
</script>

<div class="viewport">
  <div class="camera-presets">
    <button onclick={() => setPreset('iso')}>Iso</button>
    <button onclick={() => setPreset('top')}>Top</button>
    <button onclick={() => setPreset('front')}>Front</button>
  </div>
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .viewport {
    position: relative;
    width: 100%;
    height: 100%;
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
  .camera-presets {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    display: flex;
    gap: 0.25rem;
    z-index: 1;
  }
  .camera-presets button {
    padding: 0.25rem 0.6rem;
    font-size: 0.8rem;
    cursor: pointer;
  }
</style>

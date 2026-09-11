<script lang="ts">
  import { onMount } from 'svelte';
  import * as THREE from 'three';
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
  import { geometryForPiece, type PieceShape } from './scene/geometry';
  import { colorForFamily } from './scene/materials';
  import { getPieceData, snapPosition, type PieceEntry } from './scene/snapping';
  import type { PlacedPiece } from './types';

  let { selectedPrefab = $bindable(null), placedPieces = $bindable([]) }: {
    selectedPrefab: string | null;
    placedPieces: PlacedPiece[];
  } = $props();

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
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshStandardMaterial({ color: 0x2e3b2e })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    function buildMesh(piece: PieceEntry, color: number, opacity = 1): THREE.Mesh {
      const geometry = geometryForPiece(piece.shape as PieceShape, piece.bounds);
      const material = new THREE.MeshStandardMaterial({
        color,
        transparent: opacity < 1,
        opacity,
      });
      return new THREE.Mesh(geometry, material);
    }

    // A piece's geometry is centered on its own local origin, but its true
    // center sits at `piece.center` relative to the piece's root (pos/rot)
    // — offset the mesh by that (rotated) center so it lands where the
    // extractor actually measured the mesh, not at the root itself.
    function positionMesh(mesh: THREE.Mesh, piece: PieceEntry, pos: THREE.Vector3, rot: THREE.Quaternion) {
      const center = new THREE.Vector3(piece.center.x, piece.center.y, piece.center.z).applyQuaternion(rot);
      mesh.position.copy(pos).add(center);
      mesh.quaternion.copy(rot);
    }

    // --- Placed pieces ---
    const placedGroup = new THREE.Group();
    scene.add(placedGroup);
    let hoveredPlacedId: string | null = null;

    function rebuildPlacedPieces() {
      placedGroup.clear();
      for (const placed of placedPieces) {
        const piece = getPieceData(placed.prefab);
        if (!piece) continue;
        const color = placed.id === hoveredPlacedId ? 0xff5555 : colorForFamily(piece.materialFamily);
        const mesh = buildMesh(piece, color);
        const pos = new THREE.Vector3(placed.pos.x, placed.pos.y, placed.pos.z);
        const rot = new THREE.Quaternion(placed.rot.x, placed.rot.y, placed.rot.z, placed.rot.w);
        positionMesh(mesh, piece, pos, rot);
        mesh.userData.placedId = placed.id;
        placedGroup.add(mesh);
      }
    }

    // --- Ghost preview ---
    let ghostMesh: THREE.Mesh | null = null;
    let ghostRotationY = 0;
    let pendingPos: THREE.Vector3 | null = null;
    let pendingRot: THREE.Quaternion | null = null;

    function rebuildGhost() {
      if (ghostMesh) {
        scene.remove(ghostMesh);
        ghostMesh = null;
      }
      pendingPos = null;
      pendingRot = null;
      if (!selectedPrefab) return;
      const piece = getPieceData(selectedPrefab);
      if (!piece) return;
      ghostMesh = buildMesh(piece, colorForFamily(piece.materialFamily), 0.5);
      scene.add(ghostMesh);
    }

    // --- Raycasting / pointer handling ---
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();

    function updatePointerNdc(event: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function raycastGround(): THREE.Vector3 | null {
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObject(ground);
      return hits.length > 0 ? hits[0].point.clone() : null;
    }

    function raycastPlaced(): THREE.Object3D | null {
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(placedGroup.children, false);
      return hits.length > 0 ? hits[0].object : null;
    }

    function handlePointerMove(event: PointerEvent) {
      updatePointerNdc(event);

      if (!selectedPrefab) {
        // Nothing to place: hovering a placed piece highlights it as the
        // thing a click would remove.
        const hit = raycastPlaced();
        const id = (hit?.userData.placedId as string | undefined) ?? null;
        if (id !== hoveredPlacedId) {
          hoveredPlacedId = id;
          rebuildPlacedPieces();
        }
        return;
      }

      if (!ghostMesh) return;
      const groundHit = raycastGround();
      if (!groundHit) return;

      const piece = getPieceData(selectedPrefab)!;
      const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ghostRotationY);
      // Rest the piece's true mesh bottom on the ground. A pure-yaw
      // rotation leaves Y unchanged, so center.y is still a valid vertical
      // offset post-rotation.
      const tentativePos = groundHit.clone();
      tentativePos.y = piece.bounds.y / 2 - piece.center.y;

      const snapped = snapPosition(selectedPrefab, tentativePos, rot, placedPieces);

      pendingPos = snapped;
      pendingRot = rot;
      positionMesh(ghostMesh, piece, snapped, rot);
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.button !== 0) return; // left click only
      updatePointerNdc(event);

      if (selectedPrefab) {
        if (!pendingPos || !pendingRot) return;
        const newPiece: PlacedPiece = {
          id: crypto.randomUUID(),
          prefab: selectedPrefab,
          pos: { x: pendingPos.x, y: pendingPos.y, z: pendingPos.z },
          rot: { x: pendingRot.x, y: pendingRot.y, z: pendingRot.z, w: pendingRot.w },
        };
        placedPieces = [...placedPieces, newPiece];
        return;
      }

      const hit = raycastPlaced();
      const id = hit?.userData.placedId as string | undefined;
      if (id) {
        placedPieces = placedPieces.filter((p) => p.id !== id);
        hoveredPlacedId = null;
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (!selectedPrefab) return;
      if (event.key.toLowerCase() === 'r') {
        ghostRotationY += Math.PI / 4;
      } else if (event.key === 'Escape') {
        selectedPrefab = null;
      }
    }

    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    // Bridge external prop changes (palette selection, undo/redo later)
    // into this imperative Three.js scene.
    $effect(() => {
      selectedPrefab; // register dependency
      ghostRotationY = 0;
      rebuildGhost();
    });
    $effect(() => {
      placedPieces; // register dependency
      rebuildPlacedPieces();
    });

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
      window.removeEventListener('keydown', handleKeyDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerdown', handlePointerDown);
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
  <div class="hint">
    {#if selectedPrefab}
      Click to place · R to rotate · Esc to cancel
    {:else}
      Select a piece to place it, or click a placed piece to remove it
    {/if}
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
  .hint {
    position: absolute;
    top: 0.5rem;
    left: 0.5rem;
    z-index: 1;
    font-size: 0.78rem;
    color: #cfcfcf;
    background: rgba(20, 22, 26, 0.7);
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
  }
</style>

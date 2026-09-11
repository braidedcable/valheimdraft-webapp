<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import * as THREE from 'three';
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
  import { geometryForPiece, DOUBLE_SIDED_SHAPES, type PieceShape } from './scene/geometry';
  import { colorForFamily } from './scene/materials';
  import { getPieceData, snapPosition, type PieceEntry } from './scene/snapping';
  import type { PlacedPiece } from './types';

  let { selectedPrefab = $bindable(null), placedPieces = $bindable([]) }: {
    selectedPrefab: string | null;
    placedPieces: PlacedPiece[];
  } = $props();

  let canvas: HTMLCanvasElement;
  // Exposed for the hint text below; mutated from inside onMount's
  // closures like any other captured variable, but declared with $state so
  // the template reacts to it too.
  let movingPieceId = $state<string | null>(null);

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
      const shape = piece.shape as PieceShape;
      const geometry = geometryForPiece(shape, piece.bounds);
      const material = new THREE.MeshStandardMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        side: DOUBLE_SIDED_SHAPES.has(shape) ? THREE.DoubleSide : THREE.FrontSide,
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

    function currentMovingPiece(): PlacedPiece | null {
      return movingPieceId ? (placedPieces.find((p) => p.id === movingPieceId) ?? null) : null;
    }

    // What the ghost currently represents: a new piece from the palette,
    // or an existing placed piece picked up to be relocated. The two are
    // mutually exclusive — selecting a palette piece cancels an
    // in-progress move (see the selectedPrefab $effect below).
    function activePrefab(): string | null {
      return selectedPrefab ?? currentMovingPiece()?.prefab ?? null;
    }

    // --- Placed pieces ---
    const placedGroup = new THREE.Group();
    scene.add(placedGroup);
    let hoveredPlacedId: string | null = null;

    function rebuildPlacedPieces() {
      placedGroup.clear();
      for (const placed of placedPieces) {
        if (placed.id === movingPieceId) continue; // shown as the ghost instead
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
      const prefab = activePrefab();
      if (!prefab) return;
      const piece = getPieceData(prefab);
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

      const prefab = activePrefab();

      if (!prefab) {
        // Idle: hovering a placed piece previews it as "click to pick up".
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

      const piece = getPieceData(prefab)!;
      const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ghostRotationY);
      // Rest the piece's true mesh bottom on the ground. A pure-yaw
      // rotation leaves Y unchanged, so center.y is still a valid vertical
      // offset post-rotation.
      const tentativePos = groundHit.clone();
      tentativePos.y = piece.bounds.y / 2 - piece.center.y;

      // Exclude the piece currently being moved from its own snap targets
      // — otherwise it'd snap to its own pre-move position.
      const snapTargets = movingPieceId ? placedPieces.filter((p) => p.id !== movingPieceId) : placedPieces;
      const snapped = snapPosition(prefab, tentativePos, rot, snapTargets);

      pendingPos = snapped;
      pendingRot = rot;
      positionMesh(ghostMesh, piece, snapped, rot);
    }

    function commitPending() {
      if (!pendingPos || !pendingRot) return;
      const prefab = activePrefab();
      if (!prefab) return;
      const pos = { x: pendingPos.x, y: pendingPos.y, z: pendingPos.z };
      const rot = { x: pendingRot.x, y: pendingRot.y, z: pendingRot.z, w: pendingRot.w };

      if (movingPieceId) {
        const id = movingPieceId;
        placedPieces = placedPieces.map((p) => (p.id === id ? { ...p, pos, rot } : p));
        movingPieceId = null;
      } else if (selectedPrefab) {
        placedPieces = [...placedPieces, { id: crypto.randomUUID(), prefab: selectedPrefab, pos, rot }];
      }
    }

    function deleteAt(): boolean {
      const hit = raycastPlaced();
      const id = hit?.userData.placedId as string | undefined;
      if (!id) return false;
      placedPieces = placedPieces.filter((p) => p.id !== id);
      if (movingPieceId === id) movingPieceId = null;
      if (hoveredPlacedId === id) hoveredPlacedId = null;
      return true;
    }

    function cancelActive() {
      if (selectedPrefab) selectedPrefab = null;
      if (movingPieceId) {
        movingPieceId = null;
        rebuildPlacedPieces(); // the piece being moved reappears
      }
    }

    function handlePointerDown(event: PointerEvent) {
      updatePointerNdc(event);

      if (event.button === 1) {
        // Middle click: delete whatever's under the cursor, regardless of
        // any in-progress placement/move.
        event.preventDefault();
        deleteAt();
        return;
      }

      if (event.button === 2) {
        // Right click: cancel the current placement/move (instead of Esc).
        cancelActive();
        return;
      }

      if (event.button !== 0) return;

      if (activePrefab()) {
        commitPending();
        return;
      }

      // Nothing active: click a placed piece to pick it up for moving.
      const hit = raycastPlaced();
      const id = hit?.userData.placedId as string | undefined;
      if (id) {
        const placed = placedPieces.find((p) => p.id === id);
        if (placed) {
          const q = new THREE.Quaternion(placed.rot.x, placed.rot.y, placed.rot.z, placed.rot.w);
          // Preserve the piece's current facing instead of resetting to 0
          // — these are always pure-yaw rotations (only R ever produces
          // one), so extracting the Y euler angle round-trips cleanly.
          ghostRotationY = new THREE.Euler().setFromQuaternion(q, 'YXZ').y;

          hoveredPlacedId = null;
          movingPieceId = id;
          rebuildGhost();
          rebuildPlacedPieces();

          // rebuildGhost() creates the mesh but leaves it at the origin
          // until the next pointermove repositions it — without this, the
          // piece vanishes (hidden from the placed group above) with no
          // visible ghost in its place until the mouse moves, which reads
          // as a delete. Seed the ghost at the piece's own current
          // position/rotation immediately instead.
          if (ghostMesh) {
            const pieceData = getPieceData(placed.prefab)!;
            const pos = new THREE.Vector3(placed.pos.x, placed.pos.y, placed.pos.z);
            positionMesh(ghostMesh, pieceData, pos, q);
            pendingPos = pos;
            pendingRot = q;
          }
        }
      }
    }

    // --- WASD camera panning — active regardless of selection/move state ---
    const panKeys = new Set<string>();
    const PAN_SPEED = 10; // world units per second

    function handleKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
        panKeys.add(key);
        return;
      }
      if (key === 'r' && activePrefab()) {
        ghostRotationY += Math.PI / 4;
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      panKeys.delete(event.key.toLowerCase());
    }

    function handleContextMenu(event: MouseEvent) {
      event.preventDefault(); // right click is "cancel", not the browser menu
    }

    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Bridge external prop changes (palette selection, undo/redo later)
    // into this imperative Three.js scene. Selecting a palette piece
    // cancels an in-progress move.
    $effect(() => {
      selectedPrefab; // register dependency — movingPieceId read via
      // untrack() below so this effect doesn't ALSO re-fire whenever
      // movingPieceId changes elsewhere (e.g. right after pickup, which
      // was clobbering the just-seeded ghost rotation back to 0).
      if (selectedPrefab && untrack(() => movingPieceId)) movingPieceId = null;
      ghostRotationY = 0;
      rebuildGhost();
      rebuildPlacedPieces();
    });
    $effect(() => {
      placedPieces; // register dependency
      rebuildPlacedPieces();
    });

    const clock = new THREE.Clock();
    let frameId: number;
    function animate() {
      frameId = requestAnimationFrame(animate);
      const dt = clock.getDelta();

      if (panKeys.size > 0) {
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();

        const pan = new THREE.Vector3();
        if (panKeys.has('w')) pan.add(forward);
        if (panKeys.has('s')) pan.sub(forward);
        if (panKeys.has('d')) pan.add(right);
        if (panKeys.has('a')) pan.sub(right);
        if (pan.lengthSq() > 0) {
          pan.normalize().multiplyScalar(PAN_SPEED * dt);
          camera.position.add(pan);
          controls.target.add(pan);
        }
      }

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
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('contextmenu', handleContextMenu);
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
    {#if movingPieceId}
      Click to drop · R to rotate · Right-click to cancel · WASD to pan
    {:else if selectedPrefab}
      Click to place · R to rotate · Right-click to cancel · WASD to pan
    {:else}
      Click a piece to move it · middle-click to delete · WASD to pan
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

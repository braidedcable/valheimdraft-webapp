<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import * as THREE from 'three';
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
  import { geometryForPiece, DOUBLE_SIDED_SHAPES } from './scene/geometry';
  import { colorForFamily } from './scene/materials';
  import { getPieceData, snapPositionAlongRay, type PieceEntry } from './scene/snapping';
  import type { PlacedPiece } from './types';

  let { selectedPrefab = $bindable(null), placedPieces = $bindable([]), onUndo, onRedo }: {
    selectedPrefab: string | null;
    placedPieces: PlacedPiece[];
    onUndo: () => void;
    onRedo: () => void;
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
      const geometry = geometryForPiece(piece);
      const material = new THREE.MeshStandardMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        side: DOUBLE_SIDED_SHAPES.has(piece.shape) ? THREE.DoubleSide : THREE.FrontSide,
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
        const color = placed.id === hoveredPlacedId ? 0xff5555 : colorForFamily(piece.family);
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
      ghostMesh = buildMesh(piece, colorForFamily(piece.family), 0.5);
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

    // rebuildPlacedPieces() creates fresh Mesh instances and adds them to
    // placedGroup, but a newly-added Object3D's matrixWorld isn't
    // recomputed until the next render pass (normally done inside
    // renderer.render() during the animate() loop). Raycasting reads
    // matrixWorld directly, so a raycast that happens synchronously right
    // after a rebuild — e.g. a pointerup fired immediately after a
    // rebuild-triggering state change, with no animation frame in
    // between — can silently miss a piece that's actually right there.
    // Confirmed by direct reproduction: deselecting (which rebuilds
    // placedGroup) immediately followed by a pickup click on the very
    // piece just rendered failed to register a hit until this was added.
    // Forcing it here is cheap at wood-tier piece counts and correct
    // regardless of render-loop timing.
    function ensureFreshMatrices() {
      placedGroup.updateMatrixWorld(true);
    }

    // Ground + already-placed pieces, sorted by distance from the camera —
    // used to find where the ghost should rest. Combining the two (rather
    // than ground alone) lets the ghost land on top of a placed piece, not
    // just on the ground plane, which is what makes stacking possible.
    //
    // Also reports which placed piece (if any) is the nearest hit — i.e.
    // whichever piece is actually visible "under the cursor" from the
    // camera's current perspective, the same depth-sorted hits[0] every
    // other pointer interaction in this file already relies on (see
    // raycastPlaced() below). snapPositionAlongRay() uses this to prefer
    // connecting to that piece over a scene-wide ray-distance search, which
    // otherwise can't tell an occluded piece from the one actually under
    // the cursor (see snapping.ts for the full writeup).
    function raycastGroundAndPlaced(): { point: THREE.Vector3; hitPlacedId: string | null } | null {
      ensureFreshMatrices();
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects([ground, ...placedGroup.children], false);
      if (hits.length === 0) return null;
      const hitPlacedId = (hits[0].object.userData.placedId as string | undefined) ?? null;
      return { point: hits[0].point.clone(), hitPlacedId };
    }

    function raycastPlaced(): THREE.Object3D | null {
      ensureFreshMatrices();
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(placedGroup.children, false);
      return hits.length > 0 ? hits[0].object : null;
    }

    // Repositions/reorients the ghost mesh from the current activePrefab(),
    // ghostRotationY and pointerNdc — used both by pointer movement and by
    // anything that changes ghostRotationY without a fresh pointer event
    // (R key, scroll-wheel rotation), so the ghost visibly updates right
    // away instead of waiting for the next mousemove.
    function updateGhostPosition() {
      const prefab = activePrefab();
      if (!prefab || !ghostMesh) return;
      const surfaceHit = raycastGroundAndPlaced();
      if (!surfaceHit) return;

      const piece = getPieceData(prefab)!;
      const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ghostRotationY);
      // Rest the piece's true mesh bottom on whichever surface the cursor
      // is actually over — the ground (hitPoint.y ~= 0, same as before) or
      // a placed piece's mesh (hitPoint.y = that surface's real height).
      // Either way this only needs to land within SNAP_RADIUS of the real
      // snap point for snapPositionAlongRay() below to lock onto it exactly
      // (or, failing that, for the ray-based fallback inside it to find the
      // real snap point the cursor is actually aiming near). A pure-yaw
      // rotation leaves Y unchanged, so center.y is still a valid vertical
      // offset post-rotation.
      const tentativePos = surfaceHit.point.clone();
      tentativePos.y = surfaceHit.point.y + piece.bounds.y / 2 - piece.center.y;

      // Exclude the piece currently being moved from its own snap targets
      // — otherwise it'd snap to its own pre-move position.
      const snapTargets = movingPieceId ? placedPieces.filter((p) => p.id !== movingPieceId) : placedPieces;
      // raycaster.ray reflects the setFromCamera() call inside
      // raycastGroundAndPlaced() above — still valid here since nothing
      // between there and here re-runs setFromCamera with different args.
      const snapped = snapPositionAlongRay(
        prefab,
        tentativePos,
        rot,
        snapTargets,
        raycaster.ray,
        surfaceHit.hitPlacedId
      );

      pendingPos = snapped;
      pendingRot = rot;
      positionMesh(ghostMesh, piece, snapped, rot);
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

      updateGhostPosition();
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

    // OrbitControls binds left-drag to rotate, middle-drag to dolly, and
    // right-drag to pan — all three of this app's own actions (place/
    // pickup, delete, cancel) sit on the same buttons. Firing on
    // pointerdown meant just STARTING an orbit drag fired the action too
    // (e.g. every camera reposition mid-placement dropped a spurious
    // piece). Fixed by deferring to pointerup, and only firing if the
    // pointer didn't move more than a few pixels since the matching
    // pointerdown — a real click, not a drag.
    const CLICK_DRAG_THRESHOLD = 5; // pixels
    let downAt: { x: number; y: number; button: number } | null = null;

    function handlePointerDown(event: PointerEvent) {
      downAt = { x: event.clientX, y: event.clientY, button: event.button };
      if (event.button === 1) event.preventDefault(); // suppress middle-click autoscroll
    }

    function handlePointerUp(event: PointerEvent) {
      if (!downAt || downAt.button !== event.button) {
        downAt = null;
        return;
      }
      const moved = Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y) > CLICK_DRAG_THRESHOLD;
      downAt = null;
      if (moved) return; // was a camera drag, not a click

      updatePointerNdc(event);

      if (event.button === 1) {
        // Middle click: delete whatever's under the cursor, regardless of
        // any in-progress placement/move.
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

    // An undo/redo firing while a piece is picked up for moving (ghost
    // following the cursor, not yet dropped) would otherwise leave a stray
    // ghost referencing a piece whose position/existence the history
    // navigation just changed underneath it. Rather than trying to make
    // that combination coherent, we just cancel the in-progress move first
    // — undoing/redoing the committed history, plus a dangling pick-up, is
    // more confusing than requiring the user to re-pick-up the piece.
    function cancelMoveForHistoryNav() {
      if (movingPieceId) {
        movingPieceId = null;
        rebuildPlacedPieces(); // the piece being moved reappears
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
        panKeys.add(key);
        return;
      }
      if (key === 'r' && activePrefab()) {
        ghostRotationY += Math.PI / 4;
        updateGhostPosition();
        return;
      }
      const isCtrlOrCmd = event.ctrlKey || event.metaKey;
      if (isCtrlOrCmd && key === 'z') {
        event.preventDefault();
        cancelMoveForHistoryNav();
        if (event.shiftKey) onRedo();
        else onUndo();
        return;
      }
      if (isCtrlOrCmd && key === 'y') {
        event.preventDefault();
        cancelMoveForHistoryNav();
        onRedo();
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      panKeys.delete(event.key.toLowerCase());
    }

    function handleContextMenu(event: MouseEvent) {
      event.preventDefault(); // right click is "cancel", not the browser menu
    }

    // OrbitControls registers its own 'wheel' listener on this same canvas
    // in its constructor (before this code runs), and calling
    // preventDefault() inside a second bubble-phase listener would NOT stop
    // that listener from also firing — both rotation and zoom would happen
    // together. Registering in the capture phase instead runs this handler
    // before OrbitControls' bubble-phase one, so stopImmediatePropagation()
    // here reliably suppresses it. When no piece is active we return
    // without doing anything, letting OrbitControls' own listener handle
    // the zoom exactly as before.
    function handleWheel(event: WheelEvent) {
      const prefab = activePrefab();
      if (!prefab) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const direction = event.deltaY > 0 ? 1 : -1;
      ghostRotationY += direction * (Math.PI / 4);
      updateGhostPosition();
    }

    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('contextmenu', handleContextMenu);
    canvas.addEventListener('wheel', handleWheel, { capture: true, passive: false });
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
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('contextmenu', handleContextMenu);
      canvas.removeEventListener('wheel', handleWheel, { capture: true });
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
      Click to drop · R or scroll to rotate · Right-click to cancel · WASD to pan
    {:else if selectedPrefab}
      Click to place · R or scroll to rotate · Right-click to cancel · WASD to pan
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

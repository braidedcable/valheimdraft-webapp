<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import * as THREE from 'three';
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
  import { geometryForPiece, DOUBLE_SIDED_SHAPES } from './scene/geometry';
  import { colorForFamily, contrastingOutlineColor } from './scene/materials';
  import { getPieceData, snapPositionAlongRay, type PieceEntry } from './scene/snapping';
  import { heightWeightedDepth, isInEdgeBand, xraySliceCutoff, zoomSliceFraction } from './scene/xray';
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
  // A functional boundary indicator, not decoration — pieces are flat
  // material colors with no per-piece shading cue, so two adjacent same-
  // family pieces can otherwise read as one blob. Defaults on; toggleable
  // since it's not everyone's preference once the shape is already clear.
  let showOutlines = $state(true);
  // "X-ray": fades out whatever placed piece sits between the camera and
  // another placed piece further back, so building inside an enclosed shell
  // (walls/roof already up) doesn't require deleting or hiding them first.
  // Off by default — unlike outlines this actively changes what's visible,
  // not just a boundary-clarity aid.
  let showXray = $state(false);

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
    // Capped at 2x — an uncapped devicePixelRatio (3x on many phones/some
    // laptops) roughly doubles or triples the number of fragments the GPU
    // has to shade every frame for no visible benefit past ~2x, and that
    // cost scales with scene complexity (more placed pieces = more
    // overdraw), compounding exactly where frame time is already tight.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;
    // Slower than the default (1) so each scroll notch moves the camera a
    // smaller distance — with x-ray on, that's what keeps the depth cutoff
    // sweeping past individually-spaced pieces one at a time instead of
    // jumping past several closely-spaced ones (e.g. a wall's worth of
    // adjacent segments) in a single notch and flipping them all at once.
    controls.zoomSpeed = 0.5;
    // Hover-preview raycasting (see handlePointerMove) is pointless while
    // the user is mid-drag orbiting the camera — nothing is being placed,
    // so skip it entirely for the duration of the drag rather than paying
    // for a scene-wide raycast on every one of the dozens of pointermove
    // events an orbit drag fires.
    let isOrbiting = false;
    controls.addEventListener('start', () => {
      isOrbiting = true;
    });
    controls.addEventListener('end', () => {
      isOrbiting = false;
    });

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

    // Building a piece's geometry (and, worse, its EdgesGeometry — an edge
    // scan over every triangle) is one of the costlier things this file
    // does, and a piece's geometry is fully determined by its prefab, never
    // by where/how many times it's placed. Previously every rebuild
    // recomputed it (and a fresh material) from scratch for every placed
    // instance, every time — fine at a handful of pieces, a real stutter
    // once dozens/hundreds accumulate. Cached per prefab and reused across
    // every instance instead; disposed on unmount below.
    const pieceAssetCache = new Map<string, { geometry: THREE.BufferGeometry; edges: THREE.BufferGeometry }>();
    function getPieceAssets(piece: PieceEntry): { geometry: THREE.BufferGeometry; edges: THREE.BufferGeometry } {
      let assets = pieceAssetCache.get(piece.prefab);
      if (!assets) {
        const geometry = geometryForPiece(piece);
        assets = { geometry, edges: new THREE.EdgesGeometry(geometry) };
        pieceAssetCache.set(piece.prefab, assets);
      }
      return assets;
    }

    // Materials are cheap individually but were being reallocated on every
    // rebuild too (one MeshStandardMaterial + one LineBasicMaterial per
    // placed piece, every time ANY piece changed) — pooled by their visual
    // key instead so e.g. every non-hovered oak piece shares one material.
    const fillMaterialCache = new Map<string, THREE.MeshStandardMaterial>();
    function getFillMaterial(color: number, opacity: number, doubleSided: boolean): THREE.MeshStandardMaterial {
      const key = `${color}:${opacity}:${doubleSided}`;
      let material = fillMaterialCache.get(key);
      if (!material) {
        material = new THREE.MeshStandardMaterial({
          color,
          transparent: opacity < 1,
          opacity,
          side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
        });
        fillMaterialCache.set(key, material);
      }
      return material;
    }
    const outlineMaterialCache = new Map<string, THREE.LineBasicMaterial>();
    function getOutlineMaterial(color: number, opacity: number): THREE.LineBasicMaterial {
      const key = `${color}:${opacity}`;
      let material = outlineMaterialCache.get(key);
      if (!material) {
        material = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
        outlineMaterialCache.set(key, material);
      }
      return material;
    }

    function buildMesh(piece: PieceEntry, color: number, opacity = 1): THREE.Mesh {
      const { geometry, edges } = getPieceAssets(piece);
      const material = getFillMaterial(color, opacity, DOUBLE_SIDED_SHAPES.has(piece.shape));
      const mesh = new THREE.Mesh(geometry, material);

      // EdgesGeometry collapses coplanar triangle edges, leaving just the
      // piece's real silhouette/crease lines — a wireframe of every
      // triangle would be noise, not a boundary indicator. Added as a
      // child so it inherits the mesh's position/rotation for free. Always
      // built (geometry is cached/shared, so this is nearly free) and just
      // toggled via `visible` so flipping showOutlines never has to touch
      // geometry — see the showOutlines $effect below.
      const outline = new THREE.LineSegments(edges, getOutlineMaterial(contrastingOutlineColor(color), opacity));
      outline.visible = showOutlines;
      mesh.add(outline);

      return mesh;
    }

    // outlineOpacity defaults to fillOpacity (the common case: hover-color
    // changes, initial build) but xray needs them to diverge — a piece
    // that's faded to near-invisible fill should still read as a visible
    // outline, per the "still support outlines" requirement.
    function setMeshAppearance(mesh: THREE.Mesh, piece: PieceEntry, color: number, fillOpacity = 1, outlineOpacity = fillOpacity) {
      mesh.material = getFillMaterial(color, fillOpacity, DOUBLE_SIDED_SHAPES.has(piece.shape));
      const outline = mesh.children[0] as THREE.LineSegments | undefined;
      if (outline) outline.material = getOutlineMaterial(contrastingOutlineColor(color), outlineOpacity);
    }

    // Wraps setMeshAppearance with userData bookkeeping so hover-driven color
    // changes and xray-driven opacity changes never clobber each other —
    // each reads the other's last-applied value off the mesh instead of
    // assuming full opacity/un-hovered color.
    function applyMeshAppearance(mesh: THREE.Mesh, piece: PieceEntry, color: number, fillOpacity: number, outlineOpacity = fillOpacity) {
      setMeshAppearance(mesh, piece, color, fillOpacity, outlineOpacity);
      mesh.userData.color = color;
      mesh.userData.opacity = fillOpacity;
      mesh.userData.outlineOpacity = outlineOpacity;
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

    function colorForPlaced(id: string, family: string): number {
      return id === hoveredPlacedId ? 0xff5555 : colorForFamily(family);
    }

    // Diffs placedPieces against the live meshes instead of the old
    // clear-and-rebuild-everything: add/update/remove only what actually
    // changed. This is what rebuildPlacedPieces() used to do on every
    // placement, move, undo/redo, AND every hover change — the last one
    // fires continuously while the mouse moves over the scene (including
    // mid camera-orbit-drag), so a full rebuild there meant reallocating
    // every placed piece's geometry/material on essentially every frame
    // once a moderate number of pieces existed. Geometry/material are
    // cached per prefab/color (see buildMesh above), so add/update here is
    // cheap even when it does run for every piece.
    const meshByPlacedId = new Map<string, THREE.Mesh>();

    function syncPlacedPieces() {
      const seen = new Set<string>();
      for (const placed of placedPieces) {
        if (placed.id === movingPieceId) continue; // shown as the ghost instead
        const piece = getPieceData(placed.prefab);
        if (!piece) continue;
        seen.add(placed.id);

        const color = colorForPlaced(placed.id, piece.family);
        let mesh = meshByPlacedId.get(placed.id);
        if (!mesh) {
          mesh = buildMesh(piece, color);
          mesh.userData.placedId = placed.id;
          mesh.userData.piece = piece;
          mesh.userData.color = color;
          mesh.userData.opacity = 1;
          mesh.userData.outlineOpacity = 1;
          meshByPlacedId.set(placed.id, mesh);
          placedGroup.add(mesh);
        } else if (mesh.userData.color !== color) {
          applyMeshAppearance(mesh, piece, color, mesh.userData.opacity ?? 1, mesh.userData.outlineOpacity ?? 1);
        }

        const pos = new THREE.Vector3(placed.pos.x, placed.pos.y, placed.pos.z);
        const rot = new THREE.Quaternion(placed.rot.x, placed.rot.y, placed.rot.z, placed.rot.w);
        positionMesh(mesh, piece, pos, rot);
      }

      for (const [id, mesh] of meshByPlacedId) {
        if (seen.has(id)) continue;
        placedGroup.remove(mesh);
        meshByPlacedId.delete(id);
      }
    }

    // Fast path for a hover change alone (the common case while idly
    // moving the mouse over the scene): touches only the one or two meshes
    // whose color actually changed, instead of running the full sync pass.
    function applyHover(id: string | null) {
      if (!id) return;
      const mesh = meshByPlacedId.get(id);
      const placed = placedPieces.find((p) => p.id === id);
      if (!mesh || !placed) return;
      const piece = getPieceData(placed.prefab);
      if (!piece) return;
      const color = colorForPlaced(id, piece.family);
      if (mesh.userData.color === color) return;
      applyMeshAppearance(mesh, piece, color, mesh.userData.opacity ?? 1, mesh.userData.outlineOpacity ?? 1);
    }

    // --- X-ray (see-through) ---
    // Fill fades to near-nothing; outline stays much more visible, so a
    // faded piece's silhouette still reads while its face doesn't block the
    // view. Pure constants, not derived from anything.
    const XRAY_FILL_OPACITY = 0.08;
    const XRAY_OUTLINE_OPACITY = 0.35;

    // A spatial cutaway, not a per-piece occlusion test: project every
    // placed piece's position onto the camera's current view direction,
    // then fade everything nearer than a cutoff depth (see zoom mapping
    // above) while leaving everything farther fully opaque — literally
    // slicing the build between camera and back, independent of what any
    // individual piece is. This also means "front/back" reslices itself to
    // "floor/roof" for free when looking straight down (or any other axis)
    // — it's whatever the camera currently happens to be looking along, not
    // a fixed world axis.
    //
    // Piece-type classification (walls vs. beams vs. furniture) was tried
    // and dropped: name-matching had false positives (e.g. "Log Beam"
    // prefabs contain "wall") and a from-scratch geometry classifier was
    // more complexity than the payoff justified. Roofs/ceilings still fade
    // before same-story floors, and deeper zoom still reaches lower
    // stories — see heightWeightedDepth in xray.ts — but that comes from
    // biasing the one depth number by world height, not from knowing what
    // any given piece actually is.
    function updateXray() {
      if (!showXray) {
        for (const mesh of meshByPlacedId.values()) {
          if (mesh.userData.opacity === 1) continue;
          const piece = mesh.userData.piece as PieceEntry;
          applyMeshAppearance(mesh, piece, mesh.userData.color, 1);
        }
        return;
      }

      const meshes = [...meshByPlacedId.values()];
      if (meshes.length === 0) return;

      const camPos = camera.position;
      const viewDir = new THREE.Vector3();
      camera.getWorldDirection(viewDir); // normalized, camera -> into the scene
      // camera.matrixWorldInverse (needed below by Vector3.project) is only
      // refreshed by THREE during renderer.render() — this can run earlier
      // in the same frame (or from the immediate on-toggle $effect, outside
      // the render loop entirely), so force it current now rather than
      // projecting against a stale, previous-frame camera transform.
      camera.updateMatrixWorld();

      // mesh.position is already the piece's true mesh-bounds center in
      // world space (positionMesh offsets it by piece.center on placement),
      // and placedGroup itself carries no transform of its own — so this
      // needs no matrixWorld lookup, unlike raycasting elsewhere in this file.
      //
      // Two passes: the height bias (see heightWeightedDepth in xray.ts)
      // needs to know the build's lowest piece before it can bias anything,
      // so raw depth/height are collected first and the biased depth
      // computed once minY is known. rawDepthMin (unbiased) is also kept
      // separately — see the paragraph below for why it, not the biased
      // depthMin, is what drives zoomSliceFraction.
      let minY = Infinity;
      let rawDepthMin = Infinity;
      const rawDepthByMesh = new Map<THREE.Mesh, number>();
      for (const mesh of meshes) {
        const rawDepth = mesh.position.clone().sub(camPos).dot(viewDir);
        rawDepthByMesh.set(mesh, rawDepth);
        if (rawDepth < rawDepthMin) rawDepthMin = rawDepth;
        if (mesh.position.y < minY) minY = mesh.position.y;
      }

      let depthMin = Infinity;
      let depthMax = -Infinity;
      const depthByMesh = new Map<THREE.Mesh, number>();
      for (const mesh of meshes) {
        const depth = heightWeightedDepth(rawDepthByMesh.get(mesh)!, mesh.position.y - minY);
        depthByMesh.set(mesh, depth);
        if (depth < depthMin) depthMin = depth;
        if (depth > depthMax) depthMax = depth;
      }

      // How much of the depth range actually gets sliced is zoom-dependent
      // — see scene/xray.ts's module comment for why and its tests for the
      // tuning itself. Deliberately uses rawDepthMin (real, unbiased camera
      // proximity) here rather than the height-biased depthMin below: a
      // tall roof's height bias alone (at a FIXED, unchanged camera
      // distance) would otherwise drag the biased depthMin down, which
      // zoomSliceFraction would misread as "the camera zoomed in a lot" —
      // see its own doc comment for the feedback loop that caused, found by
      // direct simulation before this was wired up live.
      const sliceFraction = zoomSliceFraction(rawDepthMin);
      const cutoff = xraySliceCutoff(depthMin, depthMax, sliceFraction);

      for (const mesh of meshes) {
        const isFrontHalf = depthByMesh.get(mesh)! < cutoff;
        let desiredOpacity = 1;
        let desiredOutlineOpacity = 1;
        if (isFrontHalf) {
          // A faded piece only actually shows (at its normal faded look)
          // near the screen edges — dead center, where you're actually
          // looking, it's fully invisible instead, not just faded. Per
          // direct feedback: the ghost fill was still showing up in the
          // middle of the view even after the earlier tuning passes, which
          // is exactly where you don't want any x-ray clutter while you're
          // trying to build; the edges are enough to hint there's more.
          const ndc = mesh.position.clone().project(camera);
          const showGhost = isInEdgeBand(ndc.x, ndc.y);
          desiredOpacity = showGhost ? XRAY_FILL_OPACITY : 0;
          desiredOutlineOpacity = showGhost ? XRAY_OUTLINE_OPACITY : 0;
        }
        if (mesh.userData.opacity === desiredOpacity && mesh.userData.outlineOpacity === desiredOutlineOpacity) continue;
        const piece = mesh.userData.piece as PieceEntry;
        applyMeshAppearance(mesh, piece, mesh.userData.color, desiredOpacity, desiredOutlineOpacity);
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

    // syncPlacedPieces() creates fresh Mesh instances for newly-added
    // pieces and adds them to placedGroup, but a newly-added Object3D's
    // matrixWorld isn't recomputed until the next render pass (normally
    // done inside renderer.render() during the animate() loop). Raycasting
    // reads matrixWorld directly, so a raycast that happens synchronously
    // right after a sync — e.g. a pointerup fired immediately after a
    // sync-triggering state change, with no animation frame in between —
    // can silently miss a piece that's actually right there. Confirmed by
    // direct reproduction: deselecting (which syncs placedGroup)
    // immediately followed by a pickup click on the very piece just
    // rendered failed to register a hit until this was added. Forcing it
    // here is cheap and correct regardless of render-loop timing.
    function ensureFreshMatrices() {
      placedGroup.updateMatrixWorld(true);
    }

    // Faded-to-near-invisible x-ray pieces (see updateXray above) should
    // never be the thing the cursor lands on — without this, hovering/
    // clicking through them to reach the room you're actually looking into
    // instead picks up or snaps against the invisible near-half piece, or
    // places against it as if it were still the nearest solid surface.
    // Excluding them from the raycast set entirely (rather than e.g.
    // filtering hits after the fact) also lets a real hit further back win
    // outright, the same as if the faded piece weren't there at all.
    function raycastableMeshes(): THREE.Object3D[] {
      return placedGroup.children.filter((child) => (child.userData.opacity ?? 1) === 1);
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
      const hits = raycaster.intersectObjects([ground, ...raycastableMeshes()], false);
      if (hits.length === 0) return null;
      const hitPlacedId = (hits[0].object.userData.placedId as string | undefined) ?? null;
      return { point: hits[0].point.clone(), hitPlacedId };
    }

    function raycastPlaced(): THREE.Object3D | null {
      ensureFreshMatrices();
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(raycastableMeshes(), false);
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
      // — otherwise it'd snap to its own pre-move position. Also exclude
      // whatever's currently faded out by x-ray: snapPositionAlongRay works
      // off the placedPieces DATA array, not the raycast-visible meshes
      // above, so without this a faded (invisible) near piece could still
      // win the snap and place the new piece against it instead of against
      // whatever's actually visible in the room being built into.
      const snapTargets = placedPieces.filter((p) => {
        if (p.id === movingPieceId) return false;
        const mesh = meshByPlacedId.get(p.id);
        return (mesh?.userData.opacity ?? 1) === 1;
      });
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
        // Skipped entirely mid camera-orbit-drag — nothing can be picked up
        // while the camera itself is being dragged, so there's no reason to
        // pay for a scene-wide raycast on every one of the many pointermove
        // events an orbit drag fires.
        if (isOrbiting) return;
        const hit = raycastPlaced();
        const id = (hit?.userData.placedId as string | undefined) ?? null;
        if (id !== hoveredPlacedId) {
          const previous = hoveredPlacedId;
          hoveredPlacedId = id;
          applyHover(previous);
          applyHover(id);
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
        syncPlacedPieces(); // the piece being moved reappears
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
          syncPlacedPieces();

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
        syncPlacedPieces(); // the piece being moved reappears
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
    //
    // This effect re-fires on every placement, not just on an actual
    // palette selection change — `selectedPrefab` and `placedPieces` are
    // sibling $bindable props of the same component instance, and Svelte
    // re-runs an effect that reads a bindable prop whenever ANY bindable
    // prop on the instance is written back to the parent, regardless of
    // whether this prop's own value changed (confirmed directly: logging
    // inside this effect showed it firing again after a same-piece
    // placement with `selectedPrefab` unchanged). Resetting
    // `ghostRotationY` unconditionally therefore reset the ghost's
    // rotation after every single placement, not just on a genuine new
    // selection — `lastSelectedPrefab` tracks the previous value across
    // runs (plain closure variable, not reactive state) so the reset only
    // fires on a real change.
    let lastSelectedPrefab: string | null = null;
    $effect(() => {
      selectedPrefab; // register dependency — movingPieceId read via
      // untrack() below so this effect doesn't ALSO re-fire whenever
      // movingPieceId changes elsewhere (e.g. right after pickup, which
      // was clobbering the just-seeded ghost rotation back to 0).
      if (selectedPrefab && untrack(() => movingPieceId)) movingPieceId = null;
      if (selectedPrefab !== lastSelectedPrefab) {
        ghostRotationY = 0;
        lastSelectedPrefab = selectedPrefab;
      }
      rebuildGhost();
      syncPlacedPieces();
    });
    $effect(() => {
      placedPieces; // register dependency
      syncPlacedPieces();
      // untrack: showXray's own $effect above already handles toggling;
      // reading it tracked here would make placedPieces changes and
      // showXray toggles both re-run this whole effect redundantly.
      if (untrack(() => showXray)) updateXray();
    });
    $effect(() => {
      // Toggling outlines doesn't need to touch geometry or materials at
      // all — every mesh already carries its (shared) outline as its first
      // child (see buildMesh), so this just flips visibility on what's
      // already there instead of rebuilding the whole scene.
      showOutlines;
      for (const mesh of meshByPlacedId.values()) {
        const outline = mesh.children[0] as THREE.LineSegments | undefined;
        if (outline) outline.visible = showOutlines;
      }
      if (ghostMesh) {
        const outline = ghostMesh.children[0] as THREE.LineSegments | undefined;
        if (outline) outline.visible = showOutlines;
      }
    });
    $effect(() => {
      showXray; // register dependency — respond to the toggle immediately
      // rather than waiting for the next throttled tick in animate() below.
      updateXray();
    });

    const clock = new THREE.Clock();
    let frameId: number;
    // Recomputed on a throttle, not every frame — cheap (O(n) over placed
    // pieces) but pointless to redo 60x/sec when it only needs to track
    // camera movement, which itself only meaningfully changes a few times
    // per second from a human dragging/panning. This still runs from inside
    // animate() (rather than e.g. only on OrbitControls' 'change' event) so
    // it also tracks WASD panning, which moves the camera without going
    // through OrbitControls at all.
    const XRAY_INTERVAL = 0.15; // seconds
    let xrayAccum = 0;
    function animate() {
      frameId = requestAnimationFrame(animate);
      const dt = clock.getDelta();

      if (showXray) {
        xrayAccum += dt;
        if (xrayAccum >= XRAY_INTERVAL) {
          xrayAccum = 0;
          updateXray();
        }
      }

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

    // Dev-only inspection hook: browser-driven testing/verification (e.g.
    // Playwright) needs to read real internal scene state — which pieces
    // are currently x-ray-faded, the live camera/target — without
    // screenshotting and eyeballing it, or hand-patching a throwaway hook
    // into this file for one test run and remembering to remove it after.
    // Stripped from production builds (import.meta.env.DEV), so this never
    // ships or leaks scene internals to real users.
    if (import.meta.env.DEV) {
      (window as unknown as { __valheimdraft_debug__: unknown }).__valheimdraft_debug__ = {
        getPlacedState: () =>
          [...meshByPlacedId.entries()].map(([id, mesh]) => ({
            id,
            prefab: (mesh.userData.piece as PieceEntry).prefab,
            opacity: mesh.userData.opacity as number,
            outlineOpacity: mesh.userData.outlineOpacity as number,
            color: mesh.userData.color as number,
          })),
        getCamera: () => ({
          position: camera.position.toArray(),
          target: controls.target.toArray(),
        }),
      };
    }

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
      // The geometry/material caches above are shared across every mesh
      // for the lifetime of this scene, so nothing disposes them as
      // individual pieces come and go — only here, once, on teardown.
      for (const assets of pieceAssetCache.values()) {
        assets.geometry.dispose();
        assets.edges.dispose();
      }
      for (const material of fillMaterialCache.values()) material.dispose();
      for (const material of outlineMaterialCache.values()) material.dispose();
      renderer.dispose();
    };
  });
</script>

<div class="viewport">
  <div class="camera-presets">
    <button class:active={showOutlines} onclick={() => (showOutlines = !showOutlines)}>
      Outlines
    </button>
    <button class:active={showXray} onclick={() => (showXray = !showXray)}>
      X-Ray
    </button>
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
  .camera-presets button.active {
    background: #3a6ff0;
    color: white;
    border-color: #3a6ff0;
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

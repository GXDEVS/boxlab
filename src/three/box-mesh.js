import * as THREE from 'three';

// Renders the container with two visual variants depending on box.type:
//
//   'box' (Caixa): orange wireframe edges + translucent orange faces — rigid cardboard look.
//   'bag' (Bolsa): cyan dashed edges, softer face fill, top face removed — flexible plastic look.
//
// Caller offsets the parent group so origin = box's min corner.
export function makeBoxMesh(box) {
  return box.type === 'bag' ? makeBagMesh(box) : makeBoxRigid(box);
}

function makeBoxRigid(box) {
  const geo = new THREE.BoxGeometry(box.length, box.height, box.width);

  const faceMat = new THREE.MeshStandardMaterial({
    color: 0xff7a45,
    transparent: true,
    opacity: 0.06,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const faces = new THREE.Mesh(geo, faceMat);
  faces.position.set(box.length / 2, box.height / 2, box.width / 2);

  const edgesGeo = new THREE.EdgesGeometry(geo);
  const lineMat = new THREE.LineBasicMaterial({ color: 0xff7a45, transparent: true, opacity: 0.85 });
  const edges = new THREE.LineSegments(edgesGeo, lineMat);
  edges.position.copy(faces.position);

  const group = new THREE.Group();
  group.add(faces);
  group.add(edges);

  return {
    mesh: group,
    dispose() {
      geo.dispose();
      edgesGeo.dispose();
      faceMat.dispose();
      lineMat.dispose();
    },
  };
}

// Bag: 5 face panels (no top) + dashed cyan edges drawn from custom geometry
// so we can omit the top edges and convey "open at the top".
function makeBagMesh(box) {
  const L = box.length, W = box.width, H = box.height;

  // ── Side & bottom faces ────────────────────────────────────────
  // Build BufferGeometry with five quads (bottom, +x, -x, +y, -y).
  // Top is intentionally absent.
  const positions = [];
  const quad = (a, b, c, d) => {
    positions.push(...a, ...b, ...c, ...a, ...c, ...d);
  };
  // Vertices in box-local space (origin at corner so caller's group offset works).
  const v000 = [0, 0, 0], v100 = [L, 0, 0], v110 = [L, 0, W], v010 = [0, 0, W];
  const v001 = [0, H, 0], v101 = [L, H, 0], v111 = [L, H, W], v011 = [0, H, W];
  // Bottom (y=0)
  quad(v000, v100, v110, v010);
  // -x side (x=0)
  quad(v000, v010, v011, v001);
  // +x side (x=L)
  quad(v100, v101, v111, v110);
  // -z side (z=0)
  quad(v000, v001, v101, v100);
  // +z side (z=W)
  quad(v010, v110, v111, v011);

  const faceGeo = new THREE.BufferGeometry();
  faceGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  faceGeo.computeVertexNormals();

  const faceMat = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,        // cyan-400
    transparent: true,
    opacity: 0.10,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const faces = new THREE.Mesh(faceGeo, faceMat);

  // ── Edges (dashed cyan), top edges intentionally OMITTED ───────
  // Bottom rectangle (4 edges) + 4 vertical edges. No top rectangle.
  const edgePoints = [
    // bottom rectangle
    v000, v100,  v100, v110,  v110, v010,  v010, v000,
    // 4 vertical edges (going up to where the open top would be)
    v000, v001,  v100, v101,  v110, v111,  v010, v011,
  ].flat();

  const edgesGeo = new THREE.BufferGeometry();
  edgesGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgePoints, 3));

  const lineMat = new THREE.LineDashedMaterial({
    color: 0x22d3ee,
    dashSize: 0.7,
    gapSize: 0.35,
    transparent: true,
    opacity: 0.8,
  });
  const edges = new THREE.LineSegments(edgesGeo, lineMat);
  edges.computeLineDistances();

  const group = new THREE.Group();
  group.add(faces);
  group.add(edges);

  return {
    mesh: group,
    dispose() {
      faceGeo.dispose();
      faceMat.dispose();
      edgesGeo.dispose();
      lineMat.dispose();
    },
  };
}

import * as THREE from 'three';

// World axis convention: x=length, y=height, z=width.
// Box origin in our packing world is (0,0,0) at min corner.
// In Three.js, we render the box centered on origin and offset the parent group.
export function makeBoxMesh(box) {
  const geo = new THREE.BoxGeometry(box.length, box.height, box.width);
  const edges = new THREE.EdgesGeometry(geo);
  geo.dispose();
  const mat = new THREE.LineBasicMaterial({ color: 0xff7a45, transparent: true, opacity: 0.7 });
  const lines = new THREE.LineSegments(edges, mat);
  lines.position.set(box.length / 2, box.height / 2, box.width / 2);
  return {
    mesh: lines,
    dispose() { edges.dispose(); mat.dispose(); },
  };
}

import * as THREE from 'three';

// Renders the container box as: translucent faces + crisp wireframe edges.
// In Three.js: x=length, y=height, z=width. Caller offsets the parent group so origin = box's min corner.
export function makeBoxMesh(box) {
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

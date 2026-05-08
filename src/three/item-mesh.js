import * as THREE from 'three';

// position: { x, y, z, dims: [length, width, height] } from packing world
// In packing: x=length axis, y=width axis, z=height axis (because we add ep+length to x, etc.)
// Three.js: x=length, y=height, z=width
// So we map: three.x = pack.x + l/2; three.y = pack.z + h/2; three.z = pack.y + w/2
export function makeItemMesh(position, item) {
  const [l, w, h] = position.dims;
  const geo = new THREE.BoxGeometry(l, h, w);
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(item.color || '#3b82f6'),
    transparent: true,
    opacity: 0.85,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(position.x + l / 2, position.z + h / 2, position.y + w / 2);
  mesh.userData = { id: item.id, name: item.name, dims: [l, w, h] };

  const edges = new THREE.EdgesGeometry(geo);
  const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.5, transparent: true });
  const lines = new THREE.LineSegments(edges, lineMat);
  mesh.add(lines);

  return {
    mesh,
    dispose() {
      geo.dispose();
      mat.dispose();
      edges.dispose();
      lineMat.dispose();
    },
  };
}

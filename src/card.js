import * as THREE from 'three';
import { createCardBackTexture } from './textures.js';
import { createCardFaceTexture } from './cardFaces.js';

/**
 * Creates a single 3D playing card:
 * - Real poker dimensions (width: 0.072m, height: 0.102m)
 * - Rounded corners (radius: 0.006m)
 * - Slight physical thickness (0.0012m)
 * - Separate materials for front face, ornate red back, and paper edges
 * - Normalized UVs on caps
 */
export function createCard(options = {}) {
  const {
    suit = 'spades',
    rank = 'A',
    width = 0.086,
    height = 0.122,
    radius = 0.007,
    thickness = 0.0014
  } = options;

  // 1. 2D Rounded Rectangle Shape
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);

  // 2. Extrude Geometry with physical thickness
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 16
  });

  // Center along Z
  geometry.translate(0, 0, -thickness / 2);

  // 3. Separate Material Groups:
  // In ExtrudeGeometry, groups[0] contains the two caps, groups[1] contains the sides.
  const halfCap = geometry.groups[0].count / 2;
  const sidesCount = geometry.groups[1].count;

  // Material index 0: Top face (+Z, normal points UP when laid flat face-down) -> Ornate Red Back
  // Material index 1: Bottom face (-Z, normal points DOWN against table) -> Card Face (blank for now)
  // Material index 2: Side edges -> Off-white cardstock edge
  geometry.groups = [
    { start: halfCap, count: halfCap, materialIndex: 0 },
    { start: 0, count: halfCap, materialIndex: 1 },
    { start: halfCap * 2, count: sidesCount, materialIndex: 2 }
  ];

  // 4. Normalize Cap UVs
  const pos = geometry.attributes.position;
  const uvs = geometry.attributes.uv;

  for (let i = 0; i < halfCap; i++) {
    // Bottom cap (-Z)
    const px = pos.getX(i);
    const py = pos.getY(i);
    uvs.setXY(i, (-px + width / 2) / width, (py + height / 2) / height);
  }

  for (let i = halfCap; i < halfCap * 2; i++) {
    // Top cap (+Z)
    const px = pos.getX(i);
    const py = pos.getY(i);
    uvs.setXY(i, (px + width / 2) / width, (py + height / 2) / height);
  }

  // 5. Materials
  const backTexture = createCardBackTexture();
  const faceTexture = createCardFaceTexture(suit, rank);

  if (faceTexture) {
    faceTexture.anisotropy = 16;
    faceTexture.generateMipmaps = true;
  }
  if (backTexture) {
    backTexture.anisotropy = 16;
    backTexture.generateMipmaps = true;
  }

  const backMaterial = new THREE.MeshStandardMaterial({
    map: backTexture,
    roughness: 0.40,
    metalness: 0.03
  });

  const faceMaterial = new THREE.MeshStandardMaterial({
    map: faceTexture,
    roughness: 0.72, // Matte paper finish eliminates specular glare under casino lighting
    metalness: 0.0
  });

  const edgeMaterial = new THREE.MeshStandardMaterial({
    color: 0xfaf8f2,
    roughness: 0.6,
    metalness: 0.02
  });

  const mesh = new THREE.Mesh(geometry, [backMaterial, faceMaterial, edgeMaterial]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Lay flat on table (normal points up towards +Y)
  mesh.rotation.x = -Math.PI / 2;

  return mesh;
}

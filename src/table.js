import * as THREE from 'three';
import {
  createFeltTexture,
  createFeltBumpMap,
  createFeltMarkingsTexture,
  createLeatherTexture,
  createWoodTexture
} from './textures.js';

/**
 * Builds the 3D Blackjack table:
 * - Semicircle green felt tabletop
 * - Brown leather padded armrest rail
 * - Mahogany wooden backing & dealer-side rim
 * - Twin pedestal wooden table legs
 * - Overhead hanging pendant lamp
 */
export function createTable() {
  const tableGroup = new THREE.Group();

  const feltRadius = 1.15;
  const railWidth = 0.12;
  const outerRadius = feltRadius + railWidth; // 1.27
  const tableThickness = 0.04;

  // 1. Textures & Materials
  const feltTexture = createFeltTexture();
  const feltBumpMap = createFeltBumpMap();
  const leatherTexture = createLeatherTexture();
  const woodTexture = createWoodTexture();

  const feltMaterial = new THREE.MeshStandardMaterial({
    map: feltTexture,
    bumpMap: feltBumpMap,
    bumpScale: 0.003,
    roughness: 0.88,
    metalness: 0.02
  });

  const leatherMaterial = new THREE.MeshStandardMaterial({
    color: 0x482617,
    map: leatherTexture,
    roughness: 0.44,
    metalness: 0.08
  });

  const woodMaterial = new THREE.MeshStandardMaterial({
    color: 0x2e1910,
    map: woodTexture,
    roughness: 0.38,
    metalness: 0.05
  });

  const brassMaterial = new THREE.MeshStandardMaterial({
    color: 0x8a7039,
    roughness: 0.3,
    metalness: 0.85
  });

  // 2. Green Felt (Semicircle)
  // 2D shape in X-Y plane: straight edge along y=0 from -feltRadius to feltRadius;
  // arc curves through y > 0.
  const feltShape = new THREE.Shape();
  feltShape.moveTo(-feltRadius, 0);
  feltShape.lineTo(feltRadius, 0);
  feltShape.absarc(0, 0, feltRadius, 0, Math.PI, false);

  const feltGeometry = new THREE.ExtrudeGeometry(feltShape, {
    depth: tableThickness,
    bevelEnabled: false,
    curveSegments: 64
  });

  // When rotated around X by Math.PI/2:
  // x stays x, y becomes z (0 to feltRadius), z becomes -y (-tableThickness to 0).
  // Top felt surface sits exactly at y = 0.
  const feltMesh = new THREE.Mesh(feltGeometry, feltMaterial);
  feltMesh.rotation.x = Math.PI / 2;
  feltMesh.receiveShadow = true;
  tableGroup.add(feltMesh);

  // 2b. Felt Markings (Text & Markings Layer)
  const markingsTexture = createFeltMarkingsTexture();
  const markingsMaterial = new THREE.MeshStandardMaterial({
    map: markingsTexture,
    transparent: true,
    roughness: 0.65,
    metalness: 0.12,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  });

  const markingsGeo = new THREE.ShapeGeometry(feltShape, 64);
  markingsGeo.rotateX(-Math.PI / 2);
  markingsGeo.rotateY(Math.PI);

  const pos = markingsGeo.attributes.position;
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    uvs[i * 2] = (x + feltRadius) / (2 * feltRadius);
    uvs[i * 2 + 1] = 1.0 - (z / feltRadius);
  }
  markingsGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

  const markingsMesh = new THREE.Mesh(markingsGeo, markingsMaterial);
  markingsMesh.position.y = 0.001; // Slightly above felt to avoid z-fighting
  markingsMesh.receiveShadow = true;
  tableGroup.add(markingsMesh);

  // 3. Brown Leather Rail (Curved Padded Armrest)
  // An arc band from inner radius to outer radius with smooth beveling
  const railShape = new THREE.Shape();
  railShape.moveTo(-outerRadius, 0);
  railShape.lineTo(-feltRadius, 0);
  railShape.absarc(0, 0, feltRadius, Math.PI, 0, true);
  railShape.lineTo(outerRadius, 0);
  railShape.absarc(0, 0, outerRadius, 0, Math.PI, false);
  railShape.closePath();

  const railGeometry = new THREE.ExtrudeGeometry(railShape, {
    depth: tableThickness,
    bevelEnabled: true,
    bevelThickness: 0.022,
    bevelSize: 0.016,
    bevelSegments: 6,
    curveSegments: 64
  });

  const railMesh = new THREE.Mesh(railGeometry, leatherMaterial);
  railMesh.rotation.x = Math.PI / 2;
  // Offset slightly in Y so the bevel pillows comfortably above the felt surface
  railMesh.position.y = 0.008;
  railMesh.castShadow = true;
  railMesh.receiveShadow = true;
  tableGroup.add(railMesh);

  // 4. Dealer-side Back Rim / Edge
  // Straight wooden bar along y=0 (z=0) to seal the flat side
  const dealerBarGeo = new THREE.BoxGeometry(outerRadius * 2 + 0.04, 0.075, 0.09);
  const dealerBar = new THREE.Mesh(dealerBarGeo, woodMaterial);
  dealerBar.position.set(0, -0.015, -0.045);
  dealerBar.castShadow = true;
  dealerBar.receiveShadow = true;
  tableGroup.add(dealerBar);

  // Straight leather bumper strip on top of the dealer bar ends
  const dealerLeatherGeo = new THREE.BoxGeometry(outerRadius * 2 + 0.04, 0.025, 0.09);
  const dealerLeather = new THREE.Mesh(dealerLeatherGeo, leatherMaterial);
  dealerLeather.position.set(0, 0.025, -0.045);
  dealerLeather.castShadow = true;
  dealerLeather.receiveShadow = true;
  tableGroup.add(dealerLeather);

  // 5. Wooden Underbelly / Base Substructure
  const baseShape = new THREE.Shape();
  baseShape.moveTo(-outerRadius - 0.02, 0);
  baseShape.lineTo(outerRadius + 0.02, 0);
  baseShape.absarc(0, 0, outerRadius + 0.02, 0, Math.PI, false);

  const baseGeometry = new THREE.ExtrudeGeometry(baseShape, {
    depth: 0.035,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.01,
    bevelSegments: 3,
    curveSegments: 48
  });
  const baseMesh = new THREE.Mesh(baseGeometry, woodMaterial);
  baseMesh.rotation.x = Math.PI / 2;
  baseMesh.position.y = -tableThickness;
  baseMesh.receiveShadow = true;
  tableGroup.add(baseMesh);

  // 6. Pedestal Wooden Legs
  const legHeight = 0.68;
  const legY = -tableThickness - 0.035 - legHeight / 2;

  function createPedestal(xPos, zPos) {
    const pedestal = new THREE.Group();
    pedestal.position.set(xPos, legY, zPos);

    // Main column
    const columnGeo = new THREE.CylinderGeometry(0.07, 0.09, legHeight, 24);
    const column = new THREE.Mesh(columnGeo, woodMaterial);
    column.castShadow = true;
    column.receiveShadow = true;
    pedestal.add(column);

    // Upper collar
    const topCollarGeo = new THREE.CylinderGeometry(0.12, 0.08, 0.06, 24);
    const topCollar = new THREE.Mesh(topCollarGeo, woodMaterial);
    topCollar.position.y = legHeight / 2 - 0.03;
    topCollar.castShadow = true;
    pedestal.add(topCollar);

    // Brass accent ring
    const brassRingGeo = new THREE.TorusGeometry(0.085, 0.012, 16, 32);
    const brassRing = new THREE.Mesh(brassRingGeo, brassMaterial);
    brassRing.rotation.x = Math.PI / 2;
    brassRing.position.y = legHeight / 2 - 0.07;
    pedestal.add(brassRing);

    // Bottom base foot
    const footGeo = new THREE.CylinderGeometry(0.12, 0.18, 0.07, 24);
    const foot = new THREE.Mesh(footGeo, woodMaterial);
    foot.position.y = -legHeight / 2 + 0.035;
    foot.castShadow = true;
    foot.receiveShadow = true;
    pedestal.add(foot);

    // Brass foot ring
    const brassFootGeo = new THREE.TorusGeometry(0.165, 0.012, 16, 32);
    const brassFoot = new THREE.Mesh(brassFootGeo, brassMaterial);
    brassFoot.rotation.x = Math.PI / 2;
    brassFoot.position.y = -legHeight / 2 + 0.015;
    pedestal.add(brassFoot);

    return pedestal;
  }

  const leftLeg = createPedestal(-0.55, 0.38);
  const rightLeg = createPedestal(0.55, 0.38);
  tableGroup.add(leftLeg);
  tableGroup.add(rightLeg);

  // Horizontal stretcher bar connecting legs
  const stretcherGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.1, 16);
  const stretcher = new THREE.Mesh(stretcherGeo, woodMaterial);
  stretcher.rotation.z = Math.PI / 2;
  stretcher.position.set(0, legY - legHeight / 4, 0.38);
  stretcher.castShadow = true;
  tableGroup.add(stretcher);

  // 7. Overhead Pendant Lamp Fixture (Hangs directly over the board center)
  const lampGroup = new THREE.Group();
  const lampBaseY = 0.52;
  const boardCenterZ = 0.45;
  lampGroup.position.set(0, lampBaseY, boardCenterZ);

  // Materials for the luxury pendant lamp
  const polishedBrassMat = new THREE.MeshStandardMaterial({
    color: 0xdfb15b,
    roughness: 0.22,
    metalness: 0.88
  });

  const antiqueBrassMat = new THREE.MeshStandardMaterial({
    color: 0x9e7a42,
    roughness: 0.35,
    metalness: 0.75
  });

  const shadeOuterMat = new THREE.MeshStandardMaterial({
    color: 0x0d281a, // Classic deep hunter casino green enamel
    roughness: 0.30,
    metalness: 0.22,
    side: THREE.FrontSide
  });

  const shadeInnerMat = new THREE.MeshStandardMaterial({
    color: 0xc89848, // Warm reflective gold interior
    roughness: 0.35,
    metalness: 0.70,
    emissive: 0x221404,
    emissiveIntensity: 0.15,
    side: THREE.BackSide
  });

  const bulbGlassMat = new THREE.MeshStandardMaterial({
    color: 0xffd28a,
    emissive: 0xff8811,
    emissiveIntensity: 0.6,
    roughness: 0.25,
    metalness: 0.05,
    transparent: true,
    opacity: 0.85
  });

  const cordMat = new THREE.MeshStandardMaterial({
    color: 0x161311,
    roughness: 0.75,
    metalness: 0.15
  });

  // Ceiling rosette canopy (mounts to ceiling at y ~ 2.4m)
  const ceilingY = 2.4 - lampBaseY;
  const canopyGeo = new THREE.CylinderGeometry(0.045, 0.065, 0.02, 24);
  const canopy = new THREE.Mesh(canopyGeo, antiqueBrassMat);
  canopy.position.y = ceilingY;
  lampGroup.add(canopy);

  // Braided suspension cord
  const cordLen = ceilingY - 0.12;
  const cordGeo = new THREE.CylinderGeometry(0.0035, 0.0035, cordLen, 12);
  const cord = new THREE.Mesh(cordGeo, cordMat);
  cord.position.y = 0.12 + cordLen / 2;
  lampGroup.add(cord);

  // Antique brass hanging loop / eyelet
  const loopGeo = new THREE.TorusGeometry(0.016, 0.004, 16, 24);
  const loop = new THREE.Mesh(loopGeo, antiqueBrassMat);
  loop.position.y = 0.12;
  lampGroup.add(loop);

  // Turned brass finial, neck & socket collar
  const finialGeo = new THREE.SphereGeometry(0.010, 16, 16);
  const finial = new THREE.Mesh(finialGeo, polishedBrassMat);
  finial.position.y = 0.11;
  lampGroup.add(finial);

  const neckGeo = new THREE.CylinderGeometry(0.024, 0.034, 0.025, 24);
  const neck = new THREE.Mesh(neckGeo, polishedBrassMat);
  neck.position.y = 0.092;
  lampGroup.add(neck);

  const knurledGeo = new THREE.TorusGeometry(0.033, 0.005, 16, 32);
  const knurledRing = new THREE.Mesh(knurledGeo, antiqueBrassMat);
  knurledRing.position.y = 0.078;
  lampGroup.add(knurledRing);

  const socketCapGeo = new THREE.CylinderGeometry(0.036, 0.060, 0.035, 32);
  const socketCap = new THREE.Mesh(socketCapGeo, polishedBrassMat);
  socketCap.position.y = 0.058;
  lampGroup.add(socketCap);

  // Lamp Shade (flared cone: top radius 0.060m, bottom radius 0.21m, height 0.13m)
  const shadeH = 0.13;
  const shadeY = -0.012;

  const shadeOuterGeo = new THREE.CylinderGeometry(0.060, 0.21, shadeH, 48, 1, true);
  const shadeOuter = new THREE.Mesh(shadeOuterGeo, shadeOuterMat);
  shadeOuter.position.y = shadeY;
  shadeOuter.castShadow = true;
  lampGroup.add(shadeOuter);

  const shadeInnerGeo = new THREE.CylinderGeometry(0.059, 0.208, shadeH - 0.001, 48, 1, true);
  const shadeInner = new THREE.Mesh(shadeInnerGeo, shadeInnerMat);
  shadeInner.position.y = shadeY;
  lampGroup.add(shadeInner);

  // Top and bottom brass decorative trim rings
  const topTrimGeo = new THREE.TorusGeometry(0.061, 0.004, 16, 32);
  const topTrim = new THREE.Mesh(topTrimGeo, polishedBrassMat);
  topTrim.position.y = 0.053;
  lampGroup.add(topTrim);

  const bottomRimGeo = new THREE.TorusGeometry(0.21, 0.005, 16, 48);
  const bottomRim = new THREE.Mesh(bottomRimGeo, polishedBrassMat);
  bottomRim.position.y = -0.077;
  lampGroup.add(bottomRim);

  // Interior brass socket & Edison bulb
  const bulbSocketGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.024, 16);
  const bulbSocket = new THREE.Mesh(bulbSocketGeo, antiqueBrassMat);
  bulbSocket.position.y = 0.02;
  lampGroup.add(bulbSocket);

  const bulbGeo = new THREE.SphereGeometry(0.036, 24, 24);
  const bulb = new THREE.Mesh(bulbGeo, bulbGlassMat);
  bulb.position.y = -0.028;
  lampGroup.add(bulb);

  const filamentGeo = new THREE.SphereGeometry(0.010, 12, 12);
  const filamentMat = new THREE.MeshBasicMaterial({ color: 0xffd28a });
  const filament = new THREE.Mesh(filamentGeo, filamentMat);
  filament.position.y = -0.028;
  lampGroup.add(filament);

  tableGroup.add(lampGroup);

  // 8. Casino Dealing Shoe (6-Deck Acrylic Shoe)
  const shoeGroup = new THREE.Group();
  shoeGroup.position.set(0.66, 0.032, 0.08);
  shoeGroup.rotation.y = -0.48; // Angled facing inward towards the dealer/felt

  const shoeMat = new THREE.MeshStandardMaterial({
    color: 0x16171b,
    roughness: 0.2,
    metalness: 0.15
  });

  const acrylicMat = new THREE.MeshStandardMaterial({
    color: 0x242830,
    roughness: 0.1,
    metalness: 0.1,
    transparent: true,
    opacity: 0.75
  });

  // Shoe main angled wedge body
  const shoeBodyGeo = new THREE.BoxGeometry(0.105, 0.065, 0.22);
  const shoeBody = new THREE.Mesh(shoeBodyGeo, shoeMat);
  shoeBody.rotation.x = -0.22;
  shoeBody.position.set(0, 0.015, -0.01);
  shoeBody.castShadow = true;
  shoeBody.receiveShadow = true;
  shoeGroup.add(shoeBody);

  // Shoe acrylic front face / mouth
  const shoeMouthGeo = new THREE.BoxGeometry(0.098, 0.048, 0.03);
  const shoeMouth = new THREE.Mesh(shoeMouthGeo, acrylicMat);
  shoeMouth.rotation.x = -0.22;
  shoeMouth.position.set(0, -0.005, 0.085);
  shoeGroup.add(shoeMouth);

  // Roller wheel at exit
  const rollerGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.085, 16);
  const rollerMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.3 });
  const roller = new THREE.Mesh(rollerGeo, rollerMat);
  roller.rotation.z = Math.PI / 2;
  roller.rotation.x = -0.22;
  roller.position.set(0, -0.008, 0.098);
  shoeGroup.add(roller);

  // Visual card stack inside the shoe
  const stackGeo = new THREE.BoxGeometry(0.076, 0.045, 0.16);
  const stackMat = new THREE.MeshStandardMaterial({
    color: 0x820f15, // Red card deck backs
    roughness: 0.4
  });
  const stack = new THREE.Mesh(stackGeo, stackMat);
  stack.rotation.x = -0.22;
  stack.position.set(0, 0.02, -0.01);
  shoeGroup.add(stack);

  tableGroup.add(shoeGroup);

  return {
    group: tableGroup,
    feltMaterial,
    tableHeight: 0,
    floorY: -tableThickness - 0.035 - legHeight,
    centerTarget: new THREE.Vector3(0, 0, boardCenterZ),
    lampGroup,
    lampPosition: new THREE.Vector3(0, lampBaseY - 0.035, boardCenterZ),
    dealOrigin: new THREE.Vector3(0.61, 0.042, 0.13),
    setFeltColor: (colorHex) => {
      feltMaterial.map = createFeltTexture(colorHex);
      feltMaterial.needsUpdate = true;
    }
  };
}

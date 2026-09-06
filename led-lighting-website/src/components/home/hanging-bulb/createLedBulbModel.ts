import * as THREE from 'three'

// A screen-space artistic approximation of a 4000 K LED, not a calibrated spectral simulation.
// Share the tint across the diffuser, bounce light and halo to avoid an orange/blue mismatch.
export const LED_4000K_COLOR = 0xffe4c4

const lathe = (profile: Array<[number, number]>, segments: number): THREE.LatheGeometry => {
  // Lathe normals face outwards when the profile runs from bottom to top.
  const curve = new THREE.SplineCurve(
    profile.map(([radius, y]) => new THREE.Vector2(radius, y)).reverse(),
  )
  return new THREE.LatheGeometry(
    curve.getPoints(64).map((point) => new THREE.Vector2(Math.max(0, point.x), point.y)),
    segments,
  )
}

const glowTexture = (): THREE.DataTexture => {
  const size = 64
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const distance = Math.min(1, Math.hypot((x / (size - 1)) * 2 - 1, (y / (size - 1)) * 2 - 1))
      const offset = (y * size + x) * 4
      data.set([255, 255, 255, Math.round((1 - distance) ** 3.2 * 255)], offset)
    }
  }
  const texture = new THREE.DataTexture(data, size, size)
  texture.needsUpdate = true
  return texture
}

const diffuserEmissionMap = (): THREE.DataTexture => {
  const height = 64
  const data = new Uint8Array(height * 4)
  for (let index = 0; index < height; index++) {
    const position = index / (height - 1)
    // Soft illumination falloff from the internal LED board, without visible individual chips.
    const intensity = Math.round(255 * (0.5 + 0.5 * Math.sin(position * Math.PI) ** 0.6))
    data.set([intensity, intensity, intensity, 255], index * 4)
  }
  const texture = new THREE.DataTexture(data, 1, height)
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return texture
}

const createMarkingTexture = (): THREE.CanvasTexture | null => {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 192
  const context = canvas.getContext('2d')
  // Labels are decorative: missing Canvas2D must not disable the WebGL model.
  if (!context) return null
  context.fillStyle = '#646d72'
  context.textAlign = 'center'
  context.font = '500 40px sans-serif'
  context.fillText('DF KOREA', 256, 66)
  context.font = '28px sans-serif'
  context.fillText('LED  ·  4000 K', 256, 114)
  context.font = '17px sans-serif'
  context.fillText('NEUTRAL WHITE', 256, 148)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export const createLedBulbModel = (group: THREE.Group, compact: boolean) => {
  const segments = compact ? 64 : 96
  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material) => {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = name
    group.add(mesh)
    return mesh
  }
  const ring = (
    name: string,
    radius: number,
    tube: number,
    y: number,
    material: THREE.Material,
  ) => {
    const mesh = add(name, new THREE.TorusGeometry(radius, tube, 8, segments), material)
    mesh.position.y = y
    mesh.rotation.x = Math.PI / 2
    return mesh
  }
  const dark = new THREE.MeshPhysicalMaterial({ color: 0x202429, roughness: 0.5, metalness: 0.25 })
  const silver = new THREE.MeshPhysicalMaterial({
    color: 0xb9bec2,
    metalness: 0.96,
    roughness: 0.26,
  })
  const ivory = new THREE.MeshPhysicalMaterial({
    color: 0xcbd0d2,
    envMapIntensity: 0.65,
    roughness: 0.38,
    metalness: 0.03,
    clearcoat: 0.18,
    clearcoatRoughness: 0.38,
  })
  const seam = new THREE.MeshStandardMaterial({ color: 0x969fa3, roughness: 0.55, metalness: 0.3 })

  const relief = add('cord-strain-relief', new THREE.CylinderGeometry(0.065, 0.085, 0.16, 24), dark)
  relief.position.y = -0.02
  for (let i = 0; i < 3; i++) ring(`strain-relief-ring-${i}`, 0.075, 0.008, -0.01 - i * 0.035, dark)
  add(
    'pendant-holder',
    lathe(
      [
        [0.075, -0.08],
        [0.15, -0.1],
        [0.2, -0.16],
        [0.205, -0.24],
      ],
      segments,
    ),
    dark,
  )
  ring('holder-lip', 0.205, 0.013, -0.235, silver)

  add(
    'led-screw-base',
    lathe(
      [
        [0.196, -0.23],
        [0.204, -0.27],
        [0.204, -0.51],
        [0.188, -0.56],
      ],
      segments,
    ),
    silver,
  )
  // A continuous helix gives the base a real screw thread, rather than stacked independent rings.
  const threadPoints = Array.from({ length: compact ? 180 : 280 }, (_, index) => {
    const progress = index / ((compact ? 180 : 280) - 1)
    const angle = progress * Math.PI * 2 * 4.3
    return new THREE.Vector3(
      Math.cos(angle) * 0.207,
      -0.255 - progress * 0.27,
      Math.sin(angle) * 0.207,
    )
  })
  add(
    'led-screw-thread',
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(threadPoints),
      compact ? 180 : 280,
      0.017,
      8,
      false,
    ),
    silver,
  )
  ring('base-insulator', 0.196, 0.015, -0.552, dark)
  ring('body-neck-seam', 0.209, 0.009, -0.585, seam)

  const bodyProfile: Array<[number, number]> = [
    [0.199, -0.555],
    [0.239, -0.6],
    [0.286, -0.7],
    [0.382, -0.84],
    [0.513, -1.02],
    [0.63, -1.18],
    [0.707, -1.3],
    [0.729, -1.36],
    [0.73, -1.405],
  ]
  add('led-thermal-housing', lathe(bodyProfile, segments), ivory)
  // Shallow molded ribs follow the housing taper; they stop before the diffuser seam.
  const ribMaterial = new THREE.MeshStandardMaterial({
    color: 0xd1d6d8,
    roughness: 0.48,
    metalness: 0.05,
  })
  const ribGeometry = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.301, -0.72, 0),
      new THREE.Vector3(0.396, -0.86, 0),
      new THREE.Vector3(0.521, -1.03, 0),
      new THREE.Vector3(0.634, -1.185, 0),
      new THREE.Vector3(0.712, -1.315, 0),
    ]),
    24,
    0.005,
    5,
    false,
  )
  for (let index = 0; index < 28; index++) {
    // Leave a smooth front panel for the product marking.
    const angle = (index / 28) * Math.PI * 2
    if (Math.sin(angle) > 0.7) continue
    const rib = add(`housing-rib-${index}`, ribGeometry, ribMaterial)
    rib.rotation.y = -angle
  }
  const marking = createMarkingTexture()
  if (marking) {
    const label = add(
      'led-product-marking',
      new THREE.CylinderGeometry(0.447, 0.66, 0.29, 40, 1, true, -0.6, 1.2),
      new THREE.MeshBasicMaterial({
        map: marking,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
    )
    label.position.y = -1.07
  }
  ring('diffuser-gasket', 0.726, 0.012, -1.401, seam)
  ring('diffuser-retaining-lip', 0.731, 0.008, -1.423, ivory)

  const diffuserMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xeff0eb,
    emissive: LED_4000K_COLOR,
    emissiveMap: diffuserEmissionMap(),
    emissiveIntensity: 0.8,
    roughness: 0.48,
    metalness: 0,
    clearcoat: 0.24,
    clearcoatRoughness: 0.38,
    // Opaque opal polymer keeps the LED board hidden and preserves the silhouette when off.
    transmission: 0,
    envMapIntensity: 0.5,
  })
  const diffuser = new THREE.Mesh(
    lathe(
      [
        [0.729, -1.417],
        [0.742, -1.5],
        [0.733, -1.66],
        [0.687, -1.84],
        [0.589, -2.0],
        [0.437, -2.14],
        [0.24, -2.235],
        [0.07, -2.27],
        [0, -2.272],
      ],
      segments,
    ),
    diffuserMaterial,
  )
  diffuser.name = 'led-diffuser'
  group.add(diffuser)

  const createHalo = (name: string, scale: number) => {
    const material = new THREE.SpriteMaterial({
      map: glowTexture(),
      color: LED_4000K_COLOR,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
      opacity: 0,
    })
    const sprite = new THREE.Sprite(material)
    sprite.name = name
    // Behind the opaque diffuser: glow must never wash out the product surface or label.
    sprite.position.set(0, -1.79, -0.8)
    sprite.scale.set(scale, scale, 1)
    group.add(sprite)
    return material
  }
  const haloMaterial = createHalo('bulb-inner-halo', 3.4)
  const outerHaloMaterial = createHalo('bulb-outer-halo', 5.6)
  const bulbLight = new THREE.PointLight(LED_4000K_COLOR, 2.8, 8, 2)
  bulbLight.name = 'led-bulb-light'
  bulbLight.position.set(0, -1.75, 0.85)
  group.add(bulbLight)
  return {
    globe: diffuser,
    globeMaterial: diffuserMaterial,
    bulbLight,
    haloMaterial,
    outerHaloMaterial,
  }
}

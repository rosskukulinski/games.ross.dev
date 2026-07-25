import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js'

/** Dreamy dawn palette shared across the whole game. */
export const PALETTE = {
  skyTop: 0x4746a8,
  skyMid: 0xbe7ad0,
  skyHorizon: 0xffb98c,
  fog: 0xdfa6c2,
  sun: 0xffe6b8,
  sunLight: 0xffdcae,
  ambient: 0x8f7fd0,
  hemiSky: 0xd9a8e8,
  hemiGround: 0xffd9b3,
  cloud: 0xfff1f4,
  cloudShade: 0xe0a9cd,
  grass: 0x8fd97a,
  grassDark: 0x66bd58,
  dirt: 0xb98a5e,
  dirtDark: 0x8a6042,
  rock: 0xc6b3d6,
  trunk: 0x8a5a3d,
  foliage: [0x63cf77, 0x4db56a, 0x8fe08a, 0xffa8cf] as number[],
  flower: [0xff8fc4, 0xffd166, 0xff9d76, 0xc3a3ff, 0xffffff] as number[],
  stone: 0xd8c7e0,
  stoneDark: 0xb096c4,
}

/**
 * Owns renderer, camera, lighting, sky, clouds and the post-processing
 * chain (ACES + UnrealBloom with HDR threshold + FXAA).
 */
export class SceneManager {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer

  private composer: EffectComposer
  private fxaa: ShaderPass
  private clouds: { mesh: THREE.Object3D; speed: number }[] = []
  private skyUniforms: { [k: string]: THREE.IUniform }

  readonly sunDirection = new THREE.Vector3(0.35, 0.42, 0.55).normalize()

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.Fog(PALETTE.fog, 140, 950)

    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      2400
    )
    this.camera.position.set(0, 10, -20)

    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    container.appendChild(this.renderer.domElement)

    // Post-processing: bloom threshold > 1 so, with ACES tonemapping, only
    // HDR emissives bloom (horn, projectiles, dragon eyes, torches).
    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.65, // strength
      0.45, // radius
      1.05 // threshold in HDR space
    )
    this.composer.addPass(bloom)
    this.composer.addPass(new OutputPass())
    this.fxaa = new ShaderPass(FXAAShader)
    this.composer.addPass(this.fxaa)

    this.setupLighting()
    this.setupSky()
    this.setupClouds()
    this.setupResizeHandler()
    this.layout()
  }

  private setupLighting() {
    const ambient = new THREE.AmbientLight(PALETTE.ambient, 0.55)
    this.scene.add(ambient)

    const sun = new THREE.DirectionalLight(PALETTE.sunLight, 2.2)
    sun.position.copy(this.sunDirection).multiplyScalar(300)
    sun.castShadow = true
    sun.shadow.mapSize.width = 2048
    sun.shadow.mapSize.height = 2048
    sun.shadow.camera.near = 0.5
    sun.shadow.camera.far = 800
    sun.shadow.camera.left = -160
    sun.shadow.camera.right = 160
    sun.shadow.camera.top = 160
    sun.shadow.camera.bottom = -160
    sun.shadow.bias = -0.0005
    this.scene.add(sun)

    const hemi = new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 0.75)
    this.scene.add(hemi)
  }

  private setupSky() {
    const skyGeometry = new THREE.SphereGeometry(1400, 32, 24)
    this.skyUniforms = {
      topColor: { value: new THREE.Color(PALETTE.skyTop) },
      midColor: { value: new THREE.Color(PALETTE.skyMid) },
      bottomColor: { value: new THREE.Color(PALETTE.skyHorizon) },
      sunDirection: { value: this.sunDirection.clone() },
      sunColor: { value: new THREE.Color(PALETTE.sun) },
      time: { value: 0 },
    }
    const skyMaterial = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 bottomColor;
        uniform vec3 sunDirection;
        uniform vec3 sunColor;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, -1.0, 1.0);
          vec3 col;
          if (h > 0.0) {
            col = mix(midColor, topColor, pow(h, 0.65));
          } else {
            col = mix(midColor, bottomColor, pow(-h * 4.0, 0.6));
          }
          // Warm halo + hot core around the sun for a god-ray-ish glow.
          float sunDot = max(dot(normalize(vDir), sunDirection), 0.0);
          col += sunColor * pow(sunDot, 12.0) * 0.55;
          col += sunColor * pow(sunDot, 90.0) * 1.6;
          // Gentle horizon haze band.
          col += bottomColor * exp(-abs(h) * 9.0) * 0.28;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    })
    const sky = new THREE.Mesh(skyGeometry, skyMaterial)
    sky.renderOrder = -10
    this.scene.add(sky)

    // Soft additive sun sprite at the sun position (HDR color -> blooms).
    const sunTexture = this.makeGlowTexture()
    const sunSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: sunTexture,
        color: new THREE.Color(PALETTE.sun).multiplyScalar(2.2),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      })
    )
    sunSprite.position.copy(this.sunDirection).multiplyScalar(1200)
    sunSprite.scale.setScalar(420)
    this.scene.add(sunSprite)

    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: sunTexture,
        color: new THREE.Color(PALETTE.skyHorizon),
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      })
    )
    halo.position.copy(sunSprite.position)
    halo.scale.setScalar(900)
    this.scene.add(halo)
  }

  private makeGlowTexture(): THREE.Texture {
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.25, 'rgba(255,240,214,0.8)')
    grad.addColorStop(0.6, 'rgba(255,214,170,0.25)')
    grad.addColorStop(1, 'rgba(255,200,160,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, size, size)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }

  /** Puffy blob-cluster clouds drifting slowly, in two layers. */
  private setupClouds() {
    const cloudMaterial = new THREE.MeshStandardMaterial({
      color: PALETTE.cloud,
      roughness: 1,
      flatShading: true,
      transparent: true,
      opacity: 0.92,
    })
    const shadeMaterial = cloudMaterial.clone()
    shadeMaterial.color = new THREE.Color(PALETTE.cloudShade)
    shadeMaterial.opacity = 0.8

    for (let i = 0; i < 22; i++) {
      const cluster = new THREE.Group()
      const puffs = 4 + Math.floor(Math.random() * 4)
      const baseSize = 9 + Math.random() * 16
      for (let p = 0; p < puffs; p++) {
        const puff = new THREE.Mesh(
          new THREE.IcosahedronGeometry(baseSize * (0.5 + Math.random() * 0.6), 1),
          Math.random() < 0.75 ? cloudMaterial : shadeMaterial
        )
        puff.position.set(
          (p - puffs / 2) * baseSize * 0.75 + (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * baseSize * 0.4,
          (Math.random() - 0.5) * baseSize * 0.8
        )
        puff.scale.y = 0.55
        cluster.add(puff)
      }
      cluster.position.set(
        (Math.random() - 0.5) * 1300,
        60 + Math.random() * 160 + (i % 2) * 60,
        (Math.random() - 0.5) * 1300
      )
      this.scene.add(cluster)
      this.clouds.push({ mesh: cluster, speed: 1.2 + Math.random() * 2.4 })
    }
  }

  private setupResizeHandler() {
    window.addEventListener('resize', () => this.layout())
  }

  private layout() {
    const w = window.innerWidth
    const h = window.innerHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
    this.composer.setSize(w, h)
    const pr = this.renderer.getPixelRatio()
    this.fxaa.material.uniforms['resolution'].value.set(1 / (w * pr), 1 / (h * pr))
  }

  /** Drift clouds; wrap them around the play area. */
  update(delta: number) {
    for (const cloud of this.clouds) {
      cloud.mesh.position.x += cloud.speed * delta
      if (cloud.mesh.position.x > 700) cloud.mesh.position.x = -700
    }
  }

  render() {
    this.composer.render()
  }
}

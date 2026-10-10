"use client";

import Image from "next/image";
import { memo, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

type LandingCrystalSceneProps = {
  revealed: boolean;
};

type CrystalShard = {
  node: THREE.Group;
  direction: THREE.Vector3;
  tangent: THREE.Vector3;
  distance: number;
  phase: number;
  rotation: THREE.Euler;
};

const LOOP_SECONDS = 18;

function clamp01(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

function easeInOutCubic(value: number) {
  const progress = clamp01(value);
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

function crystalSpreadAt(seconds: number) {
  const time = ((seconds % LOOP_SECONDS) + LOOP_SECONDS) % LOOP_SECONDS;
  if (time < 1.8) return 0;
  if (time < 4.2) return easeInOutCubic((time - 1.8) / 2.4);
  if (time < 11.5) return 1;
  if (time < 14.8) return 1 - easeInOutCubic((time - 11.5) / 3.3);
  return 0;
}

function createShardGeometry(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) {
  const center = new THREE.Vector3(0, 0, 0);
  const vertices = [
    a, b, c,
    a, center, b,
    b, center, c,
    c, center, a,
  ];
  const positions = new Float32Array(vertices.length * 3);

  vertices.forEach((vertex, index) => {
    positions[index * 3] = vertex.x;
    positions[index * 3 + 1] = vertex.y;
    positions[index * 3 + 2] = vertex.z;
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createCausticTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.CanvasTexture(canvas);

  context.clearRect(0, 0, 256, 256);
  context.save();
  context.translate(128, 132);
  context.scale(1, 0.56);

  const cobalt = context.createRadialGradient(0, 0, 8, 0, 0, 112);
  cobalt.addColorStop(0, "rgba(116, 139, 255, 0.42)");
  cobalt.addColorStop(0.34, "rgba(74, 90, 200, 0.22)");
  cobalt.addColorStop(1, "rgba(74, 90, 200, 0)");
  context.fillStyle = cobalt;
  context.beginPath();
  context.arc(0, 0, 112, 0, Math.PI * 2);
  context.fill();

  const coral = context.createRadialGradient(46, -18, 2, 46, -18, 54);
  coral.addColorStop(0, "rgba(229, 125, 92, 0.25)");
  coral.addColorStop(1, "rgba(229, 125, 92, 0)");
  context.fillStyle = coral;
  context.beginPath();
  context.arc(46, -18, 54, 0, Math.PI * 2);
  context.fill();

  context.restore();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function makeCrystalShards(
  material: THREE.MeshPhysicalMaterial,
  edgeMaterial: THREE.LineBasicMaterial,
) {
  const sourceGeometry = new THREE.IcosahedronGeometry(1.08, 0);
  const source = sourceGeometry.index ? sourceGeometry.toNonIndexed() : sourceGeometry;
  const position = source.getAttribute("position");
  const shards: CrystalShard[] = [];
  const up = new THREE.Vector3(0, 1, 0);

  for (let index = 0; index < position.count; index += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(position, index);
    const b = new THREE.Vector3().fromBufferAttribute(position, index + 1);
    const c = new THREE.Vector3().fromBufferAttribute(position, index + 2);
    const centroid = a.clone().add(b).add(c).multiplyScalar(1 / 3);
    const direction = centroid.clone().normalize();
    const tangent = new THREE.Vector3().crossVectors(direction, up);
    if (tangent.lengthSq() < 0.01) tangent.set(1, 0, 0);
    tangent.normalize();

    const geometry = createShardGeometry(a, b, c);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.frustumCulled = false;

    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 24), edgeMaterial);
    edges.renderOrder = 3;

    const node = new THREE.Group();
    node.add(mesh, edges);

    const phase = (index / 3 * 0.61803398875) % 1;
    shards.push({
      node,
      direction,
      tangent,
      distance: 0.34 + ((index / 3) % 5) * 0.075,
      phase,
      rotation: new THREE.Euler(
        (phase - 0.5) * 0.9,
        (((phase * 1.73) % 1) - 0.5) * 1.15,
        (((phase * 2.31) % 1) - 0.5) * 0.75,
      ),
    });
  }

  if (source !== sourceGeometry) source.dispose();
  sourceGeometry.dispose();
  return shards;
}

export const LandingCrystalScene = memo(function LandingCrystalScene({ revealed }: LandingCrystalSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderStaticRef = useRef<(() => void) | null>(null);
  const revealRef = useRef(revealed ? 1 : 0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    revealRef.current = revealed ? 1 : 0;
    renderStaticRef.current?.();
  }, [revealed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const sceneCanvas = canvas;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compactViewport = window.matchMedia("(max-width: 760px)");
    const isCompact = compactViewport.matches;
    let renderer: THREE.WebGLRenderer;

    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: !isCompact,
        powerPreference: "high-performance",
      });
    } catch {
      setFailed(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = !isCompact;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
    camera.position.set(0, 0, 8);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, 0.04).texture;
    scene.environment = environment;
    room.dispose();
    pmrem.dispose();

    const textureLoader = new THREE.TextureLoader();
    const backgroundMaterial = new THREE.MeshBasicMaterial({ toneMapped: false });
    const backgroundPlane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), backgroundMaterial);
    backgroundPlane.position.z = -5;
    backgroundPlane.renderOrder = -10;
    scene.add(backgroundPlane);

    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xeef3ff),
      metalness: 0,
      roughness: 0.055,
      transmission: 1,
      thickness: 0.68,
      ior: 1.48,
      dispersion: isCompact ? 0.06 : 0.12,
      clearcoat: 0.32,
      clearcoatRoughness: 0.07,
      specularIntensity: 0.96,
      attenuationColor: new THREE.Color(0x9aa7ff),
      attenuationDistance: 5.8,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
      flatShading: true,
    });
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: 0xeaf0ff,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    });

    const crystalGroup = new THREE.Group();
    crystalGroup.scale.set(1.03, 1.27, 1.03);
    const shards = makeCrystalShards(glassMaterial, edgeMaterial);
    shards.forEach((shard) => crystalGroup.add(shard.node));
    scene.add(crystalGroup);

    const shadowMaterial = new THREE.ShadowMaterial({ color: 0x17234d, opacity: 0.2 });
    shadowMaterial.transparent = true;
    const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(4.1, 3.6), shadowMaterial);
    shadowPlane.position.z = -1.28;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    const causticTexture = createCausticTexture();
    const causticMaterial = new THREE.MeshBasicMaterial({
      map: causticTexture,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const causticPlane = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 2.7), causticMaterial);
    causticPlane.position.z = -1.22;
    scene.add(causticPlane);

    scene.add(new THREE.HemisphereLight(0xeef3ff, 0x263667, 1.55));

    const keyLight = new THREE.DirectionalLight(0xf7f8ff, 4.1);
    keyLight.position.set(-4.4, 5.2, 5.6);
    keyLight.castShadow = !isCompact;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.1;
    keyLight.shadow.camera.far = 16;
    keyLight.shadow.camera.left = -3;
    keyLight.shadow.camera.right = 3;
    keyLight.shadow.camera.top = 3;
    keyLight.shadow.camera.bottom = -3;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const cobaltLight = new THREE.PointLight(0x6678ff, 8.5, 9, 2);
    cobaltLight.position.set(3.8, 1.6, 3.1);
    scene.add(cobaltLight);

    const coralLight = new THREE.PointLight(0xe57d5c, 2.2, 6, 2);
    coralLight.position.set(1.8, -2.4, 2.1);
    scene.add(coralLight);

    let disposed = false;
    let texture: THREE.Texture | null = null;
    let sceneVisible = true;
    let documentVisible = !document.hidden;
    let animationStartedAt = performance.now();
    let lastFrame = 0;
    let currentReveal = revealRef.current;
    let targetPointerX = 0;
    let targetPointerY = 0;
    let pointerX = 0;
    let pointerY = 0;
    let lastWidth = 0;
    let lastHeight = 0;

    function resize() {
      const width = Math.max(1, sceneCanvas.clientWidth);
      const height = Math.max(1, sceneCanvas.clientHeight);
      if (width === lastWidth && height === lastHeight) return;
      lastWidth = width;
      lastHeight = height;

      const pixelRatio = Math.min(window.devicePixelRatio || 1, isCompact ? 1 : 1.5);
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      const backgroundDistance = camera.position.z - backgroundPlane.position.z;
      const backgroundHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * backgroundDistance;
      backgroundPlane.scale.set(backgroundHeight * camera.aspect / 2, backgroundHeight / 2, 1);

      if (texture?.image instanceof HTMLImageElement) {
        const viewportAspect = width / height;
        const imageAspect = texture.image.naturalWidth / texture.image.naturalHeight;
        if (viewportAspect < imageAspect) {
          texture.repeat.set(viewportAspect / imageAspect, 1);
          texture.offset.set((1 - texture.repeat.x) / 2, 0);
        } else {
          texture.repeat.set(1, imageAspect / viewportAspect);
          texture.offset.set(0, (1 - texture.repeat.y) / 2);
        }
        texture.needsUpdate = true;
      }

      const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
      const visibleWidth = visibleHeight * camera.aspect;
      crystalGroup.position.set(isCompact ? visibleWidth * 0.22 : visibleWidth * 0.285, isCompact ? -0.58 : -0.42, 0);
      shadowPlane.position.x = crystalGroup.position.x + 0.18;
      shadowPlane.position.y = crystalGroup.position.y - 0.2;
      causticPlane.position.x = crystalGroup.position.x + 0.16;
      causticPlane.position.y = crystalGroup.position.y - 0.18;
      crystalGroup.scale.setScalar(isCompact ? 0.82 : 1.03);
      crystalGroup.scale.y *= 1.23;
    }

    function updateScene(seconds: number, forceReducedMotion = false) {
      const loopTime = ((seconds % LOOP_SECONDS) + LOOP_SECONDS) % LOOP_SECONDS;
      const spread = forceReducedMotion ? 0.56 : crystalSpreadAt(loopTime);
      const orbit = forceReducedMotion ? 0.17 : loopTime / LOOP_SECONDS;
      const hover = forceReducedMotion ? 0 : Math.sin(orbit * Math.PI * 2) * 0.065;

      currentReveal += (revealRef.current - currentReveal) * (forceReducedMotion ? 1 : 0.045);
      crystalGroup.rotation.set(
        -0.12 + Math.sin(orbit * Math.PI * 2) * 0.055,
        orbit * Math.PI * 2,
        0.08 + Math.sin(orbit * Math.PI * 4) * 0.035,
      );
      crystalGroup.position.y += hover;
      crystalGroup.position.z = -currentReveal * 0.24;

      shards.forEach((shard, index) => {
        const pulse = forceReducedMotion ? 0 : Math.sin((orbit + shard.phase) * Math.PI * 4) * 0.045 * spread;
        const tangentDrift = forceReducedMotion ? 0 : Math.cos((orbit * 1.5 + shard.phase) * Math.PI * 2) * 0.055 * spread;
        shard.node.position.copy(shard.direction).multiplyScalar((shard.distance + pulse) * spread);
        shard.node.position.addScaledVector(shard.tangent, tangentDrift);
        shard.node.rotation.set(
          shard.rotation.x * spread,
          shard.rotation.y * spread + index * 0.004 * spread,
          shard.rotation.z * spread,
        );
      });

      glassMaterial.attenuationDistance = 5.8 + spread * 1.8;
      edgeMaterial.opacity = 0.13 + spread * 0.09;
      shadowMaterial.opacity = (0.2 - spread * 0.055) * (1 - currentReveal * 0.36);
      causticMaterial.opacity = (0.2 + spread * 0.11) * (1 - currentReveal * 0.42);
      causticPlane.scale.set(1 + spread * 0.16, 1 + spread * 0.09, 1);
      causticPlane.rotation.z = -0.12 + orbit * Math.PI * 2;
    }

    function renderFrame(time: number, forceReducedMotion = false) {
      if (disposed) return;
      resize();

      if (!forceReducedMotion) {
        pointerX += (targetPointerX - pointerX) * 0.05;
        pointerY += (targetPointerY - pointerY) * 0.05;
      }
      camera.position.x = forceReducedMotion ? 0 : pointerX * 0.32;
      camera.position.y = forceReducedMotion ? 0 : pointerY * 0.22;
      camera.lookAt(0, 0, 0);

      const seconds = forceReducedMotion ? 3.35 : (time - animationStartedAt) / 1000;
      const baseY = crystalGroup.position.y;
      updateScene(seconds, forceReducedMotion);
      renderer.render(scene, camera);
      crystalGroup.position.y = baseY;
    }

    function animate(time: number) {
      if (isCompact && time - lastFrame < 32) return;
      lastFrame = time;
      renderFrame(time);
    }

    function syncAnimation() {
      const shouldAnimate = !reducedMotion.matches && sceneVisible && documentVisible && !disposed;
      renderer.setAnimationLoop(shouldAnimate ? animate : null);
      if (!shouldAnimate && !disposed) renderFrame(performance.now(), reducedMotion.matches);
    }

    function handlePointerMove(event: PointerEvent) {
      if (isCompact || event.pointerType === "touch" || reducedMotion.matches) return;
      targetPointerX = ((event.clientX / window.innerWidth) - 0.5) * 2;
      targetPointerY = (0.5 - (event.clientY / window.innerHeight)) * 2;
    }

    function handlePointerLeave() {
      targetPointerX = 0;
      targetPointerY = 0;
    }

    function handleVisibilityChange() {
      documentVisible = !document.hidden;
      if (documentVisible) animationStartedAt = performance.now();
      syncAnimation();
    }

    function handleMotionChange() {
      animationStartedAt = performance.now();
      syncAnimation();
    }

    function handleContextLost(event: Event) {
      event.preventDefault();
      renderer.setAnimationLoop(null);
      setReady(false);
      setFailed(true);
    }

    const observer = new IntersectionObserver(([entry]) => {
      sceneVisible = entry?.isIntersecting ?? true;
      syncAnimation();
    }, { threshold: 0.02 });
    observer.observe(canvas);

    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", handlePointerLeave);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    canvas.addEventListener("webglcontextlost", handleContextLost);
    reducedMotion.addEventListener("change", handleMotionChange);

    renderStaticRef.current = () => renderFrame(performance.now(), reducedMotion.matches);

    textureLoader.load(
      "/landing-knowledge-still-life-lit-v2.png",
      (loadedTexture) => {
        if (disposed) {
          loadedTexture.dispose();
          return;
        }
        texture = loadedTexture;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        backgroundMaterial.map = texture;
        backgroundMaterial.needsUpdate = true;
        resize();
        renderFrame(performance.now(), reducedMotion.matches);
        setReady(true);
        setFailed(false);
        syncAnimation();
      },
      undefined,
      () => setFailed(true),
    );

    return () => {
      disposed = true;
      renderStaticRef.current = null;
      renderer.setAnimationLoop(null);
      observer.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointerMove);
      document.documentElement.removeEventListener("pointerleave", handlePointerLeave);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      reducedMotion.removeEventListener("change", handleMotionChange);

      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
          geometries.add(object.geometry);
          const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
          objectMaterials.forEach((material) => materials.add(material));
        }
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      texture?.dispose();
      causticTexture.dispose();
      environment.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      className={`landing-crystal-layer${ready ? " is-ready" : ""}${failed ? " is-failed" : ""}`}
      aria-hidden="true"
    >
      <Image
        className="landing-crystal-poster"
        src="/landing-crystal-poster-v1.png"
        alt=""
        width={1254}
        height={1254}
        sizes="(max-width: 760px) 64vw, 34vw"
      />
      <canvas ref={canvasRef} className="landing-crystal-canvas" />
    </div>
  );
});

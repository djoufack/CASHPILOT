import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Login3DBackground — Immersive constellation network with shooting stars.
 * Pure Three.js canvas, no React Three Fiber needed.
 * Renders behind login form as a fixed fullscreen layer.
 * Falls back to a CSS gradient when WebGL is unavailable (headless, old devices).
 */

const isWebGLAvailable = () => {
  try {
    const testCanvas = document.createElement('canvas');
    return !!(testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl'));
  } catch {
    return false;
  }
};

const Login3DBackground = () => {
  const canvasRef = useRef(null);
  const webGLSupported = isWebGLAvailable();

  useEffect(() => {
    if (!webGLSupported) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // --- Renderer ---
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch {
      // WebGL init failed at runtime — nothing to render
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 4.5;

    // --- Star Particles (constellation nodes) ---
    const STAR_COUNT = 320;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(STAR_COUNT * 3);
    const starSizes = new Float32Array(STAR_COUNT);
    const starVelocities = [];

    for (let i = 0; i < STAR_COUNT; i++) {
      const i3 = i * 3;
      starPositions[i3] = (Math.random() - 0.5) * 14;
      starPositions[i3 + 1] = (Math.random() - 0.5) * 10;
      starPositions[i3 + 2] = (Math.random() - 0.5) * 8;
      starSizes[i] = Math.random() * 3 + 1;
      starVelocities.push({
        x: (Math.random() - 0.5) * 0.003,
        y: (Math.random() - 0.5) * 0.003,
        z: (Math.random() - 0.5) * 0.002,
      });
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));

    const starMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uColor1: { value: new THREE.Color(0x7b61ff) }, // violet
        uColor2: { value: new THREE.Color(0xffd67d) }, // gold
      },
      vertexShader: `
        attribute float size;
        uniform float uTime;
        varying float vAlpha;
        varying float vMix;
        void main() {
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (200.0 / -mvPos.z);
          gl_Position = projectionMatrix * mvPos;
          vAlpha = 0.4 + 0.6 * sin(uTime * 0.8 + position.x * 2.0 + position.y * 3.0) * 0.5 + 0.5;
          vMix = sin(uTime * 0.3 + position.z * 1.5) * 0.5 + 0.5;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        varying float vAlpha;
        varying float vMix;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          if (d > 1.0) discard;
          float glow = exp(-d * d * 3.0);
          vec3 color = mix(uColor1, uColor2, vMix);
          gl_FragColor = vec4(color, glow * vAlpha * 0.85);
        }
      `,
    });

    const stars = new THREE.Points(starGeo, starMaterial);
    scene.add(stars);

    // --- Constellation Lines (dynamic connections) ---
    const MAX_LINES = 200;
    const lineGeo = new THREE.BufferGeometry();
    const linePositions = new Float32Array(MAX_LINES * 6);
    const lineColors = new Float32Array(MAX_LINES * 6);
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    lineGeo.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));
    lineGeo.setDrawRange(0, 0);

    const lineMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const lines = new THREE.LineSegments(lineGeo, lineMaterial);
    scene.add(lines);

    // --- Shooting Stars ---
    const SHOOTING_STAR_COUNT = 3;
    const shootingStars = [];

    const createShootingStar = () => {
      const geo = new THREE.BufferGeometry();
      const trailLength = 20;
      const positions = new Float32Array(trailLength * 3);
      const alphas = new Float32Array(trailLength);
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

      const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uColor: { value: new THREE.Color(0xffd67d) } },
        vertexShader: `
          attribute float alpha;
          varying float vAlpha;
          void main() {
            vAlpha = alpha;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = mix(1.0, 4.0, alpha);
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          varying float vAlpha;
          void main() {
            float d = length(gl_PointCoord - 0.5) * 2.0;
            if (d > 1.0) discard;
            gl_FragColor = vec4(uColor, vAlpha * (1.0 - d));
          }
        `,
      });

      const points = new THREE.Points(geo, mat);
      scene.add(points);

      return {
        mesh: points,
        geo,
        trailLength,
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 60,
      };
    };

    for (let i = 0; i < SHOOTING_STAR_COUNT; i++) {
      shootingStars.push(createShootingStar());
    }

    const launchShootingStar = (ss) => {
      const side = Math.floor(Math.random() * 4);
      const spread = 8;
      switch (side) {
        case 0: // top
          ss.pos.set((Math.random() - 0.5) * spread * 2, spread, (Math.random() - 0.5) * 4);
          ss.vel.set((Math.random() - 0.5) * 0.15, -0.12 - Math.random() * 0.08, 0);
          break;
        case 1: // right
          ss.pos.set(spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * 4);
          ss.vel.set(-0.12 - Math.random() * 0.08, (Math.random() - 0.5) * 0.1, 0);
          break;
        case 2: // bottom
          ss.pos.set((Math.random() - 0.5) * spread * 2, -spread, (Math.random() - 0.5) * 4);
          ss.vel.set((Math.random() - 0.5) * 0.15, 0.12 + Math.random() * 0.08, 0);
          break;
        default: // left
          ss.pos.set(-spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * 4);
          ss.vel.set(0.12 + Math.random() * 0.08, (Math.random() - 0.5) * 0.1, 0);
      }
      ss.life = 0;
      ss.maxLife = 50 + Math.random() * 40;
      ss.active = true;
    };

    // --- Central Glow (subtle nebula) ---
    const glowGeo = new THREE.PlaneGeometry(12, 12);
    const glowMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          vec2 center = vUv - 0.5;
          float d = length(center);
          float pulse = 0.04 + 0.015 * sin(uTime * 0.4);
          float glow = pulse * exp(-d * d * 6.0);
          vec3 c1 = vec3(0.482, 0.380, 1.0); // violet
          vec3 c2 = vec3(1.0, 0.839, 0.49);  // gold
          vec3 color = mix(c1, c2, sin(uTime * 0.2) * 0.5 + 0.5);
          gl_FragColor = vec4(color, glow);
        }
      `,
    });
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);
    glowMesh.position.z = -2;
    scene.add(glowMesh);

    // --- Mouse tracking ---
    let mouseX = 0;
    let mouseY = 0;
    const onMouseMove = (e) => {
      mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', onMouseMove);

    // --- Resize ---
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    // --- Animation Loop ---
    let frame = 0;
    let lastShootingStarTime = 0;
    let animId;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      frame++;
      const time = frame * 0.016;

      // Update star material time
      starMaterial.uniforms.uTime.value = time;
      glowMat.uniforms.uTime.value = time;

      // Move star particles gently
      const posArr = starGeo.attributes.position.array;
      for (let i = 0; i < STAR_COUNT; i++) {
        const i3 = i * 3;
        posArr[i3] += starVelocities[i].x;
        posArr[i3 + 1] += starVelocities[i].y;
        posArr[i3 + 2] += starVelocities[i].z;

        // Wrap around
        if (posArr[i3] > 7) posArr[i3] = -7;
        if (posArr[i3] < -7) posArr[i3] = 7;
        if (posArr[i3 + 1] > 5) posArr[i3 + 1] = -5;
        if (posArr[i3 + 1] < -5) posArr[i3 + 1] = 5;
      }
      starGeo.attributes.position.needsUpdate = true;

      // Dynamic constellation lines — connect nearby stars
      const CONNECTION_DIST = 2.2;
      let lineIdx = 0;
      const lp = lineGeo.attributes.position.array;
      const lc = lineGeo.attributes.color.array;
      const violet = [0.482, 0.38, 1.0];
      const gold = [1.0, 0.839, 0.49];

      for (let i = 0; i < STAR_COUNT && lineIdx < MAX_LINES; i++) {
        for (let j = i + 1; j < STAR_COUNT && lineIdx < MAX_LINES; j++) {
          const dx = posArr[i * 3] - posArr[j * 3];
          const dy = posArr[i * 3 + 1] - posArr[j * 3 + 1];
          const dz = posArr[i * 3 + 2] - posArr[j * 3 + 2];
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist < CONNECTION_DIST) {
            const idx6 = lineIdx * 6;
            lp[idx6] = posArr[i * 3];
            lp[idx6 + 1] = posArr[i * 3 + 1];
            lp[idx6 + 2] = posArr[i * 3 + 2];
            lp[idx6 + 3] = posArr[j * 3];
            lp[idx6 + 4] = posArr[j * 3 + 1];
            lp[idx6 + 5] = posArr[j * 3 + 2];

            const blend = dist / CONNECTION_DIST;
            for (let k = 0; k < 2; k++) {
              const ci = idx6 + k * 3;
              lc[ci] = violet[0] * blend + gold[0] * (1 - blend);
              lc[ci + 1] = violet[1] * blend + gold[1] * (1 - blend);
              lc[ci + 2] = violet[2] * blend + gold[2] * (1 - blend);
            }
            lineIdx++;
          }
        }
      }
      lineGeo.setDrawRange(0, lineIdx * 2);
      lineGeo.attributes.position.needsUpdate = true;
      lineGeo.attributes.color.needsUpdate = true;

      // Shooting stars
      if (frame - lastShootingStarTime > 160 + Math.random() * 100) {
        const inactive = shootingStars.find((s) => !s.active);
        if (inactive) {
          launchShootingStar(inactive);
          lastShootingStarTime = frame;
        }
      }

      for (const ss of shootingStars) {
        if (!ss.active) continue;
        ss.pos.add(ss.vel);
        ss.life++;

        const positions = ss.geo.attributes.position.array;
        const alphas = ss.geo.attributes.alpha.array;

        // Shift trail
        for (let i = ss.trailLength - 1; i > 0; i--) {
          positions[i * 3] = positions[(i - 1) * 3];
          positions[i * 3 + 1] = positions[(i - 1) * 3 + 1];
          positions[i * 3 + 2] = positions[(i - 1) * 3 + 2];
        }
        positions[0] = ss.pos.x;
        positions[1] = ss.pos.y;
        positions[2] = ss.pos.z;

        for (let i = 0; i < ss.trailLength; i++) {
          alphas[i] = Math.max(0, 1 - i / ss.trailLength) * (1 - ss.life / ss.maxLife);
        }

        ss.geo.attributes.position.needsUpdate = true;
        ss.geo.attributes.alpha.needsUpdate = true;

        if (ss.life >= ss.maxLife) ss.active = false;
      }

      // Camera follows mouse gently
      camera.position.x += (mouseX * 0.4 - camera.position.x) * 0.02;
      camera.position.y += (mouseY * 0.3 - camera.position.y) * 0.02;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      renderer?.dispose();
      starGeo.dispose();
      starMaterial.dispose();
      lineGeo.dispose();
      lineMaterial.dispose();
      glowGeo.dispose();
      glowMat.dispose();
      shootingStars.forEach((ss) => {
        ss.geo.dispose();
        ss.mesh.material.dispose();
      });
    };
  }, [webGLSupported]);

  if (!webGLSupported) {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 40%, rgba(123,97,255,0.18) 0%, rgba(10,10,30,0.95) 70%)',
        }}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
      style={{ width: '100vw', height: '100vh' }}
    />
  );
};

export default Login3DBackground;

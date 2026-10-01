"use client";

import { useEffect, useRef } from "react";

/**
 * Soft Three.js backdrop — floating dust + translucent planes.
 * Fixed, pointer-events none; pauses when the tab is hidden or motion is reduced.
 */
export function CrmAtmosphere3d() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let disposed = false;
    let raf = 0;
    let renderer: import("three").WebGLRenderer | null = null;
    let onResize: (() => void) | null = null;
    let onVisibility: (() => void) | null = null;

    void (async () => {
      const THREE = await import("three");
      if (disposed || !canvas.isConnected) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
      camera.position.set(0, 0.15, 6.2);

      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: false,
        powerPreference: "low-power",
      });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

      const ambient = new THREE.AmbientLight(0xf4e5c1, 0.35);
      scene.add(ambient);
      const key = new THREE.PointLight(0x31595d, 18, 28, 2);
      key.position.set(-3.5, 2.2, 4);
      scene.add(key);
      const rim = new THREE.PointLight(0xecbb5a, 8, 22, 2);
      rim.position.set(4.2, -1.4, 2.5);
      scene.add(rim);
      const glow = new THREE.PointLight(0x9f2627, 4, 18, 2);
      glow.position.set(-1.5, -2.8, 1.5);
      scene.add(glow);

      const particleCount = 420;
      const positions = new Float32Array(particleCount * 3);
      const speeds = new Float32Array(particleCount);
      for (let i = 0; i < particleCount; i += 1) {
        positions[i * 3] = (Math.random() - 0.5) * 16;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 10 - 1;
        speeds[i] = 0.08 + Math.random() * 0.22;
      }
      const dustGeo = new THREE.BufferGeometry();
      dustGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const dustMat = new THREE.PointsMaterial({
        color: 0xd0ad74,
        size: 0.035,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        sizeAttenuation: true,
      });
      const dust = new THREE.Points(dustGeo, dustMat);
      scene.add(dust);

      const accentDustGeo = new THREE.BufferGeometry();
      const accentPos = new Float32Array(140 * 3);
      for (let i = 0; i < 140; i += 1) {
        accentPos[i * 3] = (Math.random() - 0.5) * 14;
        accentPos[i * 3 + 1] = (Math.random() - 0.5) * 9;
        accentPos[i * 3 + 2] = (Math.random() - 0.5) * 8;
      }
      accentDustGeo.setAttribute(
        "position",
        new THREE.BufferAttribute(accentPos, 3),
      );
      const accentDust = new THREE.Points(
        accentDustGeo,
        new THREE.PointsMaterial({
          color: 0x7eb8b4,
          size: 0.05,
          transparent: true,
          opacity: 0.35,
          depthWrite: false,
        }),
      );
      scene.add(accentDust);

      function makePlane(
        color: number,
        w: number,
        h: number,
        x: number,
        y: number,
        z: number,
        rx: number,
        ry: number,
      ) {
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(w, h),
          new THREE.MeshStandardMaterial({
            color,
            transparent: true,
            opacity: 0.11,
            side: THREE.DoubleSide,
            roughness: 0.85,
            metalness: 0.15,
            depthWrite: false,
          }),
        );
        mesh.position.set(x, y, z);
        mesh.rotation.set(rx, ry, 0);
        scene.add(mesh);
        return mesh;
      }

      const planeA = makePlane(0x31595d, 7.5, 4.2, -2.4, 0.6, -2.2, -0.35, 0.4);
      const planeB = makePlane(0xecbb5a, 5.5, 3.4, 2.8, -0.8, -1.4, 0.25, -0.55);
      const planeC = makePlane(0x9f2627, 4.2, 2.8, 0.2, 1.4, -3.2, 0.5, 0.15);

      const orbGeo = new THREE.SphereGeometry(0.55, 24, 24);
      const orbA = new THREE.Mesh(
        orbGeo,
        new THREE.MeshStandardMaterial({
          color: 0x31595d,
          transparent: true,
          opacity: 0.18,
          roughness: 0.4,
          metalness: 0.3,
          depthWrite: false,
        }),
      );
      orbA.position.set(-2.8, 1.1, 0.4);
      scene.add(orbA);

      const orbB = new THREE.Mesh(
        orbGeo.clone(),
        new THREE.MeshStandardMaterial({
          color: 0xecbb5a,
          transparent: true,
          opacity: 0.12,
          roughness: 0.5,
          metalness: 0.25,
          depthWrite: false,
        }),
      );
      orbB.scale.setScalar(0.7);
      orbB.position.set(3.1, -1.2, 0.8);
      scene.add(orbB);

      const resize = () => {
        if (!renderer) return;
        const w = window.innerWidth;
        const h = window.innerHeight;
        camera.aspect = w / Math.max(h, 1);
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      };
      onResize = resize;
      resize();
      window.addEventListener("resize", resize);

      let running = document.visibilityState === "visible";
      onVisibility = () => {
        running = document.visibilityState === "visible";
      };
      document.addEventListener("visibilitychange", onVisibility);

      const posAttr = dustGeo.getAttribute(
        "position",
      ) as import("three").BufferAttribute;
      const pos = posAttr.array as Float32Array;
      let last = performance.now();

      const tick = (now: number) => {
        if (disposed) return;
        raf = requestAnimationFrame(tick);
        if (!running || !renderer) return;
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        const t = now * 0.001;

        for (let i = 0; i < particleCount; i += 1) {
          const iy = i * 3 + 1;
          pos[iy] = (pos[iy] ?? 0) + (speeds[i] ?? 0.1) * dt * 0.35;
          if ((pos[iy] ?? 0) > 5) {
            pos[iy] = -5;
            pos[i * 3] = (Math.random() - 0.5) * 16;
          }
        }
        posAttr.needsUpdate = true;

        planeA.rotation.z = Math.sin(t * 0.12) * 0.08;
        planeB.rotation.z = Math.cos(t * 0.1) * 0.1;
        planeC.position.y = 1.4 + Math.sin(t * 0.18) * 0.25;
        orbA.position.y = 1.1 + Math.sin(t * 0.35) * 0.35;
        orbB.position.y = -1.2 + Math.cos(t * 0.28) * 0.3;
        orbA.rotation.y = t * 0.15;
        orbB.rotation.x = t * 0.12;

        camera.position.x = Math.sin(t * 0.07) * 0.35;
        camera.position.y = 0.15 + Math.cos(t * 0.09) * 0.12;
        camera.lookAt(0, 0, 0);

        dust.rotation.y = t * 0.02;
        accentDust.rotation.y = -t * 0.015;

        renderer.render(scene, camera);
      };
      tick(performance.now());
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (onResize) window.removeEventListener("resize", onResize);
      if (onVisibility) {
        document.removeEventListener("visibilitychange", onVisibility);
      }
      renderer?.dispose();
      renderer = null;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="crm-atmosphere-3d"
      aria-hidden
    />
  );
}

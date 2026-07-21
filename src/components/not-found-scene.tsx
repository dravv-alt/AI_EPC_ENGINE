"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/** A deliberately small, dependency-free Three.js scene for the error route. */
export function NotFoundScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
    } catch {
      canvas.style.display = "none";
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0.2, 8.5);

    const system = new THREE.Group();
    scene.add(system);

    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.42, 2),
      new THREE.MeshStandardMaterial({ color: 0x9cc7b5, emissive: 0x123d32, emissiveIntensity: 1.1, metalness: 0.25, roughness: 0.35, flatShading: true })
    );
    system.add(core);

    const wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1.73, 2)),
      new THREE.LineBasicMaterial({ color: 0xe9b06e, transparent: true, opacity: 0.8 })
    );
    system.add(wire);

    const orbitMaterial = new THREE.LineBasicMaterial({ color: 0x86a9ff, transparent: true, opacity: 0.55 });
    const orbitGeometries: THREE.BufferGeometry[] = [];
    for (let index = 0; index < 3; index += 1) {
      const radius = 2.65 + index * 0.28;
      const points = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2).getPoints(120);
      const orbitGeometry = new THREE.BufferGeometry().setFromPoints(points);
      orbitGeometries.push(orbitGeometry);
      const orbit = new THREE.LineLoop(orbitGeometry, orbitMaterial);
      orbit.rotation.set(index * 0.72, index * 0.92, index * 0.38);
      system.add(orbit);
    }

    const pointPositions: number[] = [];
    for (let index = 0; index < 160; index += 1) {
      const theta = index * 2.39996;
      const radius = 3.15 + (index % 9) * 0.14;
      pointPositions.push(Math.cos(theta) * radius, Math.sin(theta * 1.7) * radius * 0.72, Math.sin(theta * 0.7) * 0.55);
    }
    const particlesGeometry = new THREE.BufferGeometry();
    particlesGeometry.setAttribute("position", new THREE.Float32BufferAttribute(pointPositions, 3));
    const particles = new THREE.Points(particlesGeometry, new THREE.PointsMaterial({ color: 0xf7f3e9, size: 0.035, transparent: true, opacity: 0.75, sizeAttenuation: true }));
    system.add(particles);

    scene.add(new THREE.HemisphereLight(0xb9d5ff, 0x0c1c19, 2.8));
    const rim = new THREE.PointLight(0xffae64, 16, 22);
    rim.position.set(-4, 3, 5);
    scene.add(rim);
    const fill = new THREE.PointLight(0x6ca9ff, 10, 18);
    fill.position.set(4, -2, 3);
    scene.add(fill);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let lastTime = performance.now();
    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const animate = (time: number) => {
      const delta = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      if (!reducedMotion) {
        system.rotation.y += delta * 0.16;
        system.rotation.x = Math.sin(time * 0.00032) * 0.13;
        wire.rotation.z -= delta * 0.1;
        particles.rotation.z += delta * 0.035;
      }
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      core.geometry.dispose();
      (core.material as THREE.Material).dispose();
      wire.geometry.dispose();
      (wire.material as THREE.Material).dispose();
      particlesGeometry.dispose();
      (particles.material as THREE.Material).dispose();
      orbitGeometries.forEach((geometry) => geometry.dispose());
      orbitMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="not-found-canvas" aria-hidden="true" />;
}

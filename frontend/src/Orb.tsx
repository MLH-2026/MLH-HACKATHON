import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function Orb() {
  const viewport = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const container = viewport.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0, 0);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 40);
    camera.position.set(0.5, 0.65, 6.5);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableDamping = true;
    controlsRef.current = controls;
    controls.saveState();
    setAvailable(true);

    scene.add(new THREE.HemisphereLight(0xe9ffc8, 0x0d4038, 2));
    const key = new THREE.DirectionalLight(0xf0ffb7, 3);
    key.position.set(-3, 5, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x56e1c1, 2);
    rim.position.set(3, -1, -4);
    scene.add(rim);

    const crystal = new THREE.Group();
    const geometry = new THREE.IcosahedronGeometry(1.03, 1);
    const material = new THREE.MeshStandardMaterial({
      color: 0xa5db45, roughness: 0.28, metalness: 0.28, flatShading: true,
    });
    crystal.add(new THREE.Mesh(geometry, material));
    const edges = new THREE.EdgesGeometry(geometry, 10);
    const edgeInk = new THREE.LineBasicMaterial({ color: 0xe1ff9e, transparent: true, opacity: 0.34 });
    crystal.add(new THREE.LineSegments(edges, edgeInk));
    scene.add(crystal);

    const orbitGeometry = new THREE.TorusGeometry(1.55, 0.009, 8, 96);
    const orbitMaterial = new THREE.MeshBasicMaterial({ color: 0xb2f481, transparent: true, opacity: 0.68 });
    const orbits = new THREE.Group();
    for (const [x, y] of [[1.1, 0.35], [0.7, -0.9], [-0.9, -0.45]]) {
      const ring = new THREE.Mesh(orbitGeometry, orbitMaterial);
      ring.rotation.set(x, y, 0);
      orbits.add(ring);
    }
    scene.add(orbits);

    const resize = new ResizeObserver(() => {
      const { clientWidth, clientHeight } = container;
      if (!clientWidth || !clientHeight) return;
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight);
    });
    resize.observe(container);

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    renderer.setAnimationLoop(time => {
      crystal.rotation.y = motion.matches ? 0 : time * 0.00022;
      crystal.rotation.x = 0.18;
      controls.update();
      renderer.render(scene, camera);
    });

    return () => {
      resize.disconnect();
      renderer.setAnimationLoop(null);
      controls.dispose();
      controlsRef.current = null;
      geometry.dispose();
      material.dispose();
      edges.dispose();
      edgeInk.dispose();
      orbitGeometry.dispose();
      orbitMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <figure className="scene" aria-label="Sidekick crystal">
      <div className="halo" aria-hidden="true" />
      {!available && <div className="orb" aria-hidden="true"><div className="core">✦</div></div>}
      <div className="viewport" ref={viewport} aria-hidden="true" />
      <div className="float code-float" aria-hidden="true">
        <div className="float-label"><i /><i /><i /><span>practice.py</span></div>
        <div className="float-code"><b>01</b> items = [<span>2, 4, 6</span>]<br /><b>02</b> <strong>for</strong> i <strong>in</strong> range(4):<br /><b>03</b> &nbsp; print(items[i])</div>
      </div>
      <div className="float hint-float" aria-hidden="true">
        <span className="mini-mark">✦</span><div><small>FIRST HINT</small><p>What happens on the last pass?</p></div>
      </div>
      <figcaption className="coordinates">FIG. 01 / {available ? 'DRAG TO ORBIT' : 'THE SIDEKICK'}</figcaption>
      {available && <button className="reset-view" type="button" onClick={() => controlsRef.current?.reset()}>Reset view</button>}
    </figure>
  );
}

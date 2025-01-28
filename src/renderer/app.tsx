import { useEffect, useRef } from 'react';
import './styles/window.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';

function App() {
  const isInitialized = useRef(false);

  useEffect(() => {
    if (!isInitialized.current) {
      initialize();
      isInitialized.current = true;
    }
  }, []);

  const initialize = () => {
    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 1, 3);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    document.getElementsByClassName('window-content')[0].appendChild(renderer.domElement);

    // Glass Bulb
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0,
      roughness: 0,
      transmission: 0.95, // Make it transparent
      thickness: 0.1,
      envMapIntensity: 1
    });
    const bulbGeometry = new THREE.SphereGeometry(0.5, 32, 32);
    const bulbMesh = new THREE.Mesh(bulbGeometry, glassMaterial);
    scene.add(bulbMesh);

    // Filament Path
    const filamentPoints = [];
    const turns = 5;
    const height = 0.3;
    const radius = 0.05;
    const segments = 50;

    // Create a coil-like path
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * turns * Math.PI * 2;
      const x = radius * Math.cos(angle);
      const y = (i / segments) * height - height / 2;
      const z = radius * Math.sin(angle);
      filamentPoints.push(new THREE.Vector3(x, y, z));
    }

    const filamentCurve = new THREE.CatmullRomCurve3(filamentPoints);

    // Filament Geometry and Material
    const filamentGeometry = new THREE.TubeGeometry(filamentCurve, 100, 0.01, 8, false);
    const filamentMaterial = new THREE.MeshStandardMaterial({
      color: 0xffa500, // Warm light color
      emissive: 0xffa500,
      emissiveIntensity: 5
    });
    const filamentMesh = new THREE.Mesh(filamentGeometry, filamentMaterial);
    scene.add(filamentMesh);

    // Light Source
    const pointLight = new THREE.PointLight(0xffa500, 2, 5);
    pointLight.position.set(0, 0, 0);
    scene.add(pointLight);

    // Position filament inside the bulb
    filamentMesh.position.set(0, 0, 0);
    bulbMesh.add(filamentMesh);

    // Environment Map (Optional for Reflections)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const hdrLoader = new RGBELoader();
    hdrLoader.load('path/to/hdri.hdr', (texture) => {
      const envMap = pmremGenerator.fromEquirectangular(texture).texture;
      scene.environment = envMap;
      glassMaterial.envMap = envMap;
    });

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Animation Loop
    function animate() {
      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }
    animate();
  };

  const initialize2 = () => {
    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.3, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    scene.fog = new THREE.Fog(0xd5f8f8, 100, 300);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementsByClassName('window-content')[0].appendChild(renderer.domElement);

    // Add a sample object
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    // Add controls
    const controls = new OrbitControls(camera, renderer.domElement);

    // Function to fit the camera to an object
    function fitCameraToObject(camera, object, offset = 1.25) {
      const box = new THREE.Box3().setFromObject(object);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);

      // Calculate the distance needed
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180); // Convert to radians
      let cameraDistance = maxDim / (2 * Math.tan(fov / 2));

      cameraDistance *= offset; // Apply the offset factor

      // Update camera position
      const direction = new THREE.Vector3(0, 0, 1); // Default forward direction
      camera.position.copy(center).add(direction.multiplyScalar(cameraDistance));

      // Ensure the camera looks at the object
      camera.lookAt(center);

      // Update controls (if using OrbitControls)
      controls.target.copy(center);
      controls.update();
    }

    // Fit the camera to the cube
    fitCameraToObject(camera, cube);

    // Animation loop
    function animate() {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }
    animate();
  };

  return (
    <div></div>
    // <div style={{ padding: '1rem', height: '2000px', userSelect: 'text' }}>
    //   Hello World!
    //   <br />
    //   <button onClick={() => document.documentElement.classList.toggle('light')}>Toggle Theme</button>
    // </div>
  );
}

export default App;

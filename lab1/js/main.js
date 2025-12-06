// js/main.js
import * as THREE from 'three';
import { OrbitControls } from './OrbitControls.js';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';

let scene, camera, renderer, controls;

init();
animate();

function init() {
    // --- 1. 场景初始化 ---
    const container = document.getElementById('canvas-container');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(2, 2, 4);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // --- 2. 灯光 ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(5, 10, 7);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // --- 3. 控制器 ---
    controls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = 2;
    controls.maxDistance = 10;

    // --- 4. CSG 核心逻辑 ---
    // 创建第一个物体：立方体 (Brush)
    const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    const material1 = new THREE.MeshStandardMaterial({ 
        color: 0xff5555,
        roughness: 0.1
    });
    const boxBrush = new Brush(boxGeometry, material1);
    boxBrush.updateMatrixWorld();

    // 创建第二个物体：球体 (Brush)
    const sphereGeometry = new THREE.SphereGeometry(0.65, 32, 32);
    const material2 = new THREE.MeshStandardMaterial({ 
        color: 0x5555ff,
        roughness: 0.1
    });
    const sphereBrush = new Brush(sphereGeometry, material2);
    sphereBrush.position.set(0.5, 0.5, 0.5);
    sphereBrush.updateMatrixWorld();

    // 执行运算
    const evaluator = new Evaluator();
    // 这里的 SUBTRACTION 就是“差集”（挖洞）
    const result = evaluator.evaluate(boxBrush, sphereBrush, SUBTRACTION);
    
    result.castShadow = true;
    result.receiveShadow = true;
    scene.add(result);

    // 添加线框辅助查看
    const wireframe = new THREE.WireframeGeometry(sphereGeometry);
    const line = new THREE.LineSegments(wireframe);
    line.material.depthTest = false;
    line.material.opacity = 0.25;
    line.material.transparent = true;
    line.position.copy(sphereBrush.position);
    scene.add(line);
    
    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
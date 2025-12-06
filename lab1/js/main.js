// 1. 导入依赖
// 这里的 'three' 和 'three-bvh-csg' 会自动匹配 index.html 里的 importmap
import * as THREE from 'three';
// 因为 OrbitControls 在同级目录，直接用相对路径
import { OrbitControls } from './OrbitControls.js';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';

// 全局变量
let scene, camera, renderer, controls;

init();
animate();

function init() {
    // --- A. 基础场景搭建 ---
    const container = document.getElementById('canvas-container');

    // 1. 创建场景
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222); // 深灰背景

    // 2. 创建相机
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(2, 2, 4); // 调整相机位置，方便观察

    // 3. 创建渲染器
    renderer = new THREE.WebGLRenderer({ antialias: true }); // 开启抗锯齿
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true; // 开启阴影，增加立体感
    container.appendChild(renderer.domElement);

    // 4. 添加光照（没有光，材质就是黑的）
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // 环境光
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5); // 平行光
    dirLight.position.set(5, 10, 7);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // 5. 添加控制器
    controls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = 2;
    controls.maxDistance = 10;

    // --- B. CSG 核心操作 (实验核心部分) ---
    [cite_start]// [cite: 183-186]

    // 1. 定义两个基础几何体：Brush (笔刷)
    // Brush 是 three-bvh-csg 专门用来进行布尔运算的特殊 Mesh
    
    // 主体：一个立方体
    const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    const material1 = new THREE.MeshStandardMaterial({ 
        color: 0xff5555, // 红色
        roughness: 0.1,
        metalness: 0.1
    });
    const boxBrush = new Brush(boxGeometry, material1);
    boxBrush.updateMatrixWorld(); // 必须更新矩阵，确保位置正确

    // 切割体：一个球体
    const sphereGeometry = new THREE.SphereGeometry(0.65, 32, 32);
    const material2 = new THREE.MeshStandardMaterial({ 
        color: 0x5555ff, // 蓝色
        roughness: 0.1,
        metalness: 0.1
    });
    const sphereBrush = new Brush(sphereGeometry, material2);
    // 让球体稍微偏移一点，这样切出来的口子好看
    sphereBrush.position.set(0.5, 0.5, 0.5); 
    sphereBrush.updateMatrixWorld();

    // 2. 执行布尔运算
    [cite_start]// [cite: 204-205] Evaluator 是执行运算的核心组件
    const evaluator = new Evaluator();
    
    // 3. 计算差集 (SUBTRACTION)： 立方体 - 球体
    // 如果要做并集改用 ADDITION，交集用 INTERSECTION
    const result = evaluator.evaluate(boxBrush, sphereBrush, SUBTRACTION);
    
    // 4. 优化结果
    result.castShadow = true;
    result.receiveShadow = true;

    // 5. 将运算结果添加到场景
    scene.add(result);

    // (可选) 为了对比，我们可以显示原本球体的线框，展示切掉的位置
    const wireframe = new THREE.WireframeGeometry(sphereGeometry);
    const line = new THREE.LineSegments(wireframe);
    line.material.depthTest = false;
    line.material.opacity = 0.25;
    line.material.transparent = true;
    line.position.copy(sphereBrush.position);
    scene.add(line);
    
    // 窗口大小变化监听
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
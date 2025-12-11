import * as THREE from './three.module.js';
import { OrbitControls } from './OrbitControls.js';
import { Brush, Evaluator, SUBTRACTION, ADDITION } from './three-bvh-csg.js';

let scene, camera, renderer, controls;
let bearingGroup;
let isRotating = true;
let currentStep = 4; 

// === 材质优化：更亮、更清晰 ===
const materialSteel = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,       // 纯白底色
    metalness: 0.5,        // [关键] 降低金属度，防止它反射黑色背景变黑
    roughness: 0.2,        // 保持光滑
    clearcoat: 1.0,        // 清漆层保留高级感
    clearcoatRoughness: 0.1,
    side: THREE.DoubleSide
});

const materialBalls = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,       // 滚珠也要更亮
    metalness: 0.6,        // 稍微比轴承本体更金属一点
    roughness: 0.1,
    clearcoat: 1.0
});

init();
animate();

function init() {
    const canvas = document.querySelector('#glCanvas');
    const container = canvas.parentElement;

    // 1. 场景
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1c1c1e);
    scene.fog = new THREE.Fog(0x1c1c1e, 10, 50);

    // 2. 相机
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(6, 6, 8); // 稍微拉近一点视角

    // 3. 渲染器
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // 使用 ToneMapping 增加对比度
    renderer.toneMapping = THREE.ACESFilmicToneMapping; 
    renderer.toneMappingExposure = 1.2; // [关键] 增加整体曝光度

    // === 4. 灯光系统升级 (3点布光 + 轮廓光) ===
    
    // A. 环境光 (整体提亮)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); 
    scene.add(ambientLight);

    // B. 主光源 (Key Light) - 暖白光，照亮主体
    const mainLight = new THREE.DirectionalLight(0xfff5e6, 1.5); // 强度提升
    mainLight.position.set(5, 10, 7);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.bias = -0.0001;
    scene.add(mainLight);

    // C. 轮廓光 (Rim Light) - 强烈的冷光，把物体从背景里“扣”出来
    const rimLight = new THREE.SpotLight(0x4455ff, 20.0); // [关键] 极大增强强度
    rimLight.position.set(-5, 5, -10); // 放在背面
    rimLight.lookAt(0, 0, 0);
    scene.add(rimLight);

    // D. [新增] 正面补光 (Fill Light) - 消除死黑
    const fillLight = new THREE.DirectionalLight(0xe0f7fa, 0.8);
    fillLight.position.set(0, 0, 10); // 正对着物体
    scene.add(fillLight);

    // 5. 地板
    const planeGeo = new THREE.PlaneGeometry(100, 100);
    const planeMat = new THREE.ShadowMaterial({ opacity: 0.2, color: 0x000000 });
    const plane = new THREE.Mesh(planeGeo, planeMat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -1.5;
    plane.receiveShadow = true;
    scene.add(plane);

    const grid = new THREE.GridHelper(30, 30, 0x555555, 0x333333); // 网格稍微亮一点点
    grid.position.y = -1.5;
    scene.add(grid);

    // 6. 控制器
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // 7. 生成模型
    createBearing();

    // 8. UI
    setupUI();

    window.addEventListener('resize', onWindowResize);
}

function createBearing() {
    if (bearingGroup) scene.remove(bearingGroup);
    bearingGroup = new THREE.Group();
    scene.add(bearingGroup);

    const evaluator = new Evaluator();

    const outerRadius = 3.0;
    const innerRadius = 1.5;
    const height = 1.5;
    const ballRadius = 0.55;
    const grooveRadius = 0.6;

    // 1. 外圈
    let brushOuterRaw = new Brush(new THREE.CylinderGeometry(outerRadius, outerRadius, height, 64), materialSteel);
    let brushOuterHole = new Brush(new THREE.CylinderGeometry(outerRadius - 0.5, outerRadius - 0.5, height + 0.1, 64), materialSteel);
    let outerRing = evaluator.evaluate(brushOuterRaw, brushOuterHole, SUBTRACTION);

    // 2. 内圈
    let brushInnerRaw = new Brush(new THREE.CylinderGeometry(innerRadius + 0.5, innerRadius + 0.5, height, 64), materialSteel);
    let brushInnerHole = new Brush(new THREE.CylinderGeometry(innerRadius, innerRadius, height + 0.1, 64), materialSteel);
    let innerRing = evaluator.evaluate(brushInnerRaw, brushInnerHole, SUBTRACTION);

    // 3. 切槽
    const grooveCutterGeo = new THREE.TorusGeometry((outerRadius + innerRadius) / 2, grooveRadius, 32, 100);
    const brushGrooveCutter = new Brush(grooveCutterGeo, materialSteel);
    brushGrooveCutter.rotation.x = Math.PI / 2;

    const outerRingFinal = evaluator.evaluate(outerRing, brushGrooveCutter, SUBTRACTION);
    outerRingFinal.castShadow = true;
    outerRingFinal.receiveShadow = true;

    const innerRingFinal = evaluator.evaluate(innerRing, brushGrooveCutter, SUBTRACTION);
    innerRingFinal.castShadow = true;
    innerRingFinal.receiveShadow = true;

    // 4. 滚珠
    const ballsGroup = new THREE.Group();
    const ballCount = 8;
    const ringRadius = (outerRadius + innerRadius) / 2;
    
    for (let i = 0; i < ballCount; i++) {
        const angle = (i / ballCount) * Math.PI * 2;
        const ball = new THREE.Mesh(new THREE.SphereGeometry(ballRadius, 32, 32), materialBalls);
        ball.position.set(Math.cos(angle) * ringRadius, 0, Math.sin(angle) * ringRadius);
        ball.castShadow = true;
        ball.receiveShadow = true;
        ballsGroup.add(ball);
    }

    updateSceneBasedOnStep(outerRing, innerRing, outerRingFinal, innerRingFinal, ballsGroup);
}

function updateSceneBasedOnStep(outerRaw, innerRaw, outerFinal, innerFinal, balls) {
    bearingGroup.clear();

    if (currentStep === 1) {
        const geo1 = new THREE.CylinderGeometry(3, 3, 1.5, 64);
        const mesh1 = new THREE.Mesh(geo1, materialSteel);
        mesh1.castShadow = true;
        bearingGroup.add(mesh1);
    } 
    else if (currentStep === 2) {
        outerRaw.material = materialSteel;
        innerRaw.material = materialSteel;
        bearingGroup.add(outerRaw);
        bearingGroup.add(innerRaw);
    }
    else if (currentStep === 3) {
        bearingGroup.add(outerFinal);
        bearingGroup.add(innerFinal);
    }
    else if (currentStep === 4) {
        bearingGroup.add(outerFinal);
        bearingGroup.add(innerFinal);
        bearingGroup.add(balls);
    }
}

function setupUI() {
    document.getElementById('btn-rotate').onclick = function() {
        isRotating = !isRotating;
        this.classList.toggle('active', isRotating);
        this.innerHTML = isRotating ? '<i class="fa-solid fa-pause"></i> Stop Rotate' : '<i class="fa-solid fa-arrows-rotate"></i> Auto Rotate';
    };

    let isWireframe = false;
    document.getElementById('btn-wireframe').onclick = function() {
        isWireframe = !isWireframe;
        materialSteel.wireframe = isWireframe;
        materialBalls.wireframe = isWireframe;
        this.classList.toggle('active', isWireframe);
    };

    const steps = [1, 2, 3, 4];
    steps.forEach(step => {
        document.getElementById(`step-${step}`).onclick = function() {
            currentStep = step;
            steps.forEach(s => document.getElementById(`step-${s}`).classList.remove('active'));
            this.classList.add('active');
            
            const texts = [
                "Raw Geometry",
                "Boolean Subtract (Bore)",
                "Boolean Subtract (Groove)",
                "Final Assembly"
            ];
            document.getElementById('status-text').textContent = texts[step-1];
            createBearing();
        };
    });
}

function onWindowResize() {
    const container = renderer.domElement.parentElement;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate() {
    requestAnimationFrame(animate);
    
    if (isRotating && bearingGroup) {
        bearingGroup.rotation.y += 0.005;
        // 增加一点点X轴摆动，让高光流动起来，更容易看清形状
        bearingGroup.rotation.x = Math.sin(Date.now() * 0.0005) * 0.2; 
    }
    
    controls.update();
    renderer.render(scene, camera);
}
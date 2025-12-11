import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION, ADDITION, INTERSECTION } from 'three-bvh-csg';
import ProjectData from './projectData.js';
import TransformManager from './transformManager.js';

export default class SceneManager {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.evaluator = new Evaluator();
        
        // === 材质升级：高雅的磨砂白 ===
        // 这种材质能完美展示阴影细节，且不会产生刺眼反光
        this.material = new THREE.MeshStandardMaterial({
            color: 0xffffff,      
            roughness: 0.5,       // 磨砂质感
            metalness: 0.1,
            flatShading: false,   
            side: THREE.DoubleSide
        });
        
        this.init();
    }
    
    init() {
        this.scene = new THREE.Scene();
        
        // === 背景：深空灰 (配合 UI) ===
        const bgColor = 0x1c1c1e; 
        this.scene.background = new THREE.Color(bgColor);
        // 雾效：让远处的网格柔和消失，消除边界感
        this.scene.fog = new THREE.Fog(bgColor, 15, 50);

        const parent = this.canvas.parentElement;
        this.camera = new THREE.PerspectiveCamera(45, parent.clientWidth / parent.clientHeight, 0.1, 1000);
        // 相机位置：稍微放低一点，营造产品摄影的透视感
        this.camera.position.set(6, 4, 8); 
        this.camera.lookAt(0, 0, 0);
        
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: this.canvas, 
            antialias: true, // 必须开启抗锯齿，消除边缘狗牙
            alpha: false
        });
        this.renderer.setSize(parent.clientWidth, parent.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 软阴影
        
        // === 灯光系统：消除摩尔纹的关键 ===
        
        // 1. 环境光
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.45));
        
        // 2. 主光源 (Key Light)
        const mainLight = new THREE.DirectionalLight(0xffffff, 1.0);
        mainLight.position.set(5, 10, 5);
        mainLight.castShadow = true;
        
        // --- 核心修复：消除表面脏纹 (Shadow Acne) ---
        mainLight.shadow.mapSize.width = 2048; 
        mainLight.shadow.mapSize.height = 2048;
        mainLight.shadow.bias = -0.0001;      // 关键参数：防止阴影自我遮挡
        mainLight.shadow.normalBias = 0.02;   // 关键参数：处理曲面阴影
        // ----------------------------------------
        
        this.scene.add(mainLight);

        // 3. 轮廓光 (Rim Light) - 勾勒物体边缘
        const rimLight = new THREE.DirectionalLight(0x4455ff, 0.4);
        rimLight.position.set(-5, 2, -5);
        this.scene.add(rimLight);
        
        // === 地面系统：解决“穿模”和“丑陋网格” ===
        
        // 1. 隐形地板 (Shadow Plane)
        // 这个平面是透明的，只用来接收阴影，位置下沉到 y=-0.5
        const planeGeo = new THREE.PlaneGeometry(100, 100);
        const planeMat = new THREE.ShadowMaterial({ 
            opacity: 0.15, // 淡淡的阴影
            color: 0x000000 
        });
        const plane = new THREE.Mesh(planeGeo, planeMat);
        plane.rotation.x = -Math.PI / 2;
        plane.position.y = -0.501; // 微微低于网格，防止闪烁
        plane.receiveShadow = true;
        this.scene.add(plane);
        
        // 2. 极简网格 (Infinite Grid Vibe)
        // 颜色调得非常淡，且下沉到 -0.5
        const gridHelper = new THREE.GridHelper(40, 40, 0x444444, 0x282828);
        gridHelper.position.y = -0.5;
        this.scene.add(gridHelper);
        
        this.modelGroup = new THREE.Group();
        this.scene.add(this.modelGroup);
        
        this.transformManager = new TransformManager(this.scene, this.camera, this.canvas);
        
        this.animate();
        window.addEventListener('resize', () => this.onWindowResize());
    }

    onWindowResize() {
        const parent = this.canvas.parentElement;
        if (parent) {
            this.camera.aspect = parent.clientWidth / parent.clientHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(parent.clientWidth, parent.clientHeight);
        }
    }

    evaluateCSGTree(node) {
        if (!node) return null;

        // 生成几何体
        if (node.type === 'primitive') {
            let geometry;
            if (node.geometry === 'box') {
                geometry = new THREE.BoxGeometry(node.params.width, node.params.height, node.params.depth);
            } else if (node.geometry === 'sphere') {
                // 高精度球体，看起来更圆润
                geometry = new THREE.SphereGeometry(node.params.radius, 64, 64);
            }
            
            const brush = new Brush(geometry, this.material);
            brush.castShadow = true; 
            brush.receiveShadow = true;
            
            const matrix = new THREE.Matrix4().fromArray(node.transform);
            brush.applyMatrix4(matrix);
            brush.updateMatrixWorld();
            return brush;
        } 
        else if (node.type === 'operation') {
            const brushA = this.evaluateCSGTree(node.left);
            const brushB = this.evaluateCSGTree(node.right);
            
            if (!brushA || !brushB) return null;

            let op;
            switch(node.op) {
                case 'UNION': op = ADDITION; break;
                case 'SUBTRACT': op = SUBTRACTION; break;
                case 'INTERSECT': op = INTERSECTION; break;
                default: op = ADDITION;
            }
            
            const resultBrush = this.evaluator.evaluate(brushA, brushB, op);
            resultBrush.material = this.material;
            resultBrush.castShadow = true;
            resultBrush.receiveShadow = true;
            
            const matrix = new THREE.Matrix4().fromArray(node.transform);
            resultBrush.applyMatrix4(matrix);
            resultBrush.updateMatrixWorld();
            return resultBrush;
        }
        return null;
    }
    
    rebuildScene() {
        this.modelGroup.clear();
        ProjectData.nodes.forEach(node => {
            if (node.isRoot) {
                const finalMesh = this.evaluateCSGTree(node);
                if (finalMesh) {
                    finalMesh.userData = { nodeId: node.id };
                    this.modelGroup.add(finalMesh);
                }
            }
        });
    }

    selectNodes(selectedNodes) {
        if (selectedNodes.length > 0) {
            const lastNode = selectedNodes[selectedNodes.length - 1];
            this.transformManager.attachToNode(lastNode);
        } else {
            this.transformManager.detach();
        }
        this.rebuildScene();
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        this.renderer.render(this.scene, this.camera);
    }
}
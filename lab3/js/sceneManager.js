// js/sceneManager.js
import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION, ADDITION, INTERSECTION } from 'three-bvh-csg';
// 路径修正：直接引用同级文件
import ProjectData from './projectData.js';
import TransformManager from './transformManager.js';

export default class SceneManager {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.evaluator = new Evaluator();
        
        this.material = new THREE.MeshStandardMaterial({
            color: 0x2196F3,      
            roughness: 0.4,
            metalness: 0.1,
            flatShading: true,    
            side: THREE.DoubleSide 
        });
        
        this.init();
    }
    
    init() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x222222);
        
        const parent = this.canvas.parentElement;
        const width = parent.clientWidth;
        const height = parent.clientHeight;
        
        this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        this.camera.position.set(5, 5, 5);
        this.camera.lookAt(0, 0, 0);
        
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.shadowMap.enabled = true;
        
        // 环境光
        const ambientLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6); 
        this.scene.add(ambientLight);
        
        // 主光源
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
        dirLight.position.set(10, 10, 10);
        this.scene.add(dirLight);

        // 背光
        const backLight = new THREE.DirectionalLight(0xffffff, 0.5);
        backLight.position.set(-10, -5, -10);
        this.scene.add(backLight);
        
        // 辅助工具
        const gridHelper = new THREE.GridHelper(20, 20);
        this.scene.add(gridHelper);
        
        const axesHelper = new THREE.AxesHelper(2);
        this.scene.add(axesHelper);

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

        if (node.type === 'primitive') {
            let geometry;
            if (node.geometry === 'box') {
                geometry = new THREE.BoxGeometry(node.params.width, node.params.height, node.params.depth);
            } else if (node.geometry === 'sphere') {
                geometry = new THREE.SphereGeometry(node.params.radius, 32, 32);
            }
            
            const brush = new Brush(geometry, this.material);
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
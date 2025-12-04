import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import ProjectData from '../data/projectData.js';

export default class TransformManager {
    constructor(scene, camera, canvas) {
        this.scene = scene;
        this.camera = camera;
        this.canvas = canvas;
        this.transformControls = null;
        this.ghostMesh = null;
        this.init();
    }
    
    init() {
        this.transformControls = new TransformControls(this.camera, this.canvas);
        this.scene.add(this.transformControls);
        
        // 监听拖拽状态改变
        this.transformControls.addEventListener('dragging-changed', (event) => {
            // 禁用轨道控制器（如果存在），防止拖拽物体时旋转相机
            this.camera.controls ? (this.camera.controls.enabled = !event.value) : null;
            
            // --- 新增：当拖拽结束 (event.value === false) 时保存历史 ---
            if (event.value === false) {
                console.log("拖拽结束，保存历史");
                if (window.app && window.app.uiManager) {
                    window.app.uiManager.saveHistoryState();
                }
            }
        });

        this.transformControls.addEventListener('change', () => {
             if (this.ghostMesh && this.currentNodeId) {
                 this.updateNodeTransform(this.currentNodeId, this.ghostMesh.matrix);
                 // 拖拽过程中实时重绘，但不保存历史（太频繁了）
                 if (window.app && window.app.sceneManager) {
                     window.app.sceneManager.rebuildScene();
                 }
             }
        });
    }
    
    attachToNode(node) {
        this.detach();
        this.currentNodeId = node.id;
        
        this.ghostMesh = this.createGhostMesh(node);
        if (this.ghostMesh) {
            this.transformControls.attach(this.ghostMesh);
        }
    }
    
    createGhostMesh(node) {
        let geometry;
        if (node.geometry === 'box') {
            geometry = new THREE.BoxGeometry(node.params.width, node.params.height, node.params.depth);
        } else if (node.geometry === 'sphere') {
            geometry = new THREE.SphereGeometry(node.params.radius, 16, 16);
        } else {
            geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        }
        
        const material = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            wireframe: true,
            depthTest: false,
            transparent: true,
            opacity: 0.5
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = 'GhostMesh';
        mesh.applyMatrix4(new THREE.Matrix4().fromArray(node.transform));
        
        this.scene.add(mesh);
        return mesh;
    }
    
    updateNodeTransform(nodeId, matrix) {
        const node = ProjectData.getNode(nodeId);
        if (node) {
            node.transform = matrix.toArray();
        }
    }
    
    detach() {
        this.transformControls.detach();
        if (this.ghostMesh) {
            this.scene.remove(this.ghostMesh);
            this.ghostMesh = null;
        }
        this.currentNodeId = null;
    }
}
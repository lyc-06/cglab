// js/transformManager.js
import * as THREE from './three.module.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
// 路径修正：直接引用同级文件
import ProjectData from './projectData.js';

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
        
        this.transformControls.addEventListener('dragging-changed', (event) => {
            this.camera.controls ? (this.camera.controls.enabled = !event.value) : null;
            
            // 拖拽结束保存历史
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
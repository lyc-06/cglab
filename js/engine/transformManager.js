// js/engine/transformManager.js
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
        
        // 拖拽时更新
        this.transformControls.addEventListener('change', () => {
             // 只有在拖拽中才触发重绘（优化性能）
             // 注意：TransformControls 的 change 事件在相机移动时也会触发，这里最好加个锁或者判断
        });
        
        this.transformControls.addEventListener('dragging-changed', (event) => {
            this.camera.controls ? (this.camera.controls.enabled = !event.value) : null;
            if (event.value === false) {
                 // 拖拽结束，保存快照 (TODO: History Stack)
            }
        });

        // 监听 objectChange 来实时更新数据
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
        
        // 创建代理体 (Ghost)
        this.ghostMesh = this.createGhostMesh(node);
        if (this.ghostMesh) {
            this.transformControls.attach(this.ghostMesh);
        }
    }
    
    createGhostMesh(node) {
        // 只为 Primitive 节点或 Operation 节点本身创建 Transform 代理
        // 这里简化：任何选中的节点都显示一个 Box 框或者实际几何的线框
        let geometry;
        if (node.geometry === 'box') {
            geometry = new THREE.BoxGeometry(node.params.width, node.params.height, node.params.depth);
        } else if (node.geometry === 'sphere') {
            geometry = new THREE.SphereGeometry(node.params.radius, 16, 16);
        } else {
            // 如果是 Operation Node，我们暂且用一个小方块代表它的中心点，或者不显示几何只显示坐标轴
            // 为了实验效果，我们创建一个 0.5 的辅助方块
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
        mesh.name = 'GhostMesh'; // 标记一下，防止被清理
        
        // 应用矩阵
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
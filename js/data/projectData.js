// js/data/projectData.js
import * as THREE from 'three';

const ProjectData = {
    rootNode: null,
    nodes: new Map(),
    selectedNodeIds: new Set(), // 支持多选
    nextNodeId: 1,

    init: function() {
        this.nodes.clear();
        this.selectedNodeIds.clear();
        this.rootNode = null;
        this.nextNodeId = 1;
        console.log("ProjectData initialized");
    },

    generateNodeId: function() {
        return `node_${this.nextNodeId++}`;
    },

    // 注册节点
    registerNode: function(node) {
        this.nodes.set(node.id, node);
        return node;
    },

    // 添加基元
    addPrimitive: function(type) {
        const nodeId = this.generateNodeId();
        const node = {
            id: nodeId,
            type: 'primitive',
            geometry: type,
            params: type === 'box' ? { width: 1, height: 1, depth: 1 } : { radius: 0.5 },
            transform: new THREE.Matrix4().toArray(),
            name: type === 'box' ? `立方体_${this.nextNodeId-1}` : `球体_${this.nextNodeId-1}`,
            isRoot: true
        };
        
        this.registerNode(node);
        return node;
    },

    addBox: function() { return this.addPrimitive('box'); },
    addSphere: function() { return this.addPrimitive('sphere'); },

    // 布尔运算逻辑
    applyOperation: function(nodeIdA, nodeIdB, opType) {
        const nodeA = this.nodes.get(nodeIdA);
        const nodeB = this.nodes.get(nodeIdB);
        
        if (!nodeA || !nodeB) return null;

        const newNodeId = this.generateNodeId();
        const opNode = {
            id: newNodeId,
            type: 'operation',
            op: opType, // 'UNION', 'SUBTRACT', 'INTERSECT'
            left: nodeA,
            right: nodeB,
            transform: new THREE.Matrix4().toArray(),
            name: `${opType}_${this.nextNodeId-1}`,
            isRoot: true
        };

        // 原有节点不再是根节点
        nodeA.isRoot = false;
        nodeB.isRoot = false;

        this.registerNode(opNode);
        return opNode;
    },

    getNode: function(nodeId) {
        return this.nodes.get(nodeId);
    },

    // --- 关键修复：补上了这个缺失的函数 ---
    selectNode: function(nodeId) {
        this.selectedNodeIds.add(nodeId);
        return this.getNode(nodeId);
    },

    // 切换选中状态
    toggleSelection: function(nodeId) {
        if (this.selectedNodeIds.has(nodeId)) {
            this.selectedNodeIds.delete(nodeId);
        } else {
            // 限制最多选两个
            if (this.selectedNodeIds.size >= 2) {
                const first = this.selectedNodeIds.values().next().value;
                this.selectedNodeIds.delete(first);
            }
            this.selectedNodeIds.add(nodeId);
        }
        return this.getNode(nodeId);
    },

    getSelectedNodes: function() {
        return Array.from(this.selectedNodeIds).map(id => this.nodes.get(id));
    },

    // 导出
    toJSON: function() {
        const rootNodes = [];
        this.nodes.forEach(node => {
            if (node.isRoot) rootNodes.push(node);
        });
        return JSON.stringify(rootNodes, null, 2);
    },

    // 导入
    loadJSON: function(jsonStr) {
        try {
            const data = JSON.parse(jsonStr);
            this.init();
            
            const registerRecursive = (node) => {
                this.nodes.set(node.id, node);
                const numId = parseInt(node.id.split('_')[1]);
                if (numId >= this.nextNodeId) this.nextNodeId = numId + 1;

                if (node.type === 'operation') {
                    registerRecursive(node.left);
                    registerRecursive(node.right);
                }
            };

            data.forEach(rootNode => {
                rootNode.isRoot = true;
                registerRecursive(rootNode);
            });
            
            return true;
        } catch (e) {
            console.error("加载JSON失败", e);
            return false;
        }
    }
};

export default ProjectData;
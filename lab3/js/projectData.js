// js/projectData.js
import * as THREE from './three.module.js';

const ProjectData = {
    rootNode: null,
    nodes: new Map(),
    selectedNodeIds: new Set(),
    nextNodeId: 1,
    
    // 历史记录栈
    historyStack: [],
    currentStateIndex: -1,

    init: function() {
        this.nodes.clear();
        this.selectedNodeIds.clear();
        this.rootNode = null;
        this.nextNodeId = 1;
    },

    saveState: function() {
        const json = this.toJSON();
        
        if (this.currentStateIndex < this.historyStack.length - 1) {
            this.historyStack = this.historyStack.slice(0, this.currentStateIndex + 1);
        }
        
        this.historyStack.push(json);
        this.currentStateIndex++;
        
        console.log(`状态已保存，当前步骤: ${this.currentStateIndex}`);
        return this.currentStateIndex;
    },

    restoreState: function(index) {
        if (index < 0 || index >= this.historyStack.length) return false;
        
        const json = this.historyStack[index];
        this.loadJSON(json, false); 
        this.currentStateIndex = index;
        return true;
    },

    generateNodeId: function() {
        return `node_${this.nextNodeId++}`;
    },

    registerNode: function(node) {
        this.nodes.set(node.id, node);
        return node;
    },

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

    applyOperation: function(nodeIdA, nodeIdB, opType) {
        const nodeA = this.nodes.get(nodeIdA);
        const nodeB = this.nodes.get(nodeIdB);
        if (!nodeA || !nodeB) return null;

        const newNodeId = this.generateNodeId();
        const opNode = {
            id: newNodeId,
            type: 'operation',
            op: opType,
            left: nodeA,
            right: nodeB,
            transform: new THREE.Matrix4().toArray(),
            name: `${opType}_${this.nextNodeId-1}`,
            isRoot: true
        };

        nodeA.isRoot = false;
        nodeB.isRoot = false;

        this.registerNode(opNode);
        return opNode;
    },

    getNode: function(nodeId) {
        return this.nodes.get(nodeId);
    },

    selectNode: function(nodeId) {
        this.selectedNodeIds.add(nodeId);
        return this.getNode(nodeId);
    },

    toggleSelection: function(nodeId) {
        if (this.selectedNodeIds.has(nodeId)) {
            this.selectedNodeIds.delete(nodeId);
        } else {
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

    toJSON: function() {
        const rootNodes = [];
        this.nodes.forEach(node => {
            if (node.isRoot) rootNodes.push(node);
        });
        return JSON.stringify(rootNodes, null, 2);
    },

    loadJSON: function(jsonStr, clearHistory = true) {
        try {
            const data = JSON.parse(jsonStr);
            this.init(); 
            
            if (clearHistory) {
                this.historyStack = [];
                this.currentStateIndex = -1;
            }

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
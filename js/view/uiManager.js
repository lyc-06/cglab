// js/view/uiManager.js
import ProjectData from '../data/projectData.js';

export default class UIManager {
    constructor() {
        this.init();
    }
    
    init() {
        this.updateTreeView();
        this.bindEvents();
    }
    
    bindEvents() {
        document.getElementById('addBoxBtn').onclick = () => this.addPrimitive('box');
        document.getElementById('addSphereBtn').onclick = () => this.addPrimitive('sphere');
        
        document.getElementById('unionBtn').onclick = () => this.doBoolean('UNION');
        document.getElementById('subtractBtn').onclick = () => this.doBoolean('SUBTRACT');
        document.getElementById('intersectBtn').onclick = () => this.doBoolean('INTERSECT');
        
        // 文件操作
        document.getElementById('exportBtn').onclick = () => this.exportJSON();
        document.getElementById('importBtn').onclick = () => document.getElementById('fileInput').click();
        document.getElementById('fileInput').onchange = (e) => this.importJSON(e);
    }
    
    addPrimitive(type) {
        const node = type === 'box' ? ProjectData.addBox() : ProjectData.addSphere();
        this.refreshAll();
    }
    
    doBoolean(opType) {
        const selected = ProjectData.getSelectedNodes();
        if (selected.length !== 2) {
            alert("请先在树状图中选中两个节点！");
            return;
        }
        
        const opNode = ProjectData.applyOperation(selected[0].id, selected[1].id, opType);
        if (opNode) {
            // 清空选择
            ProjectData.selectedNodeIds.clear();
            ProjectData.selectNode(opNode.id); // 只是为了高亮新节点
            this.refreshAll();
        }
    }
    
    refreshAll() {
        this.updateTreeView();
        if (window.app && window.app.sceneManager) {
            window.app.sceneManager.rebuildScene();
        }
    }
    
    updateTreeView() {
        const container = document.getElementById('csgTreeView');
        container.innerHTML = '';
        
        // 递归渲染树的函数
        const renderNode = (node, level) => {
            const div = document.createElement('div');
            div.className = 'tree-node';
            div.style.marginLeft = (level * 20) + 'px';
            
            // 选中样式
            if (ProjectData.selectedNodeIds.has(node.id)) {
                div.classList.add('selected');
            }
            
            let icon = node.type === 'primitive' ? (node.geometry === 'box' ? '⬜' : '⭕') : '🔧';
            div.innerHTML = `${icon} ${node.name || node.id}`;
            
            div.onclick = (e) => {
                e.stopPropagation(); // 防止冒泡
                const lastSelected = ProjectData.toggleSelection(node.id);
                
                // 更新UI
                this.updateTreeView();
                
                // 通知 SceneManager
                if (window.app.sceneManager) {
                    window.app.sceneManager.selectNodes(ProjectData.getSelectedNodes());
                }
                
                document.getElementById('statusInfo').textContent = 
                    `选中: ${ProjectData.getSelectedNodes().map(n=>n.name).join(', ')}`;
            };
            
            container.appendChild(div);
            
            // 如果是操作节点，递归渲染子节点
            if (node.type === 'operation') {
                renderNode(node.left, level + 1);
                renderNode(node.right, level + 1);
            }
        };

        // 只有 isRoot 的节点才作为顶层显示
        ProjectData.nodes.forEach(node => {
            if (node.isRoot) {
                renderNode(node, 0);
            }
        });
    }

    // 导出
    exportJSON() {
        const json = ProjectData.toJSON();
        const blob = new Blob([json], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "csg_project.json";
        a.click();
    }

    // 导入
    importJSON(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const success = ProjectData.loadJSON(e.target.result);
            if (success) {
                this.refreshAll();
                alert("加载成功！");
            }
        };
        reader.readAsText(file);
    }
}
// js/CommandParser.js
import * as THREE from './three.module.js';
import ProjectData from './projectData.js';

export default class CommandParser {
    constructor() {
        this.commands = {
            'add': 'CREATE',
            'create': 'CREATE',
            'subtract': 'SUBTRACT',
            'cut': 'SUBTRACT',      // 支持自然语言 "cut"
            'union': 'UNION',
            'join': 'UNION',
            'intersect': 'INTERSECT'
        };
    }

    parse(input) {
        // 1. 健壮性处理：转小写，去掉首尾空格，用正则表达式分割（处理多个连续空格）
        const tokens = input.trim().toLowerCase().split(/\s+/);
        
        if (tokens.length === 0 || !tokens[0]) return { success: false, msg: "请输入指令" };

        const action = tokens[0];
        
        // 2. 意图识别
        if (this.commands[action]) {
            return this.executeCommand(this.commands[action], tokens.slice(1));
        } else {
            return { success: false, msg: `无法识别指令: "${action}"` };
        }
    }

    executeCommand(opType, params) {
        // 3. 实体提取：解析 shape, radius, at 等参数
        const data = this.extractParameters(params);
        if (!data.shape) return { success: false, msg: "未指定形状 (box 或 sphere)" };

        // 步骤 A: 创建新几何体
        let newNode;
        if (data.shape === 'box') {
            newNode = ProjectData.addBox();
            // 如果有 size 参数，更新 params (这里简化处理，box默认size在addBox里定死了，作为演示先不动)
        } else if (data.shape === 'sphere') {
            newNode = ProjectData.addSphere();
            // 如果解析到了 radius，更新它
            if (data.radius !== null) {
                newNode.params.radius = data.radius;
            }
        }

        // 步骤 B: 处理位置变换 (at x y z)
        if (data.position) {
            const mat = new THREE.Matrix4().makeTranslation(
                data.position.x, data.position.y, data.position.z
            );
            newNode.transform = mat.toArray();
        }

        // 步骤 C: 根据操作类型决定下一步
        let msg = `已创建 ${data.shape}`;
        
        if (opType !== 'CREATE') {
            // 如果是布尔运算（subtract/union等），需要找一个"目标"来操作
            // 我们默认选取上一个生成的根节点作为操作对象
            const roots = [];
            ProjectData.nodes.forEach(n => { if (n.isRoot && n.id !== newNode.id) roots.push(n); });
            
            if (roots.length > 0) {
                const targetNode = roots[roots.length - 1]; // 取最后一个
                const resultNode = ProjectData.applyOperation(targetNode.id, newNode.id, opType);
                msg += ` 并与 ${targetNode.name} 进行了 ${opType} 运算`;
            } else {
                msg += ` (但在场景中没找到可以进行 ${opType} 的对象)`;
            }
        }

        // 4. 触发更新
        ProjectData.saveState();
        return { success: true, msg: msg };
    }

    // --- 核心：参数提取器 ---
    extractParameters(tokens) {
        const result = {
            shape: null,
            radius: null,
            position: null
        };

        for (let i = 0; i < tokens.length; i++) {
            const t = tokens[i];

            // 识别形状
            if (t === 'box' || t === 'cube') result.shape = 'box';
            if (t === 'sphere' || t === 'ball') result.shape = 'sphere';

            // 识别 radius
            if (t === 'radius' && tokens[i+1]) {
                result.radius = parseFloat(tokens[i+1]);
            }

            // 识别 at (位置)
            if (t === 'at' && tokens[i+1] && tokens[i+2] && tokens[i+3]) {
                result.position = {
                    x: parseFloat(tokens[i+1]),
                    y: parseFloat(tokens[i+2]),
                    z: parseFloat(tokens[i+3])
                };
            }
        }
        return result;
    }
}
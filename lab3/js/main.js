// js/main.js
import SceneManager from './sceneManager.js';
import UIManager from './uiManager.js';
import CommandParser from './CommandParser.js'; // 引入我们的新模块

class App {
    constructor() {
        this.sceneManager = null;
        this.uiManager = null;
        this.parser = new CommandParser(); // 初始化解析器
        window.app = this;
        this.init();
    }
    
    init() {
        this.sceneManager = new SceneManager('threeCanvas');
        this.uiManager = new UIManager();

        // 绑定输入框回车事件
        const input = document.getElementById('commandInput');
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.handleCommand(input.value);
                    input.value = ''; // 清空输入框
                }
            });
        }
    }

    handleCommand(text) {
        const result = this.parser.parse(text);
        
        // 显示结果反馈
        const feedback = document.getElementById('statusInfo');
        if (feedback) {
            feedback.textContent = result.success ? `✅ ${result.msg}` : `❌ ${result.msg}`;
            feedback.style.color = result.success ? '#4CAF50' : '#ff5555';
        }

        // 如果成功，刷新场景
        if (result.success) {
            this.uiManager.refreshAll(false);
        }
    }
}

new App();
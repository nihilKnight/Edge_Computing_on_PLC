/**
 * OPC UA PLC 动态控制前端应用
 * 处理用户交互和WebSocket通信
 */

class PLCApp {
    constructor() {
        this.socket = null;
        this.currentPLC = null;
        this.plcList = [];
        this.variables = {};

        // 环境监测状态
        this.env = {
            sensors: {
                temp: {
                    nodeMap: { value: null, mean: null, variance: null, stdDev: null, zScore: null, alarm: null, freq: null, ampl: null, offset: null },
                    lineChart: null,
                    sineChart: null,
                    lineData: [], // {time, value}
                    maxDataPoints: 150
                },
                hum: {
                    nodeMap: { value: null, mean: null, variance: null, stdDev: null, zScore: null, alarm: null, freq: null, ampl: null, offset: null },
                    lineChart: null,
                    sineChart: null,
                    lineData: [],
                    maxDataPoints: 150
                },
                press: {
                    nodeMap: { value: null, mean: null, variance: null, stdDev: null, zScore: null, alarm: null, freq: null, ampl: null, offset: null },
                    lineChart: null,
                    sineChart: null,
                    lineData: [],
                    maxDataPoints: 150
                }
            },
            scale: 100
        };

        this.initSocket();
        this.initEventListeners();
        this.initModals();
    }

    // 初始化Socket连接
    initSocket() {
        this.socket = io();

        // 连接成功
        this.socket.on('connect', () => {
            console.log('已连接到服务器');
            this.updateGlobalStatus('已连接', 'success');
        });

        // 连接断开
        this.socket.on('disconnect', () => {
            console.log('与服务器断开连接');
            this.updateGlobalStatus('连接断开', 'error');
        });

        // 接收PLC列表
        this.socket.on('plcList', (plcList) => {
            this.plcList = plcList;
            this.renderPLCList();
        });

        // PLC创建结果
        this.socket.on('createPLCResult', (result) => {
            if (result.success) {
                this.showMessage('PLC配置创建成功', 'success');
                this.closeModal('addPlcModal');
                this.resetForm('addPlcForm');
            } else {
                this.showMessage(`创建失败: ${result.message}`, 'error');
            }
        });

        // PLC连接结果
        this.socket.on('connectPLCResult', (result) => {
            if (result.success) {
                this.showMessage(`${this.getPLCName(result.plcId)} 连接成功`, 'success');
                this.updatePLCStatus(result.plcId, true);
                // 自动浏览并加载变量列表
                if (this.currentPLC === result.plcId) {
                    this.browsePLCVariables(result.plcId);
                }
            } else {
                this.showMessage(`连接失败: ${result.message}`, 'error');
                this.updatePLCStatus(result.plcId, false);
            }
        });

        // PLC断开结果
        this.socket.on('disconnectPLCResult', (result) => {
            if (result.success) {
                this.showMessage(`${this.getPLCName(result.plcId)} 已断开连接`, 'info');
                this.updatePLCStatus(result.plcId, false);
            } else {
                this.showMessage(`断开失败: ${result.message}`, 'error');
            }
        });

        // PLC删除结果
        this.socket.on('deletePLCResult', (result) => {
            if (result.success) {
                this.showMessage('PLC配置已删除', 'info');
                if (this.currentPLC === result.plcId) {
                    this.currentPLC = null;
                    this.showWelcomePanel();
                }
            } else {
                this.showMessage(`删除失败: ${result.message}`, 'error');
            }
        });

        // PLC连接状态更新
        this.socket.on('plcConnectionStatus', (data) => {
            this.updatePLCStatus(data.plcId, data.connected);
        });

        // 浏览变量结果
        this.socket.on('browsePLCVariablesResult', (result) => {
            if (result.success) {
                this.variables[result.plcId] = result.variables;
                this.renderVariables();
                // 识别环境变量节点，并用首次值刷新环境卡片
                if (result.plcId === this.currentPLC) {
                    this.detectEnvNodes(result.variables);
                    this.updateEnvFromArray(result.variables);
                }
            } else {
                this.showMessage(`浏览变量失败: ${result.message}`, 'error');
            }
        });

        // 变量读取结果
        this.socket.on('readVariableResult', (result) => {
            if (result.success) {
                this.updateVariableValue(result.nodeId, result.value, result.dataType);
            }
        });

        // 变量写入结果
        this.socket.on('writeVariableResult', (result) => {
            if (result.success) {
                this.showMessage('变量写入成功', 'success');
                // 立即读取并更新这个变量的值
                this.refreshSingleVariable(result.plcId, result.nodeId);
            } else {
                this.showMessage(`写入失败: ${result.message}`, 'error');
            }
        });

        // 变量更新
        this.socket.on('variablesUpdate', (data) => {
            if (data.plcId === this.currentPLC) {
                this.updateVariablesDisplay(data.variables);
                this.updateEnvFromMap(data.variables);
            }
        });
    }

    // 初始化事件监听
    initEventListeners() {
        // 添加PLC按钮
        document.getElementById('addPlcBtn').addEventListener('click', () => {
            this.showModal('addPlcModal');
        });

        // 添加预定义变量按钮
        document.getElementById('addPredefinedVariableBtn').addEventListener('click', () => {
            this.addPredefinedVariableInput();
        });

        // 添加PLC表单提交
        document.getElementById('addPlcForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createPLC();
        });

        // 刷新变量按钮
        document.getElementById('refreshVariablesBtn').addEventListener('click', () => {
            if (this.currentPLC) {
                this.browsePLCVariables(this.currentPLC);
            }
        });

        // 添加变量按钮
        document.getElementById('addVariableBtn').addEventListener('click', () => {
            this.showModal('addVariableModal');
        });

        // 添加变量表单提交
        document.getElementById('addVariableForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addVariable();
        });
    }

    // 初始化模态框
    initModals() {
        // 关闭模态框事件
        document.querySelectorAll('.modal-close, .btn[id*="cancel"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    this.closeModal(modal.id);
                }
            });
        });

        // 点击外部关闭模态框
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });
    }

    // 渲染PLC列表
    renderPLCList() {
        const plcListContainer = document.getElementById('plcList');

        if (this.plcList.length === 0) {
            plcListContainer.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #64748b;">
                    <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                    <p>暂无PLC连接</p>
                    <p style="font-size: 0.9rem;">点击上方按钮添加</p>
                </div>
            `;
            return;
        }

        plcListContainer.innerHTML = this.plcList.map(plc => `
            <div class="plc-item ${plc.id === this.currentPLC ? 'active' : ''}" 
                 data-plc-id="${plc.id}" onclick="app.selectPLC('${plc.id}')">
                <div class="plc-item-header">
                    <div class="plc-name">${plc.name}</div>
                    <div class="plc-status ${plc.isConnected ? 'connected' : 'disconnected'}">
                        ${plc.isConnected ? '已连接' : '未连接'}
                    </div>
                </div>
                <div class="plc-endpoint">${plc.endpoint}</div>
                <div class="plc-variables-count">变量数量: ${plc.variableCount}</div>
                <div class="plc-controls">
                    <button class="btn btn-small ${plc.isConnected ? 'btn-secondary' : 'btn-success'}" 
                            onclick="event.stopPropagation(); app.${plc.isConnected ? 'disconnectPLC' : 'connectPLC'}('${plc.id}')">
                        <i class="fas fa-${plc.isConnected ? 'unlink' : 'plug'}"></i>
                        ${plc.isConnected ? '断开' : '连接'}
                    </button>
                    <button class="btn btn-small btn-danger" 
                            onclick="event.stopPropagation(); app.deletePLC('${plc.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    // 选择PLC
    selectPLC(plcId) {
        this.currentPLC = plcId;
        this.renderPLCList(); // 重新渲染以更新选中状态
        this.showPLCControlPanel();
        this.browsePLCVariables(plcId);
    }

    // 显示PLC控制面板
    showPLCControlPanel() {
        const plc = this.plcList.find(p => p.id === this.currentPLC);
        if (!plc) return;

        document.getElementById('welcomePanel').style.display = 'none';
        document.getElementById('plcControlPanel').style.display = 'block';

        // 更新PLC头部信息
        document.getElementById('plcHeader').innerHTML = `
            <div class="plc-info">
                <h2><i class="fas fa-microchip"></i> ${plc.name}</h2>
                <div class="plc-endpoint-info">${plc.endpoint}</div>
            </div>
            <div class="plc-header-controls">
                <button class="btn ${plc.isConnected ? 'btn-secondary' : 'btn-success'}" 
                        onclick="app.${plc.isConnected ? 'disconnectPLC' : 'connectPLC'}('${plc.id}')">
                    <i class="fas fa-${plc.isConnected ? 'unlink' : 'plug'}"></i>
                    ${plc.isConnected ? '断开连接' : '连接PLC'}
                </button>
            </div>
        `;

        // 初始化环境图表
        this.ensureEnvReady();
    }

    // 显示欢迎页面
    showWelcomePanel() {
        document.getElementById('welcomePanel').style.display = 'block';
        document.getElementById('plcControlPanel').style.display = 'none';
    }

    // 创建PLC
    createPLC() {
        const formData = new FormData(document.getElementById('addPlcForm'));

        const config = {
            name: formData.get('name'),
            endpoint: formData.get('endpoint'),
            namespace: formData.get('namespace') || null,
            namespaceIndex: parseInt(formData.get('namespaceIndex')) || 1,
            variables: this.getPredefinedVariables()
        };

        this.socket.emit('createPLC', config);
    }

    // 获取预定义变量
    getPredefinedVariables() {
        const variables = [];
        document.querySelectorAll('.predefined-variable-item').forEach(item => {
            const name = item.querySelector('input[placeholder*="名称"]').value;
            const nodeId = item.querySelector('input[placeholder*="节点ID"]').value;
            const description = item.querySelector('input[placeholder*="描述"]').value;

            if (name && nodeId) {
                variables.push({ name, nodeId, description });
            }
        });
        return variables;
    }

    // 添加预定义变量输入
    addPredefinedVariableInput() {
        const container = document.getElementById('predefinedVariables');
        const item = document.createElement('div');
        item.className = 'predefined-variable-item';
        item.innerHTML = `
            <input type="text" placeholder="变量名称" style="flex: 1;">
            <input type="text" placeholder="节点ID" style="flex: 2;">
            <input type="text" placeholder="描述" style="flex: 1;">
            <button type="button" class="btn btn-danger btn-small" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        container.appendChild(item);
    }

    // 连接PLC
    connectPLC(plcId) {
        this.socket.emit('connectPLC', plcId);
    }

    // 断开PLC
    disconnectPLC(plcId) {
        this.socket.emit('disconnectPLC', plcId);
    }

    // 删除PLC
    deletePLC(plcId) {
        if (confirm('确定要删除这个PLC配置吗？')) {
            this.socket.emit('deletePLC', plcId);
        }
    }

    // 浏览PLC变量
    browsePLCVariables(plcId) {
        this.socket.emit('browsePLCVariables', plcId);
    }

    // 渲染变量
    renderVariables() {
        const container = document.getElementById('variablesContainer');
        const variables = this.variables[this.currentPLC] || [];

        if (variables.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: #64748b;">
                    <i class="fas fa-code" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                    <p>暂无变量</p>
                    <p style="font-size: 0.9rem;">连接PLC后自动加载，或手动添加变量</p>
                </div>
            `;
            return;
        }

        container.innerHTML = variables.map(variable => {
            const dataType = this.getDataTypeCategory(variable.dataType);
            return `
                 <div class="variable-item" data-node-id="${variable.nodeId}">
                     <div class="variable-header">
                         <div class="variable-name">${variable.name}</div>
                         <div class="variable-type ${dataType}">${variable.dataType}</div>
                     </div>
                     <div class="variable-node-id">${variable.nodeId}</div>
                     ${variable.browsePath ? `<div class="variable-browse-path">路径: ${variable.browsePath}</div>` : ''}
                     <div class="variable-value">
                         <div class="variable-current-value" id="value-${this.escapeNodeId(variable.nodeId)}">
                             ${variable.value !== null ? variable.value : '未知'}
                         </div>
                     </div>
                     <div class="variable-controls">
                         ${this.renderVariableControls(variable)}
                     </div>
                     ${variable.description ? `<div style="font-size: 0.8rem; color: #64748b; margin-top: 0.5rem;">${variable.description}</div>` : ''}
                     ${variable.error ? `<div style="font-size: 0.8rem; color: #ef4444; margin-top: 0.5rem;">错误: ${variable.error}</div>` : ''}
                 </div>
             `;
        }).join('');
    }

    // 渲染变量控制
    renderVariableControls(variable) {
        const dataType = variable.dataType;
        const nodeId = variable.nodeId;
        const escapedNodeId = this.escapeNodeId(nodeId);

        if (dataType === 'Boolean') {
            return `
                <div class="toggle-btn ${variable.value ? 'active' : ''}" 
                     onclick="app.toggleBooleanVariable('${nodeId}')">
                </div>
            `;
        } else if (['Int16', 'Int32', 'UInt16', 'UInt32', 'Float', 'Double', 'String'].includes(dataType)) {
            return `
                <div class="input-group">
                    <input type="${dataType === 'String' ? 'text' : 'number'}" 
                           id="input-${escapedNodeId}" 
                           placeholder="输入新值">
                    <button class="btn btn-primary btn-small" 
                            onclick="app.writeVariable('${nodeId}', '${dataType}')">
                        <i class="fas fa-check"></i> 写入
                    </button>
                </div>
            `;
        } else {
            return `<span style="color: #64748b; font-size: 0.8rem;">只读</span>`;
        }
    }

    // 切换布尔变量
    toggleBooleanVariable(nodeId) {
        const currentValue = this.getCurrentVariableValue(nodeId);
        const newValue = !currentValue;

        // 立即更新界面显示（乐观更新）
        this.updateVariableValue(nodeId, newValue, 'Boolean');

        this.socket.emit('writeVariable', {
            plcId: this.currentPLC,
            nodeId: nodeId,
            value: newValue,
            dataType: 'Boolean'
        });
    }

    // 写入变量
    writeVariable(nodeId, dataType) {
        const inputId = `input-${this.escapeNodeId(nodeId)}`;
        const input = document.getElementById(inputId);
        const value = input.value;

        if (!value && value !== 0) {
            this.showMessage('请输入值', 'warning');
            return;
        }

        // 显示写入状态
        const btn = input.nextElementSibling;
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 写入中...';
        btn.disabled = true;

        this.socket.emit('writeVariable', {
            plcId: this.currentPLC,
            nodeId: nodeId,
            value: value,
            dataType: dataType
        });

        // 恢复按钮状态
        setTimeout(() => {
            if (btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        }, 2000);

        input.value = ''; // 清空输入框
    }

    // 添加变量
    addVariable() {
        const formData = new FormData(document.getElementById('addVariableForm'));

        const variable = {
            name: formData.get('name'),
            nodeId: formData.get('nodeId'),
            description: formData.get('description') || ''
        };

        // 这里可以添加到当前PLC的变量列表中
        this.showMessage('变量添加功能待实现', 'info');
        this.closeModal('addVariableModal');
    }

    // 更新变量值
    updateVariableValue(nodeId, value, dataType) {
        const valueElement = document.getElementById(`value-${this.escapeNodeId(nodeId)}`);
        if (valueElement) {
            // 添加更新动画效果
            valueElement.style.backgroundColor = '#d1fae5';
            valueElement.textContent = value;

            // 0.5秒后恢复原始背景色
            setTimeout(() => {
                valueElement.style.backgroundColor = '';
            }, 500);
        }

        // 更新布尔变量的切换按钮
        if (dataType === 'Boolean') {
            const variableItem = document.querySelector(`[data-node-id="${nodeId}"]`);
            const toggleBtn = variableItem?.querySelector('.toggle-btn');
            if (toggleBtn) {
                toggleBtn.classList.toggle('active', value);

                // 添加切换动画效果
                toggleBtn.style.transform = 'scale(1.1)';
                setTimeout(() => {
                    toggleBtn.style.transform = '';
                }, 200);
            }
        }

        // 更新内存中的变量值
        if (this.variables[this.currentPLC]) {
            const variable = this.variables[this.currentPLC].find(v => v.nodeId === nodeId);
            if (variable) {
                variable.value = value;
            }
        }
    }

    // 更新变量显示
    updateVariablesDisplay(variables) {
        for (const [nodeId, data] of Object.entries(variables)) {
            this.updateVariableValue(nodeId, data.value, data.dataType);
        }
    }

    // 环境监测：识别变量节点
    detectEnvNodes(variableArray) {
        const sensors = this.env.sensors;
        const normalize = (s) => (s || '').toString().trim().toLowerCase();

        for (const v of variableArray) {
            const name = normalize(v.name);

            // Temperature 相关变量
            if (name === 'temperature' || name === 'temp') sensors.temp.nodeMap.value = v.nodeId;
            if (name === 't_mean' || name === 'temp_mean') sensors.temp.nodeMap.mean = v.nodeId;
            if (name === 't_variance' || name === 'temp_variance') sensors.temp.nodeMap.variance = v.nodeId;
            if (name === 't_std_deviation' || name === 'temp_std_deviation') sensors.temp.nodeMap.stdDev = v.nodeId;
            if (name === 't_z_score' || name === 'temp_z_score') sensors.temp.nodeMap.zScore = v.nodeId;
            if (name === 't_anm_flag' || name === 'temp_alarm') sensors.temp.nodeMap.alarm = v.nodeId;
            if (name === 't_freq' || name === 'temp_freq') sensors.temp.nodeMap.freq = v.nodeId;
            if (name === 't_ampl' || name === 'temp_ampl') sensors.temp.nodeMap.ampl = v.nodeId;
            if (name === 't_offset' || name === 'temp_offset') sensors.temp.nodeMap.offset = v.nodeId;

            // Humidity 相关变量
            if (name === 'humidity' || name === 'hum') sensors.hum.nodeMap.value = v.nodeId;
            if (name === 'h_mean' || name === 'hum_mean') sensors.hum.nodeMap.mean = v.nodeId;
            if (name === 'h_variance' || name === 'hum_variance') sensors.hum.nodeMap.variance = v.nodeId;
            if (name === 'h_std_deviation' || name === 'hum_std_deviation') sensors.hum.nodeMap.stdDev = v.nodeId;
            if (name === 'h_z_score' || name === 'hum_z_score') sensors.hum.nodeMap.zScore = v.nodeId;
            if (name === 'h_anm_flag' || name === 'hum_alarm') sensors.hum.nodeMap.alarm = v.nodeId;
            if (name === 'h_freq' || name === 'hum_freq') sensors.hum.nodeMap.freq = v.nodeId;
            if (name === 'h_ampl' || name === 'hum_ampl') sensors.hum.nodeMap.ampl = v.nodeId;
            if (name === 'h_offset' || name === 'hum_offset') sensors.hum.nodeMap.offset = v.nodeId;

            // Pressure 相关变量
            if (name === 'pressure' || name === 'press') sensors.press.nodeMap.value = v.nodeId;
            if (name === 'p_mean' || name === 'press_mean') sensors.press.nodeMap.mean = v.nodeId;
            if (name === 'p_variance' || name === 'press_variance') sensors.press.nodeMap.variance = v.nodeId;
            if (name === 'p_std_deviation' || name === 'press_std_deviation') sensors.press.nodeMap.stdDev = v.nodeId;
            if (name === 'p_z_score' || name === 'press_z_score') sensors.press.nodeMap.zScore = v.nodeId;
            if (name === 'p_anm_flag' || name === 'press_alarm') sensors.press.nodeMap.alarm = v.nodeId;
            if (name === 'p_freq' || name === 'press_freq') sensors.press.nodeMap.freq = v.nodeId;
            if (name === 'p_ampl' || name === 'press_ampl') sensors.press.nodeMap.ampl = v.nodeId;
            if (name === 'p_offset' || name === 'press_offset') sensors.press.nodeMap.offset = v.nodeId;
        }
    }

    // 环境监测：从数组（浏览返回）更新显示
    updateEnvFromArray(variableArray) {
        const lookup = new Map(variableArray.map(v => [v.nodeId, v]));
        this.updateSensorData('temp', lookup);
        this.updateSensorData('hum', lookup);
        this.updateSensorData('press', lookup);
    }

    // 环境监测：从Map（轮询推送）更新显示
    updateEnvFromMap(variablesMap) {
        this.updateSensorDataFromMap('temp', variablesMap);
        this.updateSensorDataFromMap('hum', variablesMap);
        this.updateSensorDataFromMap('press', variablesMap);
    }

    // 更新单个传感器数据（从变量数组）
    updateSensorData(sensorKey, lookup) {
        const sensor = this.env.sensors[sensorKey];
        const nodeMap = sensor.nodeMap;

        const getValue = (nodeId) => {
            const v = lookup.get(nodeId);
            if (!v || v.value == null) return null;
            const n = Number(v.value);
            return Number.isNaN(n) ? null : n;
        };

        const getScaledValue = (nodeId) => {
            const val = getValue(nodeId);
            return val != null ? val / this.env.scale : null;
        };

        // 获取所有数据
        const value = nodeMap.value ? getScaledValue(nodeMap.value) : null;
        const mean = nodeMap.mean ? getValue(nodeMap.mean) : null;
        const variance = nodeMap.variance ? getValue(nodeMap.variance) : null;
        const stdDev = nodeMap.stdDev ? getValue(nodeMap.stdDev) : null;
        const zScore = nodeMap.zScore ? getValue(nodeMap.zScore) : null;
        const alarm = nodeMap.alarm ? getValue(nodeMap.alarm) : null;
        const freq = nodeMap.freq ? getValue(nodeMap.freq) : null;
        const ampl = nodeMap.ampl ? getValue(nodeMap.ampl) : null;
        const offset = nodeMap.offset ? getValue(nodeMap.offset) : null;

        // 更新折线图数据
        if (value != null) {
            const now = Date.now();
            sensor.lineData.push({ time: now, value: value });
            if (sensor.lineData.length > sensor.maxDataPoints) {
                sensor.lineData.shift();
            }
        }

        // 更新显示
        this.renderSensorStats(sensorKey, mean, variance, stdDev, zScore);
        this.renderSensorAlarm(sensorKey, alarm);
        this.renderSensorLineChart(sensorKey);
        this.renderSensorSineChart(sensorKey, freq, ampl, offset);
    }

    // 更新单个传感器数据（从变量Map）
    updateSensorDataFromMap(sensorKey, variablesMap) {
        const sensor = this.env.sensors[sensorKey];
        const nodeMap = sensor.nodeMap;

        const getValue = (nodeId) => {
            const v = variablesMap[nodeId];
            if (!v || v.value == null) return null;
            const n = Number(v.value);
            return Number.isNaN(n) ? null : n;
        };

        const getScaledValue = (nodeId) => {
            const val = getValue(nodeId);
            return val != null ? val / this.env.scale : null;
        };

        // 获取所有数据
        const value = nodeMap.value ? getScaledValue(nodeMap.value) : null;
        const mean = nodeMap.mean ? getValue(nodeMap.mean) : null;
        const variance = nodeMap.variance ? getValue(nodeMap.variance) : null;
        const stdDev = nodeMap.stdDev ? getValue(nodeMap.stdDev) : null;
        const zScore = nodeMap.zScore ? getValue(nodeMap.zScore) : null;
        const alarm = nodeMap.alarm ? getValue(nodeMap.alarm) : null;
        const freq = nodeMap.freq ? getValue(nodeMap.freq) : null;
        const ampl = nodeMap.ampl ? getValue(nodeMap.ampl) : null;
        const offset = nodeMap.offset ? getValue(nodeMap.offset) : null;

        // 更新折线图数据
        if (value != null) {
            const timestamp = nodeMap.value ? variablesMap[nodeMap.value]?.timestamp : null;
            const time = timestamp ? new Date(timestamp).getTime() : Date.now();
            sensor.lineData.push({ time: time, value: value });
            if (sensor.lineData.length > sensor.maxDataPoints) {
                sensor.lineData.shift();
            }
        }

        // 更新显示
        this.renderSensorStats(sensorKey, mean, variance, stdDev, zScore);
        this.renderSensorAlarm(sensorKey, alarm);
        this.renderSensorLineChart(sensorKey);
        this.renderSensorSineChart(sensorKey, freq, ampl, offset);
    }

    // 渲染传感器统计数据
    renderSensorStats(sensorKey, mean, variance, stdDev, zScore) {
        const setValue = (id, val) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (val == null) {
                el.textContent = '--';
            } else {
                el.textContent = Number(val).toFixed(3);
            }
        };

        setValue(`${sensorKey}-mean`, mean);
        setValue(`${sensorKey}-variance`, variance);
        setValue(`${sensorKey}-std-deviation`, stdDev);
        setValue(`${sensorKey}-z-score`, zScore);
    }

    // 渲染传感器报警灯
    renderSensorAlarm(sensorKey, alarmValue) {
        const dot = document.getElementById(`${sensorKey}-alarm-dot`);
        if (!dot) return;

        dot.classList.remove('led-green', 'led-red', 'led-gray');
        if (alarmValue === true || alarmValue === 1 || alarmValue === '1') {
            dot.classList.add('led-red');
        } else if (alarmValue === false || alarmValue === 0 || alarmValue === '0') {
            dot.classList.add('led-green');
        } else {
            dot.classList.add('led-gray');
        }
    }

    // 渲染传感器折线图
    renderSensorLineChart(sensorKey) {
        const sensor = this.env.sensors[sensorKey];
        if (!sensor.lineChart) return;

        const times = sensor.lineData.map(d => this.formatTime(d.time));
        const values = sensor.lineData.map(d => Number(d.value.toFixed(3)));

        sensor.lineChart.setOption({
            xAxis: { data: times },
            series: [{ data: values }]
        });
    }

    // 渲染传感器正弦波图
    renderSensorSineChart(sensorKey, freq, ampl, offset) {
        const sensor = this.env.sensors[sensorKey];
        if (!sensor.sineChart || freq == null || ampl == null || offset == null) return;

        // 生成正弦波数据
        const points = 100;
        const sineData = [];
        for (let i = 0; i < points; i++) {
            const x = (i / points) * 4 * Math.PI; // 4个周期
            const y = ampl * Math.sin(freq * 2 * Math.PI * x) + offset;
            sineData.push([x, Number(y.toFixed(3))]);
        }

        // 更新旁边的公式文本
        const formulaElementId = `${sensorKey}SineFormula`;
        const formulaEl = document.getElementById(formulaElementId);
        if (formulaEl) {
            const a = Number(ampl);
            const w = Number(freq * 2 * Math.PI);
            const b = Number(offset);
            formulaEl.textContent = `y = ${a.toFixed(3)} * sin(${w.toFixed(3)} * x) + ${b.toFixed(3)}`;
        }

        // 动态调整纵轴范围
        const ys = sineData.map(p => p[1]);
        const minY = Math.min.apply(null, ys);
        const maxY = Math.max.apply(null, ys);
        const span = Math.max(1e-6, maxY - minY);
        const pad = span * 0.1;

        sensor.sineChart.setOption({
            yAxis: { min: minY - pad, max: maxY + pad, scale: true },
            series: [{ data: sineData }]
        });
    }

    // 环境监测：初始化图表
    ensureEnvReady() {
        this.initSensorCharts('temp', 'tempLineChart', 'tempSineChart');
        this.initSensorCharts('hum', 'humLineChart', 'humSineChart');
        this.initSensorCharts('press', 'pressLineChart', 'pressSineChart');
    }

    // 初始化单个传感器的图表
    initSensorCharts(sensorKey, lineChartId, sineChartId) {
        const sensor = this.env.sensors[sensorKey];

        // 初始化折线图
        const lineContainer = document.getElementById(lineChartId);
        if (lineContainer && !sensor.lineChart && window.echarts) {
            sensor.lineChart = echarts.init(lineContainer);
            const lineOption = {
                tooltip: { trigger: 'axis' },
                grid: { left: 30, right: 10, top: 10, bottom: 20 },
                xAxis: { type: 'category', data: [] },
                yAxis: { type: 'value', scale: true },
                series: [{
                    type: 'line',
                    smooth: true,
                    symbol: 'none',
                    data: []
                }]
            };
            sensor.lineChart.setOption(lineOption);
        }

        // 初始化正弦波图
        const sineContainer = document.getElementById(sineChartId);
        if (sineContainer && !sensor.sineChart && window.echarts) {
            sensor.sineChart = echarts.init(sineContainer);
            const sineOption = {
                tooltip: { trigger: 'axis' },
                grid: { left: 30, right: 10, top: 10, bottom: 20 },
                xAxis: { type: 'value', name: 'x' },
                yAxis: { type: 'value', name: 'y' },
                series: [{
                    type: 'line',
                    smooth: true,
                    symbol: 'none',
                    data: []
                }]
            };
            sensor.sineChart.setOption(sineOption);
        }
    }

    formatTime(ms) {
        const dt = new Date(ms);
        const hh = String(dt.getHours()).padStart(2, '0');
        const mm = String(dt.getMinutes()).padStart(2, '0');
        const ss = String(dt.getSeconds()).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
    }

    // 获取当前变量值
    getCurrentVariableValue(nodeId) {
        const variables = this.variables[this.currentPLC] || [];
        const variable = variables.find(v => v.nodeId === nodeId);
        return variable ? variable.value : null;
    }

    // 获取数据类型分类
    getDataTypeCategory(dataType) {
        if (dataType === 'Boolean') return 'Boolean';
        if (['Int16', 'Int32', 'UInt16', 'UInt32', 'Float', 'Double'].includes(dataType)) return 'Number';
        if (dataType === 'String') return 'String';
        return 'Other';
    }

    // 转义节点ID用于DOM ID
    escapeNodeId(nodeId) {
        return nodeId.replace(/[^a-zA-Z0-9]/g, '_');
    }

    // 获取PLC名称
    getPLCName(plcId) {
        const plc = this.plcList.find(p => p.id === plcId);
        return plc ? plc.name : 'Unknown PLC';
    }

    // 更新PLC状态
    updatePLCStatus(plcId, isConnected) {
        const plcIndex = this.plcList.findIndex(p => p.id === plcId);
        if (plcIndex > -1) {
            this.plcList[plcIndex].isConnected = isConnected;
            this.renderPLCList();

            // 如果是当前PLC，更新控制面板
            if (plcId === this.currentPLC) {
                this.showPLCControlPanel();
            }
        }
    }

    // 更新全局状态
    updateGlobalStatus(text, type) {
        const statusElement = document.getElementById('globalStatus');
        statusElement.innerHTML = `<i class="fas fa-circle"></i> ${text}`;

        // 移除之前的状态类
        statusElement.classList.remove('success', 'error', 'warning', 'info');
        statusElement.classList.add(type);
    }

    // 显示模态框
    showModal(modalId) {
        document.getElementById(modalId).classList.add('show');
    }

    // 关闭模态框
    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('show');
    }

    // 重置表单
    resetForm(formId) {
        document.getElementById(formId).reset();

        // 清空预定义变量
        if (formId === 'addPlcForm') {
            document.getElementById('predefinedVariables').innerHTML = '';
        }
    }

    // 刷新单个变量
    refreshSingleVariable(plcId, nodeId) {
        if (plcId === this.currentPLC) {
            this.socket.emit('readVariable', {
                plcId: plcId,
                nodeId: nodeId
            });
        }
    }

    // 显示消息
    showMessage(text, type = 'info') {
        const container = document.getElementById('messageContainer');
        const messageId = 'msg-' + Date.now();

        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };

        const message = document.createElement('div');
        message.id = messageId;
        message.className = `message ${type}`;
        message.innerHTML = `
            <div class="message-content">
                <i class="fas fa-${icons[type]} message-icon"></i>
                <div class="message-text">${text}</div>
            </div>
        `;

        container.appendChild(message);

        // 自动移除消息
        setTimeout(() => {
            const messageElement = document.getElementById(messageId);
            if (messageElement) {
                messageElement.remove();
            }
        }, 5000);
    }
}

// 初始化应用
const app = new PLCApp(); 
/**
 * PLC管理器
 * 负责管理多个PLC连接和变量操作
 */

const { OPCUAClient, MessageSecurityMode, SecurityPolicy, AttributeIds, DataType, StatusCodes } = require("node-opcua");
const { v4: uuidv4 } = require('uuid');

class PLCManager {
    constructor() {
        this.plcs = new Map(); // 存储所有PLC连接信息
    }

    /**
     * 规范化显示用变量名：去掉特定程序前缀
     * 仅用于展示/检索，不修改 nodeId
     */
    sanitizeVariableName(name) {
        try {
            if (!name) return name;
            const prefixes = [
                'ST_PRG_WITH_RS_LIB.',
                'ST_PRG_WITH_RS_LIB/'
            ];
            let result = name;
            for (const p of prefixes) {
                if (result.startsWith(p)) {
                    result = result.substring(p.length);
                }
            }
            return result;
        } catch (_) {
            return name;
        }
    }

    /**
     * 创建新的PLC配置
     * @param {Object} config - PLC配置信息
     * @param {string} config.name - PLC名称
     * @param {string} config.endpoint - PLC端点URL
     * @param {string} config.namespace - 命名空间URI（可选）
     * @param {number} config.namespaceIndex - 命名空间索引（可选，默认1）
     * @param {Array} config.variables - 预定义变量列表（可选）
     * @returns {string} PLC ID
     */
    async createPLC(config) {
        const plcId = uuidv4();

        // 验证配置
        if (!config.name || !config.endpoint) {
            throw new Error('PLC名称和端点URL是必填项');
        }

        // 创建OPC UA客户端
        const client = OPCUAClient.create({
            endpointMustExist: false,
            securityMode: MessageSecurityMode.None,
            securityPolicy: SecurityPolicy.None,
            requestedSessionTimeout: 60000,
            connectionStrategy: {
                initialDelay: 1000,
                maxRetry: 3
            }
        });

        const plcInfo = {
            id: plcId,
            name: config.name,
            endpoint: config.endpoint,
            namespace: config.namespace || null,
            namespaceIndex: config.namespaceIndex || 1,
            variables: config.variables || [],
            client: client,
            session: null,
            isConnected: false,
            createdAt: new Date()
        };

        this.plcs.set(plcId, plcInfo);

        console.log(`PLC配置已创建: ${config.name} (${plcId})`);
        return plcId;
    }

    /**
     * 获取所有PLC列表
     * @returns {Array} PLC列表
     */
    getPLCList() {
        const plcList = [];
        for (const [id, plc] of this.plcs) {
            plcList.push({
                id: plc.id,
                name: plc.name,
                endpoint: plc.endpoint,
                namespace: plc.namespace,
                namespaceIndex: plc.namespaceIndex,
                isConnected: plc.isConnected,
                variableCount: plc.variables.length,
                createdAt: plc.createdAt
            });
        }
        return plcList;
    }

    /**
     * 连接PLC
     * @param {string} plcId - PLC ID
     * @returns {Object} 连接结果
     */
    async connectPLC(plcId) {
        const plc = this.plcs.get(plcId);
        if (!plc) {
            throw new Error(`PLC ${plcId} 不存在`);
        }

        if (plc.isConnected) {
            return { success: true, message: 'PLC已连接' };
        }

        try {
            console.log(`正在连接PLC: ${plc.name} (${plc.endpoint})`);

            // 重置客户端状态
            if (plc.client._session) {
                try {
                    await plc.client.disconnect();
                    console.log(`断开之前的连接: ${plc.name}`);
                } catch (e) {
                    console.log(`断开之前连接时出错: ${e.message}`);
                }
            }

            // 创建新客户端以避免状态问题
            plc.client = OPCUAClient.create({
                endpointMustExist: false,
                securityMode: MessageSecurityMode.None,
                securityPolicy: SecurityPolicy.None,
                requestedSessionTimeout: 120000, // 增加超时时间
                connectionStrategy: {
                    initialDelay: 2000,
                    maxDelay: 10000,  // 最大延迟
                    maxRetry: 5      // 增加重试次数
                }
            });

            // 连接到OPC UA服务器
            await plc.client.connect(plc.endpoint);

            // 创建会话
            plc.session = await plc.client.createSession();
            plc.isConnected = true;

            console.log(`PLC连接成功: ${plc.name}`);
            return { success: true, message: 'PLC连接成功' };

        } catch (err) {
            console.error(`PLC连接失败: ${plc.name}`, err);
            plc.isConnected = false;

            // 添加更详细的错误信息
            let errorMsg = err.message;
            if (err.message.includes("invalid internal state")) {
                errorMsg = `连接状态错误: ${err.message}。请检查PLC地址是否正确且可访问`;
            }
            return { success: false, message: `连接失败: ${errorMsg}` };
        }
    }

    /**
     * 断开PLC连接
     * @param {string} plcId - PLC ID
     */
    async disconnectPLC(plcId) {
        const plc = this.plcs.get(plcId);
        if (!plc) {
            throw new Error(`PLC ${plcId} 不存在`);
        }

        try {
            if (plc.session) {
                await plc.session.close();
                plc.session = null;
            }

            if (plc.client) {
                await plc.client.disconnect();
            }

            plc.isConnected = false;
            console.log(`PLC已断开连接: ${plc.name}`);
        } catch (err) {
            console.error(`断开PLC连接时出错: ${plc.name}`, err);
            throw err;
        }
    }

    /**
     * 删除PLC配置
     * @param {string} plcId - PLC ID
     */
    async deletePLC(plcId) {
        const plc = this.plcs.get(plcId);
        if (!plc) {
            throw new Error(`PLC ${plcId} 不存在`);
        }

        // 先断开连接
        if (plc.isConnected) {
            await this.disconnectPLC(plcId);
        }

        // 删除PLC配置
        this.plcs.delete(plcId);
        console.log(`PLC配置已删除: ${plc.name}`);
    }

    /**
 * 浏览PLC变量
 * @param {string} plcId - PLC ID
 * @returns {Array} 变量列表
 */
    async browsePLCVariables(plcId) {
        const plc = this.plcs.get(plcId);
        if (!plc) {
            throw new Error(`PLC ${plcId} 不存在`);
        }

        if (!plc.isConnected || !plc.session) {
            throw new Error('PLC未连接');
        }

        try {
            const variables = [];

            // 如果有预定义变量，读取这些变量
            if (plc.variables && plc.variables.length > 0) {
                for (const variable of plc.variables) {
                    try {
                        const result = await this.readVariable(plcId, variable.nodeId);
                        variables.push({
                            name: this.sanitizeVariableName(variable.name),
                            nodeId: variable.nodeId,
                            dataType: result.dataType,
                            value: result.value,
                            description: variable.description || ''
                        });
                    } catch (err) {
                        console.warn(`读取变量失败: ${variable.nodeId}`, err.message);
                        variables.push({
                            name: this.sanitizeVariableName(variable.name),
                            nodeId: variable.nodeId,
                            dataType: 'Unknown',
                            value: null,
                            description: variable.description || '',
                            error: err.message
                        });
                    }
                }
            }

            // 自动发现变量 - 递归浏览所有节点
            const discoveredVariables = await this.discoverAllVariables(plc.session);

            // 合并预定义变量和发现的变量，避免重复
            const existingNodeIds = new Set(variables.map(v => v.nodeId));
            for (const variable of discoveredVariables) {
                if (!existingNodeIds.has(variable.nodeId)) {
                    // 对发现的变量名称做去前缀清洗
                    variables.push({ ...variable, name: this.sanitizeVariableName(variable.name) });
                }
            }

            // 将发现到的变量保存到PLC配置，供轮询读取
            plc.discoveredVariables = variables.map(v => ({
                name: v.name,
                nodeId: v.nodeId,
                description: v.description || ''
            }));

            console.log(`发现了 ${variables.length} 个变量`);
            return variables;
        } catch (err) {
            console.error(`浏览PLC变量失败: ${plc.name}`, err);
            throw new Error(`浏览变量失败: ${err.message}`);
        }
    }

    /**
 * 递归发现所有变量
 * @param {Object} session - OPC UA会话
 * @returns {Array} 发现的变量列表
 */
    async discoverAllVariables(session) {
        const variables = [];
        const visited = new Set();

        // 优先尝试直接搜索常见的main路径变量
        await this.searchMainVariables(session, variables);

        // 定义要浏览的起始节点（使用标准NodeId，避免传入非NodeId字符串）
        const startNodes = [
            "i=84",   // RootFolder
            "i=85",   // Objects folder (ns=0)
            "i=2253", // Server folder (ns=0)
        ];

        // 优先搜索命名空间1下的 Objects 节点
        startNodes.unshift("ns=1;i=85");

        // 也尝试其他命名空间的 Objects 节点
        for (let ns = 0; ns <= 5; ns++) {
            if (ns !== 1) {
                startNodes.push(`ns=${ns};i=85`);
            }
        }

        for (const startNode of startNodes) {
            try {
                await this.browseNodeRecursively(session, startNode, variables, visited, 0, 4);
            } catch (err) {
                // 如果某个起始节点失败，继续尝试其他节点
                console.warn(`浏览节点 ${startNode} 失败:`, err.message);
            }
        }

        // 去重处理
        const uniqueVariables = this.removeDuplicateVariables(variables);
        console.log(`总共发现 ${uniqueVariables.length} 个变量`);

        return uniqueVariables;
    }

    /**
     * 专门搜索main路径下的变量
     * @param {Object} session - OPC UA会话
     * @param {Array} variables - 变量数组
     */
    async searchMainVariables(session, variables) {
        // 常见的main路径变量
        const commonMainVariables = [
            "ns=1;s=main.power_on",
            "ns=1;s=main.start_demo",
            "ns=1;s=main.stop",
            "ns=1;s=main.reset",
            "ns=1;s=main.enable_demo",
            "ns=1;s=main.AG", // 轴组
            "ns=1;s=main.A1", // 轴1
            "ns=1;s=main.A2", // 轴2
            "ns=1;s=main.A3", // 轴3
            "ns=1;s=main.L1", // 线性轴1
            "ns=1;s=main.L2", // 线性轴2
            "ns=1;s=main.R1", // 旋转轴1
            "ns=1;s=main.R2", // 旋转轴2
            "ns=1;s=main.Init_Eno",
            "ns=1;s=main.Init_Done",
            "ns=1;s=main.toggle",
            "ns=1;s=main.notToggle",
            "ns=1;s=main.q1",
            "ns=1;s=main.q2"
        ];

        console.log('正在搜索常见main变量...');

        for (const nodeId of commonMainVariables) {
            try {
                const dataValue = await session.readVariableValue(nodeId);

                if (dataValue && dataValue.statusCode && dataValue.statusCode.isGood()) {
                    const variableName = nodeId.split('.').pop(); // 获取最后一部分作为名称
                    variables.push({
                        name: this.sanitizeVariableName(variableName),
                        nodeId: nodeId,
                        dataType: this.getDataTypeName(dataValue.value.dataType),
                        value: dataValue.value.value,
                        description: `Main程序变量: ${variableName}`,
                        browsePath: `main/${variableName}`
                    });
                    console.log(`✓ 找到变量: ${nodeId}`);
                }
            } catch (err) {
                // 忽略不存在的变量，继续搜索下一个
                console.log(`- 变量不存在: ${nodeId}`);
            }
        }
    }

    /**
     * 去除重复变量
     * @param {Array} variables - 变量数组
     * @returns {Array} 去重后的变量数组
     */
    removeDuplicateVariables(variables) {
        const seen = new Set();
        return variables.filter(variable => {
            if (seen.has(variable.nodeId)) {
                return false;
            }
            seen.add(variable.nodeId);
            return true;
        });
    }

    /**
 * 递归浏览节点
 * @param {Object} session - OPC UA会话
 * @param {string} nodeId - 要浏览的节点ID
 * @param {Array} variables - 变量数组
 * @param {Set} visited - 已访问的节点集合
 * @param {number} depth - 当前深度
 * @param {number} maxDepth - 最大深度
 */
    async browseNodeRecursively(session, nodeId, variables, visited, depth, maxDepth) {
        // 限制递归深度避免无限循环
        if (depth > maxDepth || visited.has(nodeId)) {
            return;
        }

        visited.add(nodeId);

        try {
            const browseResult = await session.browse(nodeId);

            for (const reference of browseResult.references) {
                const refNodeId = reference.nodeId.toString();

                // 如果是变量节点
                if (reference.nodeClass === 2) { // Variable node class
                    try {
                        const dataValue = await session.readVariableValue(refNodeId);

                        if (dataValue && dataValue.statusCode && dataValue.statusCode.isGood()) {
                            const variable = {
                                name: this.sanitizeVariableName(reference.browseName.name || reference.displayName.text),
                                nodeId: refNodeId,
                                dataType: this.getDataTypeName(dataValue.value.dataType),
                                value: dataValue.value.value,
                                description: reference.displayName.text || '',
                                browsePath: this.generateBrowsePath(nodeId, reference.browseName.name)
                            };

                            // 过滤掉系统变量和内部变量
                            if (!this.isSystemVariable(variable.name, refNodeId)) {
                                variables.push(variable);
                            }
                        }
                    } catch (err) {
                        // 如果是main路径下的变量，即使读取失败也添加到列表
                        if (refNodeId.includes('main.') || reference.browseName.name === 'main') {
                            variables.push({
                                name: this.sanitizeVariableName(reference.browseName.name || reference.displayName.text),
                                nodeId: refNodeId,
                                dataType: 'Unknown',
                                value: null,
                                description: reference.displayName.text || '',
                                browsePath: this.generateBrowsePath(nodeId, reference.browseName.name),
                                error: err.message
                            });
                        }
                    }
                }
                // 如果是对象或文件夹节点，递归浏览（优先浏览名为main的对象）
                else if (reference.nodeClass === 1 && !visited.has(refNodeId)) { // Object node class
                    const nodeName = reference.browseName.name;

                    // 优先浏览main对象
                    if (nodeName === 'main' || nodeName.toLowerCase().includes('main')) {
                        console.log(`发现main对象，深度浏览: ${refNodeId}`);
                        await this.browseNodeRecursively(session, refNodeId, variables, visited, depth + 1, maxDepth + 2);
                    } else {
                        await this.browseNodeRecursively(session, refNodeId, variables, visited, depth + 1, maxDepth);
                    }
                }
            }
        } catch (err) {
            console.warn(`浏览节点 ${nodeId} 失败:`, err.message);
        }
    }

    /**
     * 获取数据类型名称
     * @param {number} dataType - 数据类型编号
     * @returns {string} 数据类型名称
     */
    getDataTypeName(dataType) {
        const { DataType } = require("node-opcua");
        return DataType[dataType] || `Unknown(${dataType})`;
    }

    /**
     * 生成浏览路径
     * @param {string} parentPath - 父路径
     * @param {string} nodeName - 节点名称
     * @returns {string} 浏览路径
     */
    generateBrowsePath(parentPath, nodeName) {
        if (parentPath === "RootFolder" || parentPath === "Objects") {
            return nodeName;
        }
        return `${parentPath}/${nodeName}`;
    }

    /**
          * 判断是否为系统变量
     * @param {string} name - 变量名称
     * @param {string} nodeId - 节点ID
     * @returns {boolean} 是否为系统变量
     */
    isSystemVariable(name, nodeId) {
        const systemNames = [
            'ServerStatus',
            'ServiceLevel',
            'ServerDiagnostics',
            'VendorServerInfo',
            'ServerCapabilities',
            'OperationLimits',
            'ModellingRules',
            'AggregateFunctions',
            'ServerRedundancy',
            'Namespaces',
            'HistoryServerCapabilities'
        ];

        // 优先保留main路径下的变量
        if (nodeId.includes('main.') || name.includes('main.')) {
            return false;
        }

        // 过滤系统节点ID
        if (nodeId.includes('i=') && !nodeId.includes('ns=')) {
            const numericId = parseInt(nodeId.split('i=')[1]);
            if (numericId < 1000) { // 通常系统节点ID小于1000
                return true;
            }
        }

        // 过滤明显的系统变量
        if (nodeId.includes('ns=0;')) {
            return true; // 命名空间0通常是系统变量
        }

        return systemNames.some(sysName =>
            name.toLowerCase().includes(sysName.toLowerCase())
        );
    }

    /**
     * 读取变量值
     * @param {string} plcId - PLC ID
     * @param {string} nodeId - 节点ID
     * @returns {Object} 变量值和类型
     */
    async readVariable(plcId, nodeId) {
        const plc = this.plcs.get(plcId);
        if (!plc) {
            throw new Error(`PLC ${plcId} 不存在`);
        }

        if (!plc.isConnected || !plc.session) {
            throw new Error('PLC未连接');
        }

        try {
            const dataValue = await plc.session.readVariableValue(nodeId);

            if (dataValue.statusCode !== StatusCodes.Good) {
                throw new Error(`读取失败: ${dataValue.statusCode.toString()}`);
            }

            return {
                value: dataValue.value.value,
                dataType: DataType[dataValue.value.dataType] || dataValue.value.dataType,
                sourceTimestamp: dataValue.sourceTimestamp,
                serverTimestamp: dataValue.serverTimestamp
            };
        } catch (err) {
            console.error(`读取变量失败: ${nodeId}`, err);
            throw new Error(`读取变量失败: ${err.message}`);
        }
    }

    /**
     * 写入变量值
     * @param {string} plcId - PLC ID
     * @param {string} nodeId - 节点ID
     * @param {*} value - 要写入的值
     * @param {string} dataType - 数据类型
     */
    async writeVariable(plcId, nodeId, value, dataType) {
        const plc = this.plcs.get(plcId);
        if (!plc) {
            throw new Error(`PLC ${plcId} 不存在`);
        }

        if (!plc.isConnected || !plc.session) {
            throw new Error('PLC未连接');
        }

        try {
            // 转换数据类型
            let convertedValue = value;
            switch (dataType) {
                case 'Boolean':
                    convertedValue = Boolean(value);
                    break;
                case 'Int16':
                case 'Int32':
                    convertedValue = parseInt(value);
                    break;
                case 'UInt16':
                case 'UInt32':
                    convertedValue = parseInt(value);
                    break;
                case 'Float':
                case 'Double':
                    convertedValue = parseFloat(value);
                    break;
                case 'String':
                    convertedValue = String(value);
                    break;
            }

            const nodeToWrite = {
                nodeId: nodeId,
                attributeId: AttributeIds.Value,
                value: {
                    value: {
                        dataType: DataType[dataType] || dataType,
                        value: convertedValue
                    }
                }
            };

            const writeResult = await plc.session.write(nodeToWrite);

            // 检查写入结果
            if (!writeResult) {
                throw new Error('写入操作无响应');
            }

            // writeResult 可能是数组或单个结果
            const statusCode = Array.isArray(writeResult) ? writeResult[0] : writeResult;

            if (!statusCode || statusCode !== StatusCodes.Good) {
                const errorMsg = statusCode ? statusCode.toString() : '未知错误';
                throw new Error(`写入失败: ${errorMsg}`);
            }

            console.log(`变量写入成功: ${nodeId} = ${convertedValue}`);
        } catch (err) {
            console.error(`写入变量失败: ${nodeId}`, err);
            throw new Error(`写入变量失败: ${err.message}`);
        }
    }

    /**
     * 读取所有变量
     * @param {string} plcId - PLC ID
     * @returns {Object} 所有变量的值
     */
    async readAllVariables(plcId) {
        const plc = this.plcs.get(plcId);
        if (!plc) {
            throw new Error(`PLC ${plcId} 不存在`);
        }

        if (!plc.isConnected || !plc.session) {
            return {};
        }

        const variables = {};

        // 组合预定义变量与已发现变量
        const toRead = [];
        if (plc.variables && plc.variables.length > 0) {
            toRead.push(...plc.variables);
        }
        if (plc.discoveredVariables && plc.discoveredVariables.length > 0) {
            toRead.push(...plc.discoveredVariables);
        }

        // 去重（按 nodeId）
        const seen = new Set();
        const unique = [];
        for (const item of toRead) {
            if (!item || !item.nodeId) continue;
            if (seen.has(item.nodeId)) continue;
            seen.add(item.nodeId);
            unique.push(item);
        }

        if (unique.length > 0) {
            for (const variable of unique) {
                try {
                    const result = await this.readVariable(plcId, variable.nodeId);
                    variables[variable.nodeId] = {
                        name: this.sanitizeVariableName(variable.name || variable.nodeId),
                        value: result.value,
                        dataType: result.dataType,
                        timestamp: result.sourceTimestamp
                    };
                } catch (err) {
                    variables[variable.nodeId] = {
                        name: this.sanitizeVariableName(variable.name || variable.nodeId),
                        value: null,
                        dataType: 'Unknown',
                        error: err.message
                    };
                }
            }
        }

        return variables;
    }

    /**
     * 断开所有PLC连接
     */
    async disconnectAll() {
        const disconnectPromises = [];

        for (const [plcId, plc] of this.plcs) {
            if (plc.isConnected) {
                disconnectPromises.push(this.disconnectPLC(plcId));
            }
        }

        await Promise.all(disconnectPromises);
        console.log('所有PLC连接已断开');
    }

    /**
     * 添加变量到PLC配置
     * @param {string} plcId - PLC ID
     * @param {Object} variable - 变量信息
     */
    addVariable(plcId, variable) {
        const plc = this.plcs.get(plcId);
        if (!plc) {
            throw new Error(`PLC ${plcId} 不存在`);
        }

        plc.variables.push(variable);
        console.log(`变量已添加到PLC ${plc.name}: ${variable.name}`);
    }

    /**
     * 移除变量从PLC配置
     * @param {string} plcId - PLC ID
     * @param {string} nodeId - 节点ID
     */
    removeVariable(plcId, nodeId) {
        const plc = this.plcs.get(plcId);
        if (!plc) {
            throw new Error(`PLC ${plcId} 不存在`);
        }

        const index = plc.variables.findIndex(v => v.nodeId === nodeId);
        if (index > -1) {
            const removed = plc.variables.splice(index, 1)[0];
            console.log(`变量已从PLC ${plc.name}移除: ${removed.name}`);
        }
    }
}

module.exports = PLCManager; 
/**
 * OPC UA PLC 动态连接控制服务器
 * 支持动态创建PLC连接和变量控制
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const PLCManager = require('./plc-manager');

// 创建Express应用
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const port = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// 创建PLC管理器实例
const plcManager = new PLCManager();

// 存储活跃的Socket连接
const activeSockets = new Map();

// WebSocket连接处理
io.on('connection', (socket) => {
    console.log('客户端已连接:', socket.id);
    activeSockets.set(socket.id, socket);

    // 发送当前PLC连接列表
    socket.emit('plcList', plcManager.getPLCList());

    // 处理创建PLC连接请求
    socket.on('createPLC', async (config) => {
        try {
            const plcId = await plcManager.createPLC(config);
            const plcList = plcManager.getPLCList();

            // 广播更新给所有客户端
            io.emit('plcList', plcList);

            socket.emit('createPLCResult', {
                success: true,
                plcId: plcId,
                message: 'PLC配置创建成功'
            });
        } catch (err) {
            socket.emit('createPLCResult', {
                success: false,
                message: err.message
            });
        }
    });

    // 处理连接PLC请求
    socket.on('connectPLC', async (plcId) => {
        try {
            const result = await plcManager.connectPLC(plcId);
            socket.emit('connectPLCResult', {
                plcId: plcId,
                success: result.success,
                message: result.message
            });

            // 如果连接成功，开始发送变量更新
            if (result.success) {
                startVariableUpdates(plcId);
            }

            // 广播连接状态更新
            io.emit('plcConnectionStatus', {
                plcId: plcId,
                connected: result.success
            });
        } catch (err) {
            socket.emit('connectPLCResult', {
                plcId: plcId,
                success: false,
                message: err.message
            });
        }
    });

    // 处理断开PLC请求
    socket.on('disconnectPLC', async (plcId) => {
        try {
            await plcManager.disconnectPLC(plcId);
            stopVariableUpdates(plcId);

            socket.emit('disconnectPLCResult', {
                plcId: plcId,
                success: true,
                message: 'PLC断开连接成功'
            });

            // 广播连接状态更新
            io.emit('plcConnectionStatus', {
                plcId: plcId,
                connected: false
            });
        } catch (err) {
            socket.emit('disconnectPLCResult', {
                plcId: plcId,
                success: false,
                message: err.message
            });
        }
    });

    // 处理删除PLC请求
    socket.on('deletePLC', async (plcId) => {
        try {
            await plcManager.deletePLC(plcId);
            stopVariableUpdates(plcId);

            const plcList = plcManager.getPLCList();
            io.emit('plcList', plcList);

            socket.emit('deletePLCResult', {
                plcId: plcId,
                success: true,
                message: 'PLC配置删除成功'
            });
        } catch (err) {
            socket.emit('deletePLCResult', {
                plcId: plcId,
                success: false,
                message: err.message
            });
        }
    });

    // 处理浏览PLC变量请求
    socket.on('browsePLCVariables', async (plcId) => {
        try {
            const variables = await plcManager.browsePLCVariables(plcId);
            socket.emit('browsePLCVariablesResult', {
                plcId: plcId,
                success: true,
                variables: variables
            });
        } catch (err) {
            socket.emit('browsePLCVariablesResult', {
                plcId: plcId,
                success: false,
                message: err.message
            });
        }
    });

    // 处理读取变量请求
    socket.on('readVariable', async (data) => {
        try {
            const result = await plcManager.readVariable(data.plcId, data.nodeId);
            socket.emit('readVariableResult', {
                plcId: data.plcId,
                nodeId: data.nodeId,
                success: true,
                value: result.value,
                dataType: result.dataType
            });
        } catch (err) {
            socket.emit('readVariableResult', {
                plcId: data.plcId,
                nodeId: data.nodeId,
                success: false,
                message: err.message
            });
        }
    });

    // 处理写入变量请求
    socket.on('writeVariable', async (data) => {
        try {
            await plcManager.writeVariable(data.plcId, data.nodeId, data.value, data.dataType);
            socket.emit('writeVariableResult', {
                plcId: data.plcId,
                nodeId: data.nodeId,
                success: true,
                message: '变量写入成功'
            });
        } catch (err) {
            socket.emit('writeVariableResult', {
                plcId: data.plcId,
                nodeId: data.nodeId,
                success: false,
                message: err.message
            });
        }
    });

    // 处理客户端断开连接
    socket.on('disconnect', () => {
        console.log('客户端已断开连接:', socket.id);
        activeSockets.delete(socket.id);
    });
});

// 变量更新定时器存储
const variableUpdateTimers = new Map();

// 开始变量更新
function startVariableUpdates(plcId) {
    // 停止现有的定时器
    stopVariableUpdates(plcId);

    // 创建新的定时器
    const timer = setInterval(async () => {
        try {
            const variables = await plcManager.readAllVariables(plcId);
            io.emit('variablesUpdate', {
                plcId: plcId,
                variables: variables
            });
        } catch (err) {
            console.error(`读取PLC ${plcId}变量失败:`, err.message);
        }
    }, 1000); // 每1秒更新一次

    variableUpdateTimers.set(plcId, timer);
}

// 停止变量更新
function stopVariableUpdates(plcId) {
    const timer = variableUpdateTimers.get(plcId);
    if (timer) {
        clearInterval(timer);
        variableUpdateTimers.delete(plcId);
    }
}

// 启动服务器
server.listen(port, () => {
    console.log(`服务器运行在 http://localhost:${port}`);
    console.log('OPC UA PLC动态连接控制系统已启动');
});

// 优雅关闭
process.on('SIGINT', async () => {
    console.log('正在关闭服务器...');

    // 停止所有变量更新定时器
    for (const [plcId, timer] of variableUpdateTimers) {
        clearInterval(timer);
    }

    // 断开所有PLC连接
    await plcManager.disconnectAll();

    process.exit(0);
}); 
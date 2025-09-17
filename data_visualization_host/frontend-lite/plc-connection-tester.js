/**
 * OPC UA PLC 连接测试工具
 * 用于诊断和测试OPC UA连接
 */

const { OPCUAClient, MessageSecurityMode, SecurityPolicy } = require("node-opcua");
const { diagnosticsConfig } = require("./config");

/**
 * 测试OPC UA连接
 * @param {string} endpoint - OPC UA服务器端点URL
 * @returns {Promise<Object>} 连接测试结果
 */
async function testConnection(endpoint) {
    console.log(`开始测试OPC UA连接: ${endpoint}`);

    try {
        // 创建临时客户端用于测试
        const client = OPCUAClient.create({
            endpointMustExist: false,
            securityMode: MessageSecurityMode.None,
            securityPolicy: SecurityPolicy.None,
            requestedSessionTimeout: diagnosticsConfig.connectionTimeout,
            connectionStrategy: {
                initialDelay: 1000,
                maxDelay: diagnosticsConfig.reconnectDelay,
                maxRetry: diagnosticsConfig.connectionRetryCount
            }
        });

        // 记录连接开始时间
        const startTime = Date.now();

        // 连接
        console.log(`正在连接到: ${endpoint}`);
        await client.connect(endpoint);
        console.log('连接成功，正在创建会话...');

        // 创建会话
        const session = await client.createSession();
        console.log('会话创建成功，获取服务器状态...');

        // 获取服务器状态
        const serverStatus = await session.getServerStatus();
        const endTime = Date.now();
        const connectionTime = endTime - startTime;

        // 关闭会话和连接
        await session.close();
        await client.disconnect();

        return {
            success: true,
            message: '连接测试成功',
            serverInfo: {
                productName: serverStatus.buildInfo.productName,
                softwareVersion: serverStatus.buildInfo.softwareVersion,
                state: serverStatus.state.toString(),
                currentTime: serverStatus.currentTime,
                startTime: serverStatus.startTime,
                secondsTillShutdown: serverStatus.secondsTillShutdown,
            },
            diagnostics: {
                connectionTimeMs: connectionTime,
                endpoint: endpoint
            }
        };
    } catch (err) {
        // 详细的错误诊断
        console.error(`连接测试失败: ${err.message}`);

        let errorCategory = '未知错误';
        let suggestion = '请检查服务器地址和状态';

        if (err.message.includes('getaddrinfo')) {
            errorCategory = '地址解析错误';
            suggestion = '服务器地址可能不正确或无法解析，请检查IP地址和端口号';
        } else if (err.message.includes('ECONNREFUSED')) {
            errorCategory = '连接被拒绝';
            suggestion = '服务器可能未启动或端口号错误，请确认服务器正在运行';
        } else if (err.message.includes('ETIMEDOUT')) {
            errorCategory = '连接超时';
            suggestion = '服务器可能不可达，请检查网络连接和防火墙设置';
        } else if (err.message.includes('invalid internal state')) {
            errorCategory = '客户端状态错误';
            suggestion = '内部连接状态异常，请等待一段时间后重试';
        } else if (err.message.includes('security')) {
            errorCategory = '安全策略错误';
            suggestion = '服务器可能需要安全连接，请检查安全模式和策略设置';
        }

        return {
            success: false,
            message: `连接测试失败: ${err.message}`,
            diagnostics: {
                errorCategory: errorCategory,
                suggestion: suggestion,
                endpoint: endpoint,
                error: err.message
            }
        };
    }
}

/**
 * 扫描可用端点
 * @param {string} baseUrl - 基础URL，不包含端口
 * @param {number[]} ports - 要扫描的端口数组
 * @returns {Promise<Object>} 扫描结果
 */
async function scanEndpoints(baseUrl, ports = [4840, 4841, 4842, 48010, 48020]) {
    console.log(`开始扫描OPC UA端点: ${baseUrl}`);

    const results = [];
    const promises = [];

    // 从基础URL中解析出主机部分
    const urlParts = baseUrl.split('://');
    if (urlParts.length !== 2) {
        return {
            success: false,
            message: '无效的基础URL',
            results: []
        };
    }

    const protocol = urlParts[0];
    const host = urlParts[1];

    // 针对每个端口进行测试
    for (const port of ports) {
        const endpoint = `${protocol}://${host}:${port}`;

        // 收集所有测试任务
        const promise = testConnection(endpoint)
            .then(result => {
                results.push({
                    endpoint,
                    ...result
                });
            })
            .catch(err => {
                results.push({
                    endpoint,
                    success: false,
                    message: `测试错误: ${err.message}`
                });
            });

        promises.push(promise);
    }

    // 等待所有测试完成
    await Promise.all(promises);

    // 对结果进行排序 - 成功的排在前面
    results.sort((a, b) => {
        if (a.success && !b.success) return -1;
        if (!a.success && b.success) return 1;
        return 0;
    });

    return {
        success: results.some(r => r.success),
        message: results.some(r => r.success)
            ? '发现可用的OPC UA端点'
            : '未找到可用的OPC UA端点',
        results
    };
}

module.exports = {
    testConnection,
    scanEndpoints
}; 
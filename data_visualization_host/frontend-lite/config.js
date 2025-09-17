/**
 * PLC 连接配置文件
 * 用于存储和管理PLC连接信息
 */

// 默认PLC配置示例
const defaultPLCConfig = {
    name: "本地测试PLC",
    endpoint: "opc.tcp://localhost:4840",  // 本地测试地址
    namespace: null,
    namespaceIndex: 1,
    variables: [
        {
            name: "测试变量",
            nodeId: "ns=1;s=Counter",
            description: "测试用计数器变量"
        }
    ]
};

// 常用OPC UA服务器连接配置
const commonOPCUAServers = [
    {
        name: "本地测试服务器",
        endpoint: "opc.tcp://localhost:4840"
    },
    {
        name: "开发环境",
        endpoint: "opc.tcp://127.0.0.1:4840"
    },
    {
        name: "仿真环境",
        endpoint: "opc.tcp://192.168.1.100:4840"
    }
];

// 连接诊断工具配置
const diagnosticsConfig = {
    enableAdvancedLogging: true,
    connectionRetryCount: 5,
    connectionTimeout: 10000, // 10秒
    reconnectDelay: 3000      // 3秒
};

module.exports = {
    defaultPLCConfig,
    commonOPCUAServers,
    diagnosticsConfig
}; 
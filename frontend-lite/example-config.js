/**
 * PLC 配置示例
 * 演示如何配置您提到的变量
 */

// 示例1: 在创建PLC时预定义变量
const examplePLCConfig = {
    name: "我的PLC设备",
    endpoint: "opc.tcp://192.168.1.100:4840",
    namespace: null,  // 可以留空，系统会自动发现
    namespaceIndex: 1,
    variables: [
        {
            name: "电源开关",
            nodeId: "ns=1;s=main.power_on",
            description: "主电源控制开关"
        },
        {
            name: "启动演示",
            nodeId: "ns=1;s=main.start_demo",
            description: "启动演示程序"
        }
        // 可以继续添加更多变量...
    ]
};

// 示例2: 常见的节点ID格式
const commonNodeIdFormats = {
    // 字符串标识符 (最常用)
    stringIdentifier: "ns=1;s=main.power_on",

    // 数值标识符
    numericIdentifier: "ns=1;i=1001",

    // GUID标识符
    guidIdentifier: "ns=1;g=12345678-1234-1234-1234-123456789abc",

    // 字节字符串标识符
    byteStringIdentifier: "ns=1;b=aGVsbG8="
};

// 示例3: 如何在前端界面中添加这些变量
const frontendSteps = `
1. 点击 "添加 PLC" 按钮
2. 填写基本信息:
   - PLC 名称: "我的PLC设备"
   - OPC UA 端点: "opc.tcp://192.168.1.100:4840"
   - 命名空间索引: 1
3. 在预定义变量部分:
   - 点击 "添加变量" 按钮
   - 变量名称: "电源开关"
   - 节点ID: "ns=1;s=main.power_on"
   - 描述: "主电源控制开关"
   
   - 再次点击 "添加变量" 按钮  
   - 变量名称: "启动演示"
   - 节点ID: "ns=1;s=main.start_demo"
   - 描述: "启动演示程序"
4. 点击 "创建连接"
5. 选择刚创建的PLC并点击 "连接"
6. 系统会自动发现所有变量，包括您预定义的变量
`;

// 示例4: 如果您不想预定义变量，系统也会自动发现
const autoDiscoveryInfo = `
系统现在已经增强了自动发现功能：
- 会递归浏览所有命名空间 (ns=0 到 ns=10)
- 会搜索 Objects, Server, RootFolder 等节点
- 会自动过滤掉系统变量，只显示用户变量
- 支持最大3层深度的递归浏览
- 发现的变量会显示完整的浏览路径

您只需要：
1. 创建PLC连接（不需要预定义变量）
2. 连接PLC
3. 系统会自动发现包括 "main.power_on" 和 "main.start_demo" 在内的所有变量
`;

module.exports = {
    examplePLCConfig,
    commonNodeIdFormats,
    frontendSteps,
    autoDiscoveryInfo
}; 
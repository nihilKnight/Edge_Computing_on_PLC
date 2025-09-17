/**
 * OPC UA PLC 连接测试脚本
 */

const { testConnection, scanEndpoints } = require('./plc-connection-tester');
const { commonOPCUAServers } = require('./config');

// 命令行参数解析
const args = process.argv.slice(2);
const command = args[0] || 'test';
const target = args[1] || (commonOPCUAServers[0] && commonOPCUAServers[0].endpoint);

// 显示测试开始信息
console.log('===== OPC UA 连接测试工具 =====');
console.log('命令:', command);
console.log('目标:', target);
console.log('===============================');

async function main() {
    try {
        switch (command) {
            case 'test':
                // 测试单个连接
                if (!target) {
                    console.error('错误: 请提供要测试的端点URL');
                    console.log('使用方法: node test-connection.js test opc.tcp://server:port');
                    process.exit(1);
                }

                console.log(`正在测试连接到 ${target}...`);
                const result = await testConnection(target);

                // 输出结果
                console.log('===== 测试结果 =====');
                console.log(`状态: ${result.success ? '成功 ✓' : '失败 ✗'}`);
                console.log(`消息: ${result.message}`);

                if (result.success && result.serverInfo) {
                    console.log('服务器信息:');
                    console.log(`  - 产品名称: ${result.serverInfo.productName}`);
                    console.log(`  - 软件版本: ${result.serverInfo.softwareVersion}`);
                    console.log(`  - 服务器状态: ${result.serverInfo.state}`);
                    console.log(`  - 连接时间: ${result.diagnostics.connectionTimeMs}ms`);
                } else if (!result.success && result.diagnostics) {
                    console.log('诊断信息:');
                    console.log(`  - 错误类别: ${result.diagnostics.errorCategory}`);
                    console.log(`  - 建议: ${result.diagnostics.suggestion}`);
                    console.log(`  - 详细错误: ${result.diagnostics.error}`);
                }
                break;

            case 'scan':
                // 扫描多个端口
                const baseUrl = target || 'opc.tcp://localhost';
                console.log(`正在扫描 ${baseUrl} 的可用OPC UA端点...`);

                const scanResult = await scanEndpoints(baseUrl);

                console.log('===== 扫描结果 =====');
                console.log(`状态: ${scanResult.success ? '找到可用端点 ✓' : '未找到可用端点 ✗'}`);
                console.log(`消息: ${scanResult.message}`);

                if (scanResult.results && scanResult.results.length > 0) {
                    console.log('发现的端点:');
                    scanResult.results.forEach((r, i) => {
                        console.log(`\n[${i + 1}] ${r.endpoint}`);
                        console.log(`  - 状态: ${r.success ? '可用 ✓' : '不可用 ✗'}`);
                        if (r.success && r.serverInfo) {
                            console.log(`  - 产品: ${r.serverInfo.productName}`);
                            console.log(`  - 版本: ${r.serverInfo.softwareVersion}`);
                        } else if (r.diagnostics) {
                            console.log(`  - 错误: ${r.diagnostics.errorCategory}`);
                            console.log(`  - 建议: ${r.diagnostics.suggestion}`);
                        }
                    });
                }
                break;

            case 'list':
                // 列出配置的服务器
                console.log('已配置的OPC UA服务器:');
                commonOPCUAServers.forEach((server, i) => {
                    console.log(`[${i + 1}] ${server.name}: ${server.endpoint}`);
                });
                break;

            default:
                console.error(`未知命令: ${command}`);
                console.log('可用命令:');
                console.log('  - test [endpoint]: 测试单个端点');
                console.log('  - scan [baseUrl]: 扫描多个端口');
                console.log('  - list: 列出配置的服务器');
        }
    } catch (err) {
        console.error('测试过程中发生错误:', err);
    }
}

// 运行主函数
main()
    .then(() => console.log('\n测试完成'))
    .catch(err => console.error('执行失败:', err)); 
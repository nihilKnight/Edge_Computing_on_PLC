# OPC UA PLC 动态控制系统

## 简介

这是一个用于动态连接和控制PLC的Web应用，基于OPC UA协议与PLC进行通信。

## 特性

- 动态创建和管理PLC连接
- 自动发现和浏览PLC变量
- 实时变量监控和控制
- 支持多种数据类型的读写操作
- 界面友好、易于操作

## 安装与运行

### 环境要求

- Node.js 14+
- 可以访问的OPC UA服务器

### 安装依赖

```bash
npm install
```

### 启动服务器

```bash
npm start
```

服务器默认运行在 http://localhost:3000

## OPC UA 连接问题诊断

如果遇到OPC UA连接问题（如"client#connect failed, as invalid internal state = connecting"），可以尝试以下步骤：

### 1. 使用连接测试工具

```bash
# 测试单个OPC UA端点
node test-connection.js test opc.tcp://your-plc-server:4840

# 扫描主机上可能的OPC UA端点
node test-connection.js scan opc.tcp://your-plc-server

# 列出配置文件中的服务器
node test-connection.js list
```

### 2. 常见连接问题排查

1. **服务器未运行**：确认OPC UA服务器正在运行且监听指定端口
2. **网络问题**：确保网络连接正常，没有防火墙阻止
3. **地址错误**：检查服务器地址和端口号是否正确
4. **连接状态错误**：尝试重启客户端应用
5. **安全策略不匹配**：检查服务器是否需要特定的安全策略

### 3. 配置文件

可以在 `config.js` 中配置默认PLC连接参数和诊断设置。

## 高级功能

### 变量浏览

系统能够自动发现PLC中的变量，包括：

- 递归浏览变量结构
- 过滤系统变量
- 显示变量数据类型和路径
- 优先发现main路径下的变量

### 变量控制

- 支持布尔值切换
- 数值输入和写入
- 字符串值修改
- 自动刷新变量状态

## 支持的数据类型

- Boolean
- Int16/Int32
- UInt16/UInt32
- Float/Double
- String
- 其他OPC UA标准数据类型 
# AnjiaApp 架构与启动流程（重建版）

> 说明：该文档根据此前对 `anjiaapp`（Flutter + GetX + SightSys SDK）分析结果重建，便于本地保存与回溯。

## 1. 总体分层

```mermaid
flowchart TB
    subgraph UI["UI 层（GetX 页面）"]
      V1["Login / Register / Country"]
      V2["Home / Device / Mine"]
      V3["Device Connect（AP/BLE/QR/LAN）"]
      V4["Value Added（Cloud / Airwallex）"]
    end

    subgraph APP["App 服务层（GetX Service）"]
      S1["AppService"]
      S2["UserService"]
      S3["DeviceService"]
      S4["SessionService"]
      S5["StorageService"]
      S6["DoorbellService"]
    end

    subgraph PLUGIN["Flutter 插件层（sight_sys_plugin）"]
      P1["UserModule"]
      P2["DeviceModule"]
      P3["ActivatorModule"]
      P4["CapabilityModule"]
      P5["Push/ValueAdd Module"]
    end

    subgraph NATIVE["原生 SDK 层（iOS/Android）"]
      N1["UserService（fetchCountries/setCountry）"]
      N2["Device Connect Adapter"]
      N3["Device Management Adapter"]
      N4["Capability / Video / Event"]
      N5["HttpProvider(host/token/uid)"]
    end

    subgraph CLOUD["云端接口"]
      C1["按国家路由 API（api_base_url）"]
      C2["设备/用户/能力/消息接口"]
      C3["媒体与静态资源域名"]
    end

    UI --> APP
    APP --> PLUGIN
    PLUGIN --> NATIVE
    NATIVE --> CLOUD
```

---

## 2. 启动主流程

```mermaid
sequenceDiagram
    participant OS as Mobile OS
    participant MAIN as main.dart
    participant TASK as AppTask.init()
    participant G as GetX Services
    participant U as UserService
    participant SDK as sight_sys_plugin / Native SDK
    participant API as Cloud API

    OS->>MAIN: 启动 Flutter 进程
    MAIN->>MAIN: WidgetsFlutterBinding.ensureInitialized
    MAIN->>TASK: AppTask.init()
    TASK->>G: 注册并初始化 Storage/App/User/Device 等 Service
    TASK->>SDK: 初始化原生适配器
    SDK->>API: 读取用户/国家上下文（如已登录）
    API-->>SDK: 返回用户态与国家配置
    SDK-->>U: currentUser / currentCountry
    U-->>G: 更新会话状态
    MAIN->>MAIN: runApp(GetMaterialApp)
    MAIN->>G: 根据登录态路由首屏
```

---

## 3. 国家与域名路由（关键）

```mermaid
flowchart LR
    A["用户进入登录/注册页"] --> B["调用 fetchCountries(languageCode)"]
    B --> C["返回 Country 列表"]
    C --> D["用户选择国家"]
    D --> E["setCurrentCountry(country)"]
    E --> F["country.apiBaseUrl -> HttpProvider.host"]
    F --> G["后续登录/设备/能力请求全部走该 host"]
```

`Country` 核心字段：

- `countryCode`
- `countryName`
- `phonePrefix`
- `registrationMethod`
- `apiBaseUrl`

---

## 4. 模块职责摘要

- **UserService**：登录、注册、国家选择、会话刷新、token 失效处理  
- **DeviceService**：设备列表/详情、产品信息、重命名、房间归属、能力同步  
- **DeviceConnectController**：统一 AP/BLE/QR/LAN/Direct 连接编排  
- **Doorbell/Push**：消息跳转与门铃场景联动  
- **Value Added**：云存储、支付插件（部分模块有独立环境路由）

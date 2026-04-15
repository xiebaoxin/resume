# AnjiaApp 架构汇总图（Mermaid 重建版）

## A. 全局结构图

```mermaid
flowchart TB
    APP["Flutter App (GetMaterialApp)"] --> ROUTE["GetX Route/Binding"]
    ROUTE --> PAGE_USER["User Pages"]
    ROUTE --> PAGE_DEVICE["Device Pages"]
    ROUTE --> PAGE_MINE["Mine Pages"]
    ROUTE --> PAGE_VALUE["Value Added Pages"]

    APP --> SERVICE["GetX Services"]
    SERVICE --> US["UserService"]
    SERVICE --> DS["DeviceService"]
    SERVICE --> SS["SessionService"]
    SERVICE --> ST["StorageService"]

    SERVICE --> PLUGIN["sight_sys_plugin"]
    PLUGIN --> IOS["SightSys iOS SDK"]
    PLUGIN --> AND["SightSys Android SDK"]

    IOS --> API["Regional Cloud API"]
    AND --> API
```

---

## B. 启动与登录态路由

```mermaid
stateDiagram-v2
    [*] --> AppLaunch
    AppLaunch --> ServiceInit
    ServiceInit --> CheckSession
    CheckSession --> LoggedIn: token valid
    CheckSession --> NotLoggedIn: no token / expired
    LoggedIn --> HomePage
    NotLoggedIn --> LoginPage
    LoginPage --> SelectCountry
    SelectCountry --> DoLogin
    DoLogin --> HomePage: success
```

---

## C. 国家路由与 Host 切换

```mermaid
sequenceDiagram
    participant UI as Country UI
    participant US as UserService
    participant SDK as Native UserService
    participant HP as HttpProvider
    participant API as Cloud

    UI->>US: fetchCountries(languageCode)
    US->>SDK: fetchCountries
    SDK->>API: request country list
    API-->>SDK: Country[]
    SDK-->>US: Country[]
    US-->>UI: 展示国家列表

    UI->>US: setCountry(country)
    US->>SDK: setCurrentCountry(country)
    SDK->>HP: host = country.apiBaseUrl
    HP-->>SDK: host updated
```

---

## D. 设备绑定主链路

```mermaid
flowchart LR
    E["Add Device Entry"] --> S["Scan / Manual Select"]
    S --> T["Detect ConnectType"]
    T --> C["DeviceConnectController"]
    C --> A["startActivate()"]
    A --> P["sight_sys_plugin"]
    P --> N["Native Adapter AP/BLE/QR/LAN"]
    N --> R["ActivatorDevice Result"]
    R --> NM["Set Device Name"]
    NM --> RM["Set Room"]
    RM --> L["Device List Refresh"]
```

---

## E. Value Added 与独立路由提示

```mermaid
flowchart TB
    V["Value Added Module"] --> G1["Cloud Service Goods"]
    V --> G2["Order / Plan"]
    V --> G3["Airwallex Payment"]
    G1 --> RG["DeviceRegionPlugin.getRegion()"]
    RG --> APIR["Region-based Service Routing"]
    G3 --> EXT["Airwallex Independent Env Config"]
```

> 说明：Value Added 某些模块有独立环境配置，可能不完全跟随主业务 `apiBaseUrl`。

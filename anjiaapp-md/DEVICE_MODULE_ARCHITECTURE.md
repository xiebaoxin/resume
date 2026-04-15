# Device 模块架构图（重建版）

## 1. 设备绑定总览

```mermaid
flowchart TB
    ENTRY["扫码/手动添加入口"] --> TYPE["识别连接类型"]
    TYPE --> AP["AP 配网"]
    TYPE --> BLE["BLE 配网"]
    TYPE --> QR["二维码声波/图码配网"]
    TYPE --> LAN["局域网发现绑定"]
    TYPE --> DIRECT["直接绑定（已知设备）"]

    AP --> CTRL["DeviceConnectController"]
    BLE --> CTRL
    QR --> CTRL
    LAN --> CTRL
    DIRECT --> CTRL

    CTRL --> ACT["DeviceActivateController"]
    ACT --> SDK["sight_sys_plugin (Activator/Device Module)"]
    SDK --> NATIVE["iOS/Android Native SDK Adapter"]
    NATIVE --> CLOUD["Cloud API + 厂商通道"]
    CLOUD --> OK["返回 ActivatorDevice / IPCDevice"]
    OK --> SETNAME["SetNameController"]
    SETNAME --> SETROOM["SetRoomController"]
    SETROOM --> DONE["绑定完成并回主设备列表"]
```

---

## 2. 控制器与职责

### DeviceConnectController
- 作为连接流程工厂，按 `DeviceConnectType` 创建对应 `DeviceConnector`
- 统一 `startActivate()/stopActivate()/toNextStep()`

### DeviceActivateController
- 管理激活倒计时与异常处理
- 连接成功后导航到设备命名与房间设置

### SetNameController / SetRoomController
- 分别调用 `DeviceService.renameDevice()` 与 `DeviceService.updateDevice()`
- 将设备信息补全为可展示状态

---

## 3. 设备能力同步流程

```mermaid
sequenceDiagram
    participant UI as Device Detail UI
    participant DS as DeviceService
    participant CS as CapabilityService
    participant SDK as Native Capability Adapter
    participant API as Cloud/Device Channel

    UI->>DS: createCapabilityService(device)
    DS->>CS: 初始化能力服务
    UI->>CS: getCapability(code)
    CS->>SDK: 请求设备能力值
    SDK->>API: 拉取能力数据
    API-->>SDK: 返回 capability payload
    SDK-->>CS: CapabilityData
    CS-->>UI: 刷新页面

    UI->>CS: setCapability(code,data)
    CS->>SDK: 下发控制命令
    SDK->>API: 写入设备能力
    API-->>SDK: ACK/错误码
    SDK-->>CS: 成功或失败
    CS-->>UI: 更新状态/提示
```

---

## 4. 关键风险点（用于后续排查）

- 国家路由未正确设置时，设备绑定会命中错误地域后端
- AP/BLE 依赖原生权限和系统网络状态，错误多在原生层抛出
- 低功耗设备能力读取延迟高，需要先唤醒再同步能力

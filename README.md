# 谢宝新 - 网页版单页简历 (Web Resume)

单页、中英双语、面向 AI 编程相关设计/技术管理岗位的网页简历。纯静态，可本地预览或部署到任意静态服务器。

## 本地预览

1. 用浏览器直接打开 `index.html`：
   - 双击 `index.html`，或
   - 在项目根目录执行：`open index.html`（macOS）或 `start index.html`（Windows）

2. 或使用本地静态服务器（避免部分环境下直接打开导致的 JSON 加载限制）：
   ```bash
   # 若已安装 Python 3
   python3 -m http.server 8080

   # 或若已安装 Node.js 与 npx
   npx serve -l 8080
   ```
   然后在浏览器访问：`http://localhost:8080`

## 功能说明

- **单页**：所有内容在一页内展示，便于 10 秒扫读。
- **中英切换**：点击右上角「English」/「中文」切换语言；当前语言会写入 `localStorage`，下次打开保持。URL 支持 `#en` 直接打开英文版。
- **联系信息复制**：电话、邮箱旁提供「复制」按钮，点击可复制到剪贴板。
- **打印 / 导出 PDF**：使用浏览器「打印」→「另存为 PDF」即可；打印时会隐藏语言切换按钮，并优化分页。

## 项目结构

```
resume-xiebaoxin/
├── index.html                 # 主简历（单页）
├── attachment-portfolio.html   # 附件一：项目案例（中英切换）
├── attachment-detail.html      # 附件二：详细经历与技能（中英切换）
├── css/style.css               # 样式与打印样式
├── js/
│   ├── main.js                 # 主简历：语言切换与数据渲染
│   └── attachment.js           # 附件页：语言切换与数据渲染
├── data/
│   ├── zh.json                 # 主简历中文
│   ├── en.json                 # 主简历英文
│   ├── portfolio-zh.json       # 项目案例中文
│   ├── portfolio-en.json      # 项目案例英文
│   ├── detail-zh.json          # 详细经历中文
│   └── detail-en.json          # 详细经历英文
├── assets/                     # 图片（如 Google Play / App Store 数据截图）
└── README.md
```

主简历底部有「附件」区，可进入**项目案例**、**详细经历与技能**两个附件页；附件页均支持中英文切换，并提供「返回简历」链接。

## 部署到 GitHub Pages（个人简介站点）

本仓库已配置 **GitHub Actions**，推送到 `main` 后会自动部署到 GitHub Pages。

### 一键配置步骤

1. **推送代码**（若尚未推送）：
   ```bash
   cd /Users/a0000/resume-xiebaoxin
   git push -u origin main
   ```

2. **开启 GitHub Pages**：
   - 打开仓库 **Settings** → 左侧 **Pages**。
   - **Build and deployment** 下 **Source** 选 **GitHub Actions**（不要选 “Deploy from a branch”）。
   - 保存后无需其他操作。

3. **触发部署**：
   - 若刚推送，Actions 会自动运行；或到 **Actions** 页签，选择 “Deploy to GitHub Pages” 工作流，点 **Run workflow**。
   - 约一分钟后部署完成，站点地址为：**https://xiebaoxin.github.io/resume/**

之后每次 `git push` 到 `main` 都会自动重新部署。

---

## 部署到其他静态托管

本简历为**纯静态**资源，也可部署到任意支持静态托管的服务器或 CDN：

1. **上传整个文件夹**  
   将 `resume-xiebaoxin` 目录下的全部文件上传到服务器某一目录（如 ` /var/www/resume` 或 `public/resume`），确保 `index.html`、`css/`、`js/`、`data/`、`assets/` 相对路径不变。

2. **使用 rsync / scp 同步（示例）**  
   ```bash
   rsync -avz --delete ./resume-xiebaoxin/ user@your-server:/path/to/web/root/resume/
   ```
   或：
   ```bash
   scp -r ./resume-xiebaoxin/* user@your-server:/path/to/web/root/resume/
   ```

3. **Web 服务器配置**  
   - **Nginx**：将站点 `root` 或 `alias` 指向上述目录即可；无需额外后端。
   - **Apache**：确保 `AllowOverride` 与 `DirectoryIndex index.html` 正确，指向该目录。

4. **访问方式**  
   部署完成后，通过 `https://您的域名/resume/` 或您配置的路径访问即可。若您后续提供具体服务器信息（如 SSH 账号、域名、路径），可再补充一键部署脚本。

## 修改文案

- 中文：编辑 `data/zh.json`。
- 英文：编辑 `data/en.json`。  
保存后刷新页面即可看到变更，无需重新构建。

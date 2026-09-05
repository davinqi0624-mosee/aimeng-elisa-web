# Admin 后台 antd 迁移规范（Ant Design Pro 风格）

目标：`app/admin/**` 全部页面从手写 Tailwind 迁移到 antd 组件，**功能逻辑零改动**，只换呈现层。
主题已在 `components/admin/AntdProvider.tsx` 全局配置（主色 `#177E97`、圆角 6、zh_CN），页面里**不要**再引入 ConfigProvider、antd CSS、主题色 hex。

## 必读范本（先读再动手）

- `app/admin/users/page.tsx` —— 列表页范本（PageHeader + Table + Tag + Popconfirm + App.useApp message）
- `app/admin/login/page.tsx` —— 表单页范本（Card + Form + Input + Button）
- `components/admin/PageHeader.tsx` —— 统一页头

## 硬性规则

1. **逻辑零改动**：所有 fetch 的 URL/method/payload、状态管理、权限判断、确认流程语义必须保持。只改 JSX 与交互反馈组件。
2. 每页顶部保留 `'use client'`。
3. `npx eslint <你改的文件>` 不得比改前**新增** error（改前已存在的 `no-explicit-any` 等历史债保持原样即可，能顺手减少更好）。`npx tsc --noEmit` 必须保持 0 error。
4. SSR 冒烟（dev server 已在 3000 运行，勿重启）：
   `curl -s --noproxy '*' -H 'Cookie: admin_session=dummy' -o /dev/null -w "%{http_code}" http://localhost:3000<路由>` 应为 200。
5. 不改 `app/api/**`、`lib/**`、非 admin 页面。
6. 原页面是深色外壳（text-white/bg-slate-950 之类），新外壳是浅色——所有深色类名、白字假设必须清掉。

## 组件映射

| 旧 | 新 |
|---|---|
| 页头（标题+描述+按钮） | `<PageHeader icon={<XxxOutlined />} title description extra={...} />` |
| 手写表格 div 网格 | `Table`（rowKey/columns/loading/pagination/locale emptyText），列的格式化函数照搬 |
| `<button>` | `Button`（主操作 type="primary"；危险 danger；loading/disabled 原样） |
| `window.confirm` | `Popconfirm`（按钮外包裹）或 `App.useApp().modal.confirm`，文案不变 |
| `window.alert(错误)` | `App.useApp().message.error(...)` |
| 成功提示 | `message.success(...)` |
| `<input>/<textarea>/<select>` | `Input/Input.TextArea/InputNumber/Select/Switch`（**保持受控 value/onChange，不强行改 Form 数据流**；简单登录型表单才用 Form+onFinish） |
| 自定义 Modal 遮罩 div | `Modal`（open/onCancel/footer 自定）或 `Drawer` |
| 状态徽章 span | `Tag`：通过=green / 警告=gold / 失败=volcano / 进行=processing / 中性=default |
| 错误横幅 | `Alert type="error" showIcon` |
| 卡片容器 div | `Card`（默认 bordered；信息密集区 size="small"） |
| Loader2 spinner | `Spin` |
| 空状态文案 | `Table locale={{ emptyText }}` 或 `Empty` |
| lucide-react 图标 | `@ant-design/icons` 同义图标 |

## 其它注意

- `App.useApp()`（`import { App } from 'antd'`）拿 message/modal，不要用 antd 静态方法（React 19）。
- 图片维持原有 `<img>`/next/image 写法不动（避免域名配置问题）。
- 原文件里 `eslint-disable-next-line react-hooks/set-state-in-effect` 注释保留。
- 表格列多时给 Table 加 `scroll={{ x: 900 }}`。
- 上传/下载等自定义行为保留原函数，只换触发按钮外观。
- 文件内注释密度跟随原文件，别加"迁移说明"类注释。

# Picseal Local

一个完全在浏览器本地处理照片的批量相机水印工具，基于 [zhiweio/picseal](https://github.com/zhiweio/picseal) 改造。

照片不会上传到服务器。NAS/Docker 容器只负责提供网页文件，EXIF 读取、预览、水印合成和全尺寸导出均在访问者的浏览器中完成。

## 功能

- 批量添加 JPG、PNG、WebP，并用缩略图队列逐张编辑。
- 经典白底横幅与柔化模糊画布两种样式。
- 柔化模式默认最大模糊强度，兼容横构图与竖构图。
- 全尺寸高质量 JPEG、无损 PNG，以及 ZIP 批量打包。
- 可选保留 JPEG EXIF，并自动校正导出方向与 EXIF 像素尺寸。
- 从 EXIF 读取官方基础机型编号，例如 `ILCE-6700`。
- 直接读取镜头原始焦段，不使用全画幅等效焦段。
- 自动读取光圈、快门、ISO 和拍摄时间，不读取 GPS 位置。
- 字体、字号和粗细保存在当前浏览器，下次打开自动恢复。
- 预览和 Canvas 导出共用布局参数，减少排版偏差与文字截断。

## 本地开发

需要 Node.js 22 和 pnpm 11：

```bash
pnpm install
pnpm run dev
```

Windows 测试电脑也可以双击 `启动Picseal测试版.cmd`，然后访问：

```text
http://127.0.0.1:3000
```

质量检查：

```bash
pnpm run lint
pnpm run check:exif
pnpm run build
```

## Docker 镜像

推送到 `master` 分支后，GitHub Actions 会构建 DS920+ 可用的 `linux/amd64` 镜像并发布到：

```text
ghcr.io/ren8484/picseal-local:latest
```

同时保留 `sha-xxxx` 标签；推送 `v*` Git 标签时还会生成对应版本标签。

GHCR 镜像已公开，无需登录即可拉取。DS920+ 上经过实际验证的 Container
Manager 安装、`3888` 端口转发与更新方法参见
[SYNOLOGY_DOCKER.md](./SYNOLOGY_DOCKER.md)。

## 技术栈

- React 18、TypeScript、Vite 5
- `exifr` 浏览器端 EXIF 解析
- Canvas 全尺寸水印渲染
- JSZip 浏览器端批量打包
- Nginx Alpine 静态容器
- GitHub Actions + GitHub Container Registry

## 隐私与 HTTP

- 原始照片和导出结果不会发送到 NAS 或第三方服务器。
- 项目支持纯 HTTP 部署；公网 HTTP 会被浏览器标记为“不安全”。
- HTTP 环境下普通上传、编辑和导出可用，但 PWA 离线安装能力可能受浏览器限制。

## 上游与许可

- 上游作者：[@Wang Zhiwei](https://github.com/zhiweio)
- 上游仓库：[zhiweio/picseal](https://github.com/zhiweio/picseal)
- 许可证：[MIT](./LICENSE)

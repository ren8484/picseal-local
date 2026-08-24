# 群晖 Container Manager 部署

本文适用于 DS920+，采用 GitHub Container Registry 镜像、纯 HTTP、无反向代理、无 HTTPS、无 `acme.sh`。

## 1. 镜像与准备工作

GHCR 镜像已经公开，群晖可以匿名拉取，不需要 GitHub 用户名、密码或
Personal Access Token：

```text
ghcr.io/ren8484/picseal-local:latest
```

无需在 Container Manager 的“镜像仓库”页面添加 GHCR。该页面依赖仓库搜索
接口，可能对 GHCR 显示“无法连接到存储库”，但不影响项目通过完整镜像地址
直接拉取。

从 GitHub 仓库下载 [`compose.yaml`](./compose.yaml)，并在 File Station 的
`docker` 共享文件夹下建立 `picseal-local` 文件夹。以下路径以存储空间 1 为例：

```text
/volume1/docker/picseal-local
```

## 2. 使用项目部署

1. 打开 Container Manager，进入“项目”，点击“新增”。
2. 项目名称填写 `picseal-local`。
3. 路径选择 `/volume1/docker/picseal-local`。
4. 来源选择“上传 docker-compose.yml”。
5. 浏览并上传下载好的 `compose.yaml`。
6. 点击“下一步”，确认后建立项目。

部署文件的主要内容如下：

```yaml
services:
  picseal:
    image: ghcr.io/ren8484/picseal-local:latest
    container_name: picseal
    ports:
      - '${PICSEAL_PORT:-3888}:80'
    restart: unless-stopped
    mem_limit: 256m
    read_only: true
    security_opt:
      - no-new-privileges:true
    tmpfs:
      - /var/cache/nginx
      - /var/run
      - /tmp
```

默认访问地址：

```text
http://NAS-IP:3888
```

该容器不需要照片目录、数据库或其他持久化卷。

如果构建日志显示 `NanoCPUs can not be set`，说明使用了旧版 Compose 文件；
请重新下载当前 `compose.yaml`。DS920+ 实测版本已移除不兼容的 `cpus` 设置。

如果日志显示 `driver failed programming external connectivity`，通常表示主机
端口已被占用。当前默认使用实测空闲的 `3888`；如需更换，可修改端口映射中
冒号左侧的数字，例如 `'3988:80'`。

## 3. 公网端口转发

1. 给 NAS 设置固定内网 IP。
2. 在 DSM 防火墙允许 TCP `3888`。
3. 路由器把公网 TCP `3888` 转发到 NAS 的 TCP `3888`。
4. 在阿里云 DNS 添加 A 记录，指向家庭公网 IPv4。
5. 使用 `http://你的域名:3888` 访问。

如果家庭宽带没有公网 IPv4 或处于运营商 CGNAT 后方，普通 IPv4 端口转发将无法从公网访问。

## 4. 更新与回退

更新：

1. 将新代码推送到 `master`。
2. 等待 GitHub Actions 构建成功。
3. 在 Container Manager 的“映像”中重新拉取 `latest`，或在项目中执行重新构建。
4. 确认项目重新建立并恢复为绿色运行状态。

回退时，把 Compose 的镜像标签从 `latest` 改为以前的 `sha-xxxx` 或 `v*` 标签，再重新创建容器。

## 5. 资源需求

运行时只有 Nginx 提供静态文件，建议限制为：

- 内存：256 MB
- 日志：单文件 10 MB，保留 3 个

DS920+ 的 Docker 内核环境可能不支持 Compose 的 `cpus`/`NanoCPUs`
限制，因此部署文件不设置 CPU 硬限额。静态页面服务在空闲时几乎不占用 CPU。

照片处理发生在电脑或手机浏览器中，不消耗 NAS 的图片渲染资源。

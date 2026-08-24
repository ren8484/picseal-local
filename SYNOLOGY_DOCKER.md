# 群晖 Container Manager 部署

本文适用于 DS920+，采用 GitHub Container Registry 镜像、纯 HTTP、无反向代理、无 HTTPS、无 `acme.sh`。

## 1. 获取私有 GHCR 镜像

当前 GitHub 仓库为私有仓库，因此首次发布的 GHCR 镜像也按私有镜像处理。群晖需要一个只具备读取软件包权限的 GitHub Personal Access Token：

- 用户名：`ren8484`
- Registry：`ghcr.io`
- Token 权限：`read:packages`

不要把 Token 写入 Compose 文件或提交到 GitHub。

在 Container Manager 的“镜像仓库”中添加 GHCR 登录信息，然后拉取：

```text
ghcr.io/ren8484/picseal-local:latest
```

如果以后将 GHCR 软件包改为公开，群晖即可匿名拉取，不再需要 Token。

## 2. 使用项目部署

在 Container Manager 中打开“项目”，新建项目并使用仓库中的 `compose.yaml`：

```yaml
services:
  picseal:
    image: ghcr.io/ren8484/picseal-local:latest
    container_name: picseal
    ports:
      - '${PICSEAL_PORT:-8188}:80'
    restart: unless-stopped
    mem_limit: 256m
    cpus: 0.5
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
http://NAS-IP:8188
```

该容器不需要照片目录、数据库或其他持久化卷。

## 3. 公网端口转发

1. 给 NAS 设置固定内网 IP。
2. 在 DSM 防火墙允许 TCP `8188`。
3. 路由器把公网 TCP `8188` 转发到 NAS 的 TCP `8188`。
4. 在阿里云 DNS 添加 A 记录，指向家庭公网 IPv4。
5. 使用 `http://你的域名:8188` 访问。

如果家庭宽带没有公网 IPv4 或处于运营商 CGNAT 后方，普通 IPv4 端口转发将无法从公网访问。

## 4. 更新与回退

更新：

1. 将新代码推送到 `master`。
2. 等待 GitHub Actions 构建成功。
3. 群晖重新拉取 `latest` 镜像。
4. 在 Container Manager 中重新创建项目容器。

回退时，把 Compose 的镜像标签从 `latest` 改为以前的 `sha-xxxx` 或 `v*` 标签，再重新创建容器。

## 5. 资源需求

运行时只有 Nginx 提供静态文件，建议限制为：

- CPU：0.5 核
- 内存：256 MB
- 日志：单文件 10 MB，保留 3 个

照片处理发生在电脑或手机浏览器中，不消耗 NAS 的图片渲染资源。

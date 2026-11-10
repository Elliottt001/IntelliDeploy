# 受控执行节点

使用独立Linux执行节点，Docker/Compose、BuildKit、crane及ext4工具由管理员准备。项目代码只能在受限容器执行；控制面API不挂Docker socket，应用容器不接触runner证书/服务端令牌/registry管理凭据。

从仓库根启动（真实值保存在节点私有环境文件，文件权限600）：

```bash
PYTHONPATH=backend .venv/bin/python -m app.runner.service
```

节点要求RUNNER_SERVER_CERT/RUNNER_SERVER_KEY/RUNNER_CLIENT_CA/RUNNER_RPC_TOKEN、固定digest的AGENT_EXECUTOR_IMAGE、CANDIDATE_DOMAIN_SUFFIX。RUNNER_WORKSPACE_ROOT默认/var/lib/intellideploy-runner；RUNNER_WORKSPACE_LIMIT_MB默认1024，每job用持久ext4镜像约束磁盘，可信runner需要Linux挂载权限。用户代码仍以10001运行，无能力、只读根、CPU/内存/进程/墙钟限制。

RPC监听9443，要求mTLS和服务端令牌；候选入口9877由独立Caddy/Ingress及真实TLS承载，通配候选域名指向入口，不能将需要client cert的RPC端点当浏览器入口。临候选有TTL及独立数据/凭据，逾期清理仅针对临候选，不删除生产实例。

安装依赖可登记RUNNER_DEPENDENCY_NETWORK（必须Docker internal）及RUNNER_DEPENDENCY_PROXY，直接外网被关闭。候选服务的联网能力使用登记的RUNTIME_PROXY_IMAGE，镜像源为Dockerfile.gateway（从仓库根构建），连接自己的internal网络及代理出站网络；代理只允许登记域名。应用能力使用PLATFORM_CAPABILITY_URL及实例凭据，不携带共享DeepSeek Key。生产前需完成节点网络/元数据阻断和磁盘配额演练，本机协议测试不能替代。

控制面配置RUNNER_URL（HTTPS）、RUNNER_CA_FILE/RUNNER_CERT_FILE/RUNNER_KEY_FILE及RUNNER_RPC_TOKEN，代码自动构造默认Worker依赖；配置不完整时保存明确失败，不进入模拟链路。BUILD_REGISTRY和registry推拉权限在节点配置，BuildKit与目标均需使用Linux amd64产物。

真实资源目前未交接，节点安装、mTLS和DNS/TLS演练、两云实际交付保持NOT_RUN。

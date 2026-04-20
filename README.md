# IntelliDeploy

## 项目简介
本项目由两个部分组成：
- `backend/`：基于 FastAPI 的后端服务
- `frontend/`：基于 Expo + React Native 的前端项目

## 环境要求
请先确保本机已安装以下工具：
- Python 3.13 或兼容版本
- Node.js 24 或兼容版本
- npm 11 或兼容版本

## 项目结构
```text
intelli/
├─ backend/
└─ frontend/
```

## 一、后端环境配置与启动
后端使用 Python 虚拟环境运行。

### 1. 进入后端目录
```bash
cd backend
```

### 2. 创建虚拟环境
```bash
python -m venv .venv
```

### 3. 激活虚拟环境
Windows:
```bash
.venv/Scripts/activate
```

### 4. 安装依赖
```bash
python -m pip install -r requirements.txt
```

### 5. 启动后端服务
```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 9000
```

### 6. 验证后端是否启动成功
浏览器访问：
```text
http://127.0.0.1:9000
```

如果启动成功，会返回：
```json
{"message":"IntelliDeploy API is running"}
```

## 二、前端环境配置与启动
前端使用 npm 管理依赖。

### 1. 进入前端目录
```bash
cd frontend
```

### 2. 安装依赖
```bash
npm install
```

### 3. 启动 Web 版本
```bash
npm run web
```

启动成功后，通常可在浏览器访问：
```text
http://127.0.0.1:8081
```

### 4. 启动其他平台
启动 Expo 开发服务：
```bash
npm start
```

启动 Android：
```bash
npm run android
```

启动 iOS：
```bash
npm run ios
```

## 三、接口地址说明
前端当前接口地址写在：
- `frontend/services/api.ts`

当前配置为：
```ts
const API_BASE_URL = 'http://localhost:9000';
```

说明：
- 如果前端和后端都在同一台电脑上运行，并使用浏览器访问前端，通常无需修改。
- 如果使用手机真机调试，需要把 `localhost` 改成你电脑在局域网中的 IP 地址。

## 四、默认配置说明
后端环境变量文件：
- `backend/.env`

当前包含：
- `SECRET_KEY`
- `DATABASE_URL`
- `ACCESS_TOKEN_EXPIRE_MINUTES`

默认数据库为本地 SQLite：
```text
sqlite:///./intellideploy.db
```

如果需要更高并发写入，可切换到 PostgreSQL（推荐生产环境）：
```text
postgresql+psycopg://postgres:your_password@127.0.0.1:5432/intellideploy
```

切换方式：修改 `backend/.env` 里的 `DATABASE_URL`，并重新安装后端依赖。

后端首次启动时会自动创建数据库表。

## 五、常见问题
### 1. 后端启动了，但注册时报 bcrypt 相关错误
项目依赖中已固定：
```text
bcrypt==4.0.1
```

如果依赖异常，可重新执行：
```bash
python -m pip install -r requirements.txt
```

### 2. 前端请求不到后端
请检查：
- 后端是否已运行在 `127.0.0.1:9000`
- `frontend/services/api.ts` 中的 `API_BASE_URL` 是否正确

### 3. 手机无法访问本地后端
如果使用真机调试：
- 不要使用 `localhost`
- 改为电脑局域网 IP，例如：`http://192.168.x.x:9000`

## 六、推荐启动顺序
先启动后端：
```bash
cd backend
python -m venv .venv
.venv/Scripts/activate
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 9000
```

再启动前端：
```bash
cd frontend
npm install
npm run web
```

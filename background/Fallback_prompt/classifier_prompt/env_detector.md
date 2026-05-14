
文件：classifier/env_detector.py

功能

- 从源码、README、.env.example、docker-compose 中提取环境变量。
- 输出结构必须能直接映射到下游接口 C 的 required_envs 子结构。
- 防止后续模块或 LLM 产生“幻觉环境变量”。

上游信息接口
输入来自：

- key_files
- file_tree
- runtime_chain_observations
- README_summary（如存在）

下游信息接口
输出既给 extract_facts.py，也要可直接映射到下游接口 C：
{
  "detected_env_vars": [],
  "env_var_sources": {},
  "env_var_details": [],
  "env_warnings": []
}

其中 env_var_details 的每一项必须兼容：

- name
- required
- example_value
- description
- source

必须实现的函数

1. detect_env_vars(...)
2. build_env_var_details(...)
3. to_required_envs_payload(...)

实现

1. 提取来源：
   - JavaScript / TypeScript：
     process.env.X
     import.meta.env.X
   - Python：
     os.environ["X"]
     os.environ.get("X")
     getenv("X")
   - .env.example：
     直接提取变量名和示例值
   - docker-compose：
     environment 字段
   - README：
     只有明确写成环境变量名时才提取
2. 输出三层结构：
   - detected_env_vars：纯变量名数组
   - env_var_sources：变量名 -> 来源
   - env_var_details：结构化详情
3. source 规则：
   - DETECTED：变量名直接出现在输入中
   - ASSUMED：只有运行链路强依赖某类配置但输入未给变量名时，极少量允许
4. 对 ASSUMED 的要求：
   - 数量必须极少
   - 必须同时加入 env_warnings
   - 默认不能直接进入部署
5. description 规则：
   - README 或注释里有明确用途就填
   - 没有则 null
6. example_value 规则：
   - 优先取 .env.example
   - 没有则 null
7. 必须实现 `to_required_envs_payload`：
   - 把 env_var_details 直接转换成下游接口 C 的 required_envs
   - 不做二次推断
   - 不改字段名

注意

- 不允许凭空新增环境变量。
- 不要把 README 的模糊描述变成变量名。
- 不做 deploy_ready 判断。
- 不做分类。

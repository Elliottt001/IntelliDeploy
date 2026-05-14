
文件：classifier/package_manager_detector.py

功能

- 根据文件树和关键依赖文件，判断仓库使用的包管理器。
- 输出 package_manager、dependency_files、lock_files、warnings。
- 这是纯规则模块，完全不依赖 AI。

上游信息接口
输入只来自上游仓库材料：

- file_tree
- key_files 中的：
  - package.json
  - requirements.txt
  - pyproject.toml
  - pom.xml
  - go.mod
  - Cargo.toml
  - composer.json
  - Gemfile
  - package-lock.json
  - pnpm-lock.yaml
  - yarn.lock
  - poetry.lock
  - uv.lock

下游信息接口
输出给 extract_facts.py：
{
  "package_manager": "npm | pnpm | yarn | pip | poetry | uv | maven | gradle | go | cargo | composer | bundler | unknown",
  "dependency_files": [],
  "lock_files": [],
  "package_manager_confidence": "high | medium | low",
  "warnings": []
}

同时要求 package_manager 可直接映射到下游接口 A 的：

- repo_profile.package_manager

必须实现的函数

1. detect_package_manager(file_tree, key_files) -> dict
2. collect_dependency_files(file_tree, key_files) -> list[str]
3. collect_lock_files(file_tree, key_files) -> list[str]

实现

1. 先收集依赖文件和 lock 文件。
2. 依赖文件识别：
   - package.json
   - requirements.txt
   - pyproject.toml
   - pom.xml
   - build.gradle
   - build.gradle.kts
   - go.mod
   - Cargo.toml
   - composer.json
   - Gemfile
3. lock 文件识别：
   - package-lock.json
   - pnpm-lock.yaml
   - yarn.lock
   - poetry.lock
   - uv.lock
4. 判断规则：
   - package-lock.json -> npm
   - pnpm-lock.yaml -> pnpm
   - yarn.lock -> yarn
   - requirements.txt -> pip
   - pyproject.toml + poetry.lock -> poetry
   - pyproject.toml + uv.lock -> uv
   - pom.xml -> maven
   - build.gradle / build.gradle.kts -> gradle
   - go.mod -> go
   - Cargo.toml -> cargo
   - composer.json -> composer
   - Gemfile -> bundler
5. package.json 存在但无 lock 文件时：
   - package_manager = npm
   - confidence = low
   - warnings 增加 missing_node_lockfile
6. requirements.txt 与 pyproject.toml 同时存在时：
   - 不要二选一覆盖
   - dependency_files 保留两个
   - warnings 增加 multi_python_dependency_definition
7. 多个生态并存时：
   - 输出主要候选
   - warnings 增加 multi_package_manager_detected

注意

- 禁止调用 AI。
- 禁止根据 README 猜包管理器。
- 禁止凭空假设 lock 文件存在。
- 输出必须完全由输入文件决定。

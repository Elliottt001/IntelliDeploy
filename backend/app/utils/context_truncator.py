"""
智能上下文截断器

用于从仓库中提取关键文件,避免将整个仓库都传给模型
"""
import os
import re
from typing import List, Dict, Optional, Set
from pathlib import Path


class ContextTruncator:
    """智能上下文截断器"""

    # 关键文件模式
    KEY_FILES = [
        # 依赖文件
        "package.json",
        "package-lock.json",
        "yarn.lock",
        "pnpm-lock.yaml",
        "requirements.txt",
        "Pipfile",
        "Pipfile.lock",
        "poetry.lock",
        "pyproject.toml",
        "go.mod",
        "go.sum",
        "pom.xml",
        "build.gradle",
        "Gemfile",
        "Gemfile.lock",
        "Cargo.toml",
        "Cargo.lock",
        # 配置文件
        "Dockerfile",
        "docker-compose.yml",
        "docker-compose.yaml",
        ".dockerignore",
        # 文档
        "README.md",
        "README.txt",
        "README",
        # 配置
        ".env.example",
        "config.json",
        "config.yaml",
        "config.yml",
        "tsconfig.json",
        ".eslintrc.js",
        ".eslintrc.json",
    ]

    # 入口文件模式
    ENTRY_PATTERNS = [
        r"^main\.py$",
        r"^app\.py$",
        r"^server\.py$",
        r"^index\.js$",
        r"^index\.ts$",
        r"^app\.js$",
        r"^app\.ts$",
        r"^server\.js$",
        r"^server\.ts$",
        r"^main\.go$",
        r"^Main\.java$",
        r"^Application\.java$",
    ]

    # 忽略的目录
    IGNORE_DIRS = {
        "node_modules",
        ".git",
        ".venv",
        "venv",
        "env",
        "__pycache__",
        ".pytest_cache",
        "dist",
        "build",
        "target",
        ".idea",
        ".vscode",
        "coverage",
        ".next",
        ".nuxt",
    }

    def __init__(self, repo_path: str):
        """
        初始化截断器

        Args:
            repo_path: 仓库根目录路径
        """
        self.repo_path = Path(repo_path)
        if not self.repo_path.exists():
            raise ValueError(f"Repository path does not exist: {repo_path}")

    def extract_key_files(self, max_files: int = 20) -> Dict[str, str]:
        """
        提取关键文件内容

        Args:
            max_files: 最多提取的文件数量

        Returns:
            Dict[str, str]: 文件路径 -> 文件内容的映射
        """
        key_files = {}
        file_count = 0

        # 1. 提取根目录的关键文件
        for filename in self.KEY_FILES:
            file_path = self.repo_path / filename
            if file_path.exists() and file_path.is_file():
                try:
                    content = file_path.read_text(encoding="utf-8", errors="ignore")
                    key_files[str(file_path.relative_to(self.repo_path))] = content
                    file_count += 1
                    if file_count >= max_files:
                        return key_files
                except Exception:
                    continue

        # 2. 查找入口文件
        entry_files = self._find_entry_files()
        for file_path in entry_files:
            if file_count >= max_files:
                break
            try:
                content = file_path.read_text(encoding="utf-8", errors="ignore")
                key_files[str(file_path.relative_to(self.repo_path))] = content
                file_count += 1
            except Exception:
                continue

        return key_files

    def _find_entry_files(self) -> List[Path]:
        """查找入口文件"""
        entry_files = []

        for root, dirs, files in os.walk(self.repo_path):
            # 过滤忽略的目录
            dirs[:] = [d for d in dirs if d not in self.IGNORE_DIRS]

            for filename in files:
                # 检查是否匹配入口文件模式
                for pattern in self.ENTRY_PATTERNS:
                    if re.match(pattern, filename):
                        entry_files.append(Path(root) / filename)
                        break

        return entry_files

    def extract_repo_profile(self) -> Dict:
        """
        提取仓库概要信息

        Returns:
            Dict: 仓库概要信息
        """
        profile = {
            "detected_languages": self._detect_languages(),
            "detected_frameworks": self._detect_frameworks(),
            "package_manager": self._detect_package_manager(),
            "entrypoints": self._find_entrypoints(),
            "dependency_files": self._find_dependency_files(),
            "has_valid_dockerfile": self._has_dockerfile(),
            "readme_summary": self._extract_readme_summary(),
        }
        return profile

    def _detect_languages(self) -> List[str]:
        """检测编程语言"""
        languages = set()

        # 通过文件扩展名检测
        extension_map = {
            ".py": "Python",
            ".js": "JavaScript",
            ".ts": "TypeScript",
            ".go": "Go",
            ".java": "Java",
            ".rb": "Ruby",
            ".php": "PHP",
            ".rs": "Rust",
            ".cpp": "C++",
            ".c": "C",
            ".cs": "C#",
        }

        for root, dirs, files in os.walk(self.repo_path):
            dirs[:] = [d for d in dirs if d not in self.IGNORE_DIRS]

            for filename in files:
                ext = Path(filename).suffix
                if ext in extension_map:
                    languages.add(extension_map[ext])

        return sorted(list(languages))

    def _detect_frameworks(self) -> List[str]:
        """检测框架"""
        frameworks = []

        # 检查 package.json
        package_json = self.repo_path / "package.json"
        if package_json.exists():
            try:
                import json
                data = json.loads(package_json.read_text(encoding="utf-8"))
                deps = {**data.get("dependencies", {}), **data.get("devDependencies", {})}

                if "react" in deps:
                    frameworks.append("React")
                if "next" in deps:
                    frameworks.append("Next.js")
                if "vue" in deps:
                    frameworks.append("Vue")
                if "express" in deps:
                    frameworks.append("Express")
                if "fastify" in deps:
                    frameworks.append("Fastify")
            except Exception:
                pass

        # 检查 requirements.txt
        requirements = self.repo_path / "requirements.txt"
        if requirements.exists():
            try:
                content = requirements.read_text(encoding="utf-8").lower()
                if "django" in content:
                    frameworks.append("Django")
                if "flask" in content:
                    frameworks.append("Flask")
                if "fastapi" in content:
                    frameworks.append("FastAPI")
            except Exception:
                pass

        return frameworks

    def _detect_package_manager(self) -> Optional[str]:
        """检测包管理器"""
        if (self.repo_path / "pnpm-lock.yaml").exists():
            return "pnpm"
        if (self.repo_path / "yarn.lock").exists():
            return "yarn"
        if (self.repo_path / "package-lock.json").exists():
            return "npm"
        if (self.repo_path / "poetry.lock").exists():
            return "poetry"
        if (self.repo_path / "Pipfile").exists():
            return "pip"
        if (self.repo_path / "go.mod").exists():
            return "go"
        if (self.repo_path / "pom.xml").exists():
            return "maven"
        if (self.repo_path / "build.gradle").exists():
            return "gradle"
        return None

    def _find_entrypoints(self) -> List[str]:
        """查找入口文件"""
        entry_files = self._find_entry_files()
        return [str(f.relative_to(self.repo_path)) for f in entry_files]

    def _find_dependency_files(self) -> List[str]:
        """查找依赖文件"""
        dep_files = []
        for filename in self.KEY_FILES:
            file_path = self.repo_path / filename
            if file_path.exists() and file_path.is_file():
                dep_files.append(filename)
        return dep_files

    def _has_dockerfile(self) -> bool:
        """检查是否有 Dockerfile"""
        return (self.repo_path / "Dockerfile").exists()

    def _extract_readme_summary(self, max_length: int = 500) -> Optional[str]:
        """提取 README 摘要"""
        for readme_name in ["README.md", "README.txt", "README"]:
            readme_path = self.repo_path / readme_name
            if readme_path.exists():
                try:
                    content = readme_path.read_text(encoding="utf-8", errors="ignore")
                    # 只取前 max_length 个字符
                    summary = content[:max_length]
                    if len(content) > max_length:
                        summary += "..."
                    return summary
                except Exception:
                    continue
        return None


def extract_context_from_repo(repo_path: str, max_files: int = 20) -> Dict:
    """
    从仓库中提取上下文信息

    Args:
        repo_path: 仓库路径
        max_files: 最多提取的文件数量

    Returns:
        Dict: 包含关键文件和仓库概要的字典
    """
    truncator = ContextTruncator(repo_path)

    return {
        "key_files": truncator.extract_key_files(max_files=max_files),
        "repo_profile": truncator.extract_repo_profile(),
    }

"""
错误日志降噪清洗工具

用于从部署失败的原始日志中提取关键错误信息
"""
import re
from typing import Dict, List, Optional, Tuple


class LogSanitizer:
    """日志清洗器"""

    # 错误关键词模式
    ERROR_PATTERNS = [
        r"ERROR:.*",
        r"Error:.*",
        r"error:.*",
        r"FATAL:.*",
        r"Fatal:.*",
        r"Exception:.*",
        r"Traceback.*",
        r"npm ERR!.*",
        r"yarn error.*",
        r"pip.*error.*",
        r"ModuleNotFoundError:.*",
        r"ImportError:.*",
        r"SyntaxError:.*",
        r"TypeError:.*",
        r"ValueError:.*",
        r"KeyError:.*",
        r"AttributeError:.*",
        r"FileNotFoundError:.*",
        r"PermissionError:.*",
        r"ConnectionError:.*",
        r"TimeoutError:.*",
    ]

    # 依赖缺失模式
    DEPENDENCY_PATTERNS = [
        r"ModuleNotFoundError: No module named '(\w+)'",
        r"ImportError: cannot import name '(\w+)'",
        r"Error: Cannot find module '([\w\-@/]+)'",
        r"npm ERR! 404.*'([\w\-@/]+)'",
        r"Could not find a version that satisfies the requirement (\w+)",
        r"No matching distribution found for (\w+)",
    ]

    # 端口相关错误
    PORT_PATTERNS = [
        r"Address already in use.*:(\d+)",
        r"Port (\d+) is already in use",
        r"EADDRINUSE.*:(\d+)",
        r"bind: address already in use.*:(\d+)",
    ]

    # 启动命令错误
    START_COMMAND_PATTERNS = [
        r"command not found: (\w+)",
        r"sh: (\w+): not found",
        r"bash: (\w+): command not found",
        r"No such file or directory: '([\w\./]+)'",
    ]

    # 噪音模式(需要过滤的)
    NOISE_PATTERNS = [
        r"^\s*$",  # 空行
        r"^-+$",  # 分隔线
        r"^=+$",
        r"^\[.*\]\s*$",  # 只有时间戳的行
        r"^Downloading.*",  # 下载进度
        r"^Collecting.*",  # pip收集包
        r"^Installing.*",  # 安装进度
        r"^\d+%.*",  # 百分比进度
    ]

    def __init__(self, max_context_lines: int = 10):
        """
        初始化清洗器

        Args:
            max_context_lines: 错误上下文最多保留的行数
        """
        self.max_context_lines = max_context_lines

    def sanitize_log(self, raw_log: str) -> str:
        """
        清洗日志

        Args:
            raw_log: 原始日志

        Returns:
            str: 清洗后的日志摘要
        """
        lines = raw_log.split("\n")

        # 1. 查找错误行
        error_indices = self._find_error_lines(lines)

        if not error_indices:
            # 如果没有找到明确的错误,返回最后几行
            return "\n".join(lines[-self.max_context_lines:])

        # 2. 提取错误上下文
        sanitized_lines = []
        for error_idx in error_indices:
            context = self._extract_context(lines, error_idx)
            sanitized_lines.extend(context)

        # 3. 去重并过滤噪音
        unique_lines = []
        seen = set()
        for line in sanitized_lines:
            if line not in seen and not self._is_noise(line):
                unique_lines.append(line)
                seen.add(line)

        return "\n".join(unique_lines)

    def extract_error_info(self, raw_log: str) -> Dict:
        """
        提取错误信息

        Args:
            raw_log: 原始日志

        Returns:
            Dict: 包含错误类型、缺失依赖等信息
        """
        info = {
            "error_type": None,
            "missing_dependencies": [],
            "port_conflicts": [],
            "missing_commands": [],
            "sanitized_log": self.sanitize_log(raw_log),
        }

        # 检测依赖缺失
        for pattern in self.DEPENDENCY_PATTERNS:
            matches = re.findall(pattern, raw_log)
            info["missing_dependencies"].extend(matches)

        # 检测端口冲突
        for pattern in self.PORT_PATTERNS:
            matches = re.findall(pattern, raw_log)
            info["port_conflicts"].extend(matches)

        # 检测命令缺失
        for pattern in self.START_COMMAND_PATTERNS:
            matches = re.findall(pattern, raw_log)
            info["missing_commands"].extend(matches)

        # 推断错误类型
        info["error_type"] = self._infer_error_type(info)

        return info

    def _find_error_lines(self, lines: List[str]) -> List[int]:
        """查找包含错误的行号"""
        error_indices = []

        for i, line in enumerate(lines):
            for pattern in self.ERROR_PATTERNS:
                if re.search(pattern, line, re.IGNORECASE):
                    error_indices.append(i)
                    break

        return error_indices

    def _extract_context(self, lines: List[str], error_idx: int) -> List[str]:
        """提取错误上下文"""
        start = max(0, error_idx - self.max_context_lines // 2)
        end = min(len(lines), error_idx + self.max_context_lines // 2 + 1)
        return lines[start:end]

    def _is_noise(self, line: str) -> bool:
        """判断是否为噪音行"""
        for pattern in self.NOISE_PATTERNS:
            if re.match(pattern, line):
                return True
        return False

    def _infer_error_type(self, info: Dict) -> Optional[str]:
        """推断错误类型"""
        if info["missing_dependencies"]:
            return "DEPENDENCY_MISSING"
        if info["port_conflicts"]:
            return "PORT_MISMATCH"
        if info["missing_commands"]:
            return "START_COMMAND_INVALID"
        return None


class BuildLogAnalyzer:
    """构建日志分析器"""

    def __init__(self):
        self.sanitizer = LogSanitizer()

    def analyze_build_failure(self, build_log: str) -> Dict:
        """
        分析构建失败日志

        Args:
            build_log: 构建日志

        Returns:
            Dict: 分析结果
        """
        error_info = self.sanitizer.extract_error_info(build_log)

        return {
            "failed_stage": "BUILD",
            "error_type": error_info["error_type"],
            "sanitized_error_log": error_info["sanitized_log"],
            "missing_dependencies": error_info["missing_dependencies"],
            "suggestions": self._generate_suggestions(error_info),
        }

    def analyze_runtime_failure(self, runtime_log: str) -> Dict:
        """
        分析运行时失败日志

        Args:
            runtime_log: 运行时日志

        Returns:
            Dict: 分析结果
        """
        error_info = self.sanitizer.extract_error_info(runtime_log)

        return {
            "failed_stage": "RUN",
            "error_type": error_info["error_type"],
            "sanitized_error_log": error_info["sanitized_log"],
            "port_conflicts": error_info["port_conflicts"],
            "missing_commands": error_info["missing_commands"],
            "suggestions": self._generate_suggestions(error_info),
        }

    def analyze_healthcheck_failure(
        self, healthcheck_log: str, status_code: Optional[int] = None
    ) -> Dict:
        """
        分析健康检查失败日志

        Args:
            healthcheck_log: 健康检查日志
            status_code: HTTP状态码

        Returns:
            Dict: 分析结果
        """
        error_info = self.sanitizer.extract_error_info(healthcheck_log)

        return {
            "failed_stage": "HEALTHCHECK",
            "error_type": "HEALTHCHECK_FAILED",
            "sanitized_error_log": error_info["sanitized_log"],
            "status_code": status_code,
            "suggestions": self._generate_healthcheck_suggestions(status_code),
        }

    def _generate_suggestions(self, error_info: Dict) -> List[str]:
        """生成修复建议"""
        suggestions = []

        if error_info["missing_dependencies"]:
            deps = ", ".join(error_info["missing_dependencies"][:3])
            suggestions.append(f"Install missing dependencies: {deps}")

        if error_info["port_conflicts"]:
            ports = ", ".join(error_info["port_conflicts"][:3])
            suggestions.append(f"Change conflicting ports: {ports}")

        if error_info["missing_commands"]:
            cmds = ", ".join(error_info["missing_commands"][:3])
            suggestions.append(f"Install missing commands: {cmds}")

        return suggestions

    def _generate_healthcheck_suggestions(self, status_code: Optional[int]) -> List[str]:
        """生成健康检查修复建议"""
        suggestions = []

        if status_code == 404:
            suggestions.append("Check if healthcheck path is correct")
        elif status_code == 500:
            suggestions.append("Application may have internal errors")
        elif status_code is None:
            suggestions.append("Service may not be listening on the expected port")

        return suggestions


def sanitize_deployment_log(raw_log: str, failed_stage: str) -> Dict:
    """
    清洗部署日志的便捷函数

    Args:
        raw_log: 原始日志
        failed_stage: 失败阶段 (BUILD/RUN/HEALTHCHECK)

    Returns:
        Dict: 清洗后的日志信息
    """
    analyzer = BuildLogAnalyzer()

    if failed_stage == "BUILD":
        return analyzer.analyze_build_failure(raw_log)
    elif failed_stage == "RUN":
        return analyzer.analyze_runtime_failure(raw_log)
    elif failed_stage == "HEALTHCHECK":
        return analyzer.analyze_healthcheck_failure(raw_log)
    else:
        # 默认使用基础清洗
        sanitizer = LogSanitizer()
        return {
            "failed_stage": failed_stage,
            "sanitized_error_log": sanitizer.sanitize_log(raw_log),
        }

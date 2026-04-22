from pydantic import BaseModel, Field
from typing import List

class DiagnosisResult(BaseModel):
    # 补全了所有在 Prompt 中要求的字段
    error_type: str = Field(..., description="错误的类别，如 DockerfileError, DependencyError")
    root_cause: str = Field(..., description="对报错日志的简短根因分析")
    suggested_components: List[str] = Field(..., description="建议修改的组件列表")
    key_component: str = Field(..., description="核心出错组件")
    confidence: float = Field(..., description="诊断置信度 (0.0 到 1.0)")
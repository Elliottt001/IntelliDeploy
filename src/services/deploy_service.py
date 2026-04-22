import os
from dotenv import load_dotenv
from src.agents.llm_client import LLMClient
from src.agents.parsers import ErrorParser # 假设路径如此
from src.agents.schemas import DiagnosisResult

# 1. 加载配置
load_dotenv()

# 2. 实例化真正的 LLM 客户端
# 这个实例会被注入到各个组件中
llm_instance = LLMClient(
    api_key=os.getenv("OPENAI_API_KEY"),
    base_url=os.getenv("OPENAI_BASE_URL")
)

async def deploy_with_self_healing(project_id: str, dockerfile: str):
    # 1. 尝试部署
    status, url, logs = await deploy_to_sealos(project_id, dockerfile)
    
    if status == "SUCCESS":
        return url

    # 2. 触发诊断节点
    # 使用上面实例化的 llm_instance 替换掉原来的占位符
    parser = ErrorParser(llm_client=llm_instance)
    diagnosis = await parser.parse_log(logs) # 注意：根据你的 parsers.py，方法名应为 parse_log
    
    print(f"诊断完成: {diagnosis.error_type} - {diagnosis.root_cause}")

    # 3. 携带诊断信息，进入并行试错环节
    return await parallel_healing_engine(
        project_id=project_id,
        current_dockerfile=dockerfile,
        diagnosis=diagnosis
    )

# 后续的 parallel_healing_engine 逻辑保持不变...
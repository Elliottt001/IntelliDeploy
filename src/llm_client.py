import openai
from openai import AsyncOpenAI

class LLMClient:
    def __init__(self, api_key: str, base_url: str = None):
        # 如果你在国内，base_url 通常填你的 API 转发地址
        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url
        )

    async def chat(self, system_prompt: str, user_prompt: str) -> str:
        """
        统一接口，匹配 HealingEngine 和 ErrorParser 的需求
        """
        try:
            response = await self.client.chat.completions.create(
                model="gpt-4o-mini",  # 推荐使用 gpt-4o-mini，速度快、效果好
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3  # 代码修复场景，温度调低一点更严谨
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"Error: LLM 调用失败 - {str(e)}"
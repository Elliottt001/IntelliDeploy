"""
Redis客户端服务
用于熔断计数器、任务状态缓存等
"""
from typing import Optional, Dict
import json

from app.config import settings


class RedisClient:
    """Redis客户端(支持降级到内存模式)"""

    def __init__(self):
        self.redis = None
        self.memory_store: Dict[str, str] = {}  # 内存降级存储
        self.memory_ttl: Dict[str, float] = {}  # 内存TTL

        if settings.REDIS_ENABLED:
            try:
                import redis.asyncio as aioredis
                self.redis = aioredis.from_url(
                    settings.REDIS_URL,
                    encoding="utf-8",
                    decode_responses=True
                )
            except ImportError:
                print("Warning: redis not installed, using memory fallback")
            except Exception as e:
                print(f"Warning: Redis connection failed: {e}, using memory fallback")

    async def incr(self, key: str) -> int:
        """递增计数器"""
        if self.redis:
            try:
                return await self.redis.incr(key)
            except Exception:
                pass

        # 内存降级
        current = int(self.memory_store.get(key, "0"))
        current += 1
        self.memory_store[key] = str(current)
        return current

    async def get(self, key: str) -> Optional[str]:
        """获取值"""
        if self.redis:
            try:
                return await self.redis.get(key)
            except Exception:
                pass

        return self.memory_store.get(key)

    async def set(self, key: str, value: str, ex: Optional[int] = None):
        """设置值"""
        if self.redis:
            try:
                await self.redis.set(key, value, ex=ex)
                return
            except Exception:
                pass

        # 内存降级
        self.memory_store[key] = value
        if ex:
            import time
            self.memory_ttl[key] = time.time() + ex

    async def expire(self, key: str, seconds: int):
        """设置过期时间"""
        if self.redis:
            try:
                await self.redis.expire(key, seconds)
                return
            except Exception:
                pass

        # 内存降级
        import time
        self.memory_ttl[key] = time.time() + seconds

    async def delete(self, key: str):
        """删除键"""
        if self.redis:
            try:
                await self.redis.delete(key)
                return
            except Exception:
                pass

        self.memory_store.pop(key, None)
        self.memory_ttl.pop(key, None)

    async def setex(self, key: str, seconds: int, value: str):
        """设置值并指定过期时间"""
        await self.set(key, value, ex=seconds)

    async def close(self):
        """关闭连接"""
        if self.redis:
            try:
                await self.redis.close()
            except Exception:
                pass


# 全局Redis客户端实例
_redis_client: Optional[RedisClient] = None


def get_redis_client() -> RedisClient:
    """获取全局Redis客户端实例"""
    global _redis_client
    if _redis_client is None:
        _redis_client = RedisClient()
    return _redis_client


class CircuitBreakerService:
    """熔断器服务"""

    def __init__(self):
        self.redis = get_redis_client()

    async def incr_retry_count(self, project_id: str) -> int:
        """
        递增重试次数

        Args:
            project_id: 项目ID

        Returns:
            int: 当前重试次数
        """
        key = f"healing_retries:{project_id}"
        count = await self.redis.incr(key)

        # 第一次设置时添加过期时间(1小时)
        if count == 1:
            await self.redis.expire(key, 3600)

        return count

    async def get_retry_count(self, project_id: str) -> int:
        """
        获取重试次数

        Args:
            project_id: 项目ID

        Returns:
            int: 当前重试次数
        """
        key = f"healing_retries:{project_id}"
        value = await self.redis.get(key)
        return int(value) if value else 0

    async def reset_retry_count(self, project_id: str):
        """
        重置重试次数

        Args:
            project_id: 项目ID
        """
        key = f"healing_retries:{project_id}"
        await self.redis.delete(key)

    async def check_circuit_breaker(self, project_id: str, max_retries: int = None) -> bool:
        """
        检查熔断器状态

        Args:
            project_id: 项目ID
            max_retries: 最大重试次数,默认使用配置

        Returns:
            bool: True表示可以继续,False表示已熔断
        """
        if max_retries is None:
            max_retries = settings.MAX_HEALING_RETRIES

        count = await self.get_retry_count(project_id)
        return count < max_retries

    async def cache_task_status(self, task_id: str, status: Dict, ttl: int = 300):
        """
        缓存任务状态

        Args:
            task_id: 任务ID
            status: 状态字典
            ttl: 过期时间(秒)
        """
        key = f"task_status:{task_id}"
        await self.redis.setex(key, ttl, json.dumps(status))

    async def get_cached_status(self, task_id: str) -> Optional[Dict]:
        """
        获取缓存的任务状态

        Args:
            task_id: 任务ID

        Returns:
            Optional[Dict]: 状态字典,不存在返回None
        """
        key = f"task_status:{task_id}"
        value = await self.redis.get(key)
        if value:
            try:
                return json.loads(value)
            except Exception:
                pass
        return None

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
离线 GitHub README 向量数据库 Bootstrap 脚本。

运行前建议安装依赖：
    pip install requests chromadb openai langchain-text-splitters beautifulsoup4

可选依赖：
    pip install sentence-transformers
    如果希望使用本地开源 embedding 模型，可安装 sentence-transformers 并配置
    EMBEDDING_PROVIDER=sentence-transformers。

典型运行方式：
    export GITHUB_TOKEN="ghp_xxx"              # 强烈建议配置，避免 GitHub 匿名限流
    export OPENAI_API_KEY="sk-xxx"             # 使用 OpenAI embedding 时需要
    python3 scripts/build_vector_db.py --target-repos 10000

本脚本是一次性、纯离线的数据初始化脚本：
    1. 不接入 FastAPI。
    2. 不接入现有 Agent 矩阵。
    3. 不 import 项目内业务代码。
    4. 所有状态、原始 README、清洗文本和向量库都保存在本地 data/vector_bootstrap 下。

默认采集目标：
    10000 个“前后端一体的产品型项目”，即 README/仓库元数据中同时具备：
        - 前端信号：React/Vue/Angular/Next.js/Vite/UI 等。
        - 后端信号：API/server/database/auth/Django/FastAPI/Spring 等。
        - 产品信号：app/platform/dashboard/SaaS/CMS/e-commerce 等。
    这会主动过滤掉纯库、纯框架、纯算法、纯教程类仓库。
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import html
import logging
import os
import random
import re
import sqlite3
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import requests
from bs4 import BeautifulSoup
from langchain_text_splitters import RecursiveCharacterTextSplitter


GITHUB_API_URL = "https://api.github.com"
DEFAULT_DATA_DIR = Path("data/vector_bootstrap")
DEFAULT_QUERY = "stars:>50 fork:false archived:false"
DEFAULT_QUERY_FACETS = [
    "fullstack react api",
    "fullstack nextjs api",
    "fullstack vue api",
    "fullstack angular api",
    "frontend backend dashboard",
    "frontend backend admin",
    "web app database",
    "web application api database",
    "saas dashboard api",
    "ecommerce frontend backend",
    "cms frontend backend",
    "crm frontend backend",
    "erp frontend backend",
    "project management app api",
    "chat app frontend backend",
    "social app frontend backend",
    "booking app frontend backend",
    "marketplace frontend backend",
    "analytics dashboard backend",
    "admin panel backend",
    "language:JavaScript react express",
    "language:TypeScript nextjs prisma",
    "language:TypeScript react nestjs",
    "language:Python django react",
    "language:Python fastapi react",
    "language:Java spring vue",
    "language:Java spring react",
    "language:PHP laravel vue",
    "language:Ruby rails react",
    "language:Go react api",
]
DEFAULT_CHROMA_COLLECTION = "github_readme_bootstrap"

FRONTEND_SIGNALS = {
    "frontend",
    "front-end",
    "react",
    "vue",
    "angular",
    "svelte",
    "next.js",
    "nextjs",
    "nuxt",
    "vite",
    "webpack",
    "tailwind",
    "bootstrap",
    "material ui",
    "chakra ui",
    "antd",
    "admin ui",
    "dashboard ui",
    "single page application",
    "spa",
}

BACKEND_SIGNALS = {
    "backend",
    "back-end",
    "api",
    "rest api",
    "graphql",
    "server",
    "database",
    "postgres",
    "postgresql",
    "mysql",
    "mongodb",
    "redis",
    "auth",
    "authentication",
    "authorization",
    "django",
    "fastapi",
    "flask",
    "express",
    "nestjs",
    "spring boot",
    "laravel",
    "rails",
    "prisma",
    "typeorm",
    "sequelize",
}

PRODUCT_SIGNALS = {
    "app",
    "application",
    "platform",
    "product",
    "dashboard",
    "admin panel",
    "admin dashboard",
    "saas",
    "cms",
    "crm",
    "erp",
    "e-commerce",
    "ecommerce",
    "marketplace",
    "booking",
    "chat",
    "social network",
    "project management",
    "task management",
    "kanban",
    "analytics",
    "monitoring",
    "collaboration",
    "clone",
}

NEGATIVE_REPO_SIGNALS = {
    "awesome",
    "tutorial",
    "examples",
    "example",
    "starter",
    "boilerplate",
    "template",
    "sdk",
    "library",
    "framework",
    "algorithm",
    "algorithms",
    "leetcode",
    "interview",
    "cheatsheet",
    "course",
    "book",
}


@dataclass(frozen=True)
class Settings:
    target_repos: int
    data_dir: Path
    github_token: str | None
    github_queries: list[str]
    github_per_page: int
    max_search_pages: int
    request_timeout: int
    max_retries: int
    retry_base_sleep: float
    chunk_size: int
    chunk_overlap: int
    embedding_provider: str
    embedding_model: str
    embedding_batch_size: int
    chroma_collection: str
    skip_embedding: bool


class StateStore:
    """用 SQLite 保存断点续传状态，避免长任务中断后重头开始。"""

    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(self.db_path)
        self.conn.row_factory = sqlite3.Row
        self._init_schema()

    def _init_schema(self) -> None:
        self.conn.executescript(
            """
            PRAGMA journal_mode = WAL;

            CREATE TABLE IF NOT EXISTS repos (
                repo_id INTEGER PRIMARY KEY,
                full_name TEXT NOT NULL UNIQUE,
                url TEXT NOT NULL,
                html_url TEXT NOT NULL,
                stars INTEGER NOT NULL DEFAULT 0,
                description TEXT,
                default_branch TEXT,
                language TEXT,
                pushed_at TEXT,
                readme_status TEXT NOT NULL DEFAULT 'pending',
                product_status TEXT NOT NULL DEFAULT 'pending',
                product_score INTEGER NOT NULL DEFAULT 0,
                product_reason TEXT,
                embedding_status TEXT NOT NULL DEFAULT 'pending',
                readme_sha TEXT,
                clean_sha TEXT,
                chunk_count INTEGER NOT NULL DEFAULT 0,
                error TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS crawler_state (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            """
        )
        self._add_column_if_missing("repos", "product_status", "TEXT NOT NULL DEFAULT 'pending'")
        self._add_column_if_missing("repos", "product_score", "INTEGER NOT NULL DEFAULT 0")
        self._add_column_if_missing("repos", "product_reason", "TEXT")
        self.conn.commit()

    def _add_column_if_missing(self, table: str, column: str, definition: str) -> None:
        columns = {
            row["name"]
            for row in self.conn.execute(f"PRAGMA table_info({table})").fetchall()
        }
        if column not in columns:
            self.conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")

    def close(self) -> None:
        self.conn.close()

    def get_state(self, key: str, default: str | None = None) -> str | None:
        row = self.conn.execute(
            "SELECT value FROM crawler_state WHERE key = ?",
            (key,),
        ).fetchone()
        return row["value"] if row else default

    def set_state(self, key: str, value: str) -> None:
        now = utc_now()
        self.conn.execute(
            """
            INSERT INTO crawler_state(key, value, updated_at)
            VALUES(?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
            """,
            (key, value, now),
        )
        self.conn.commit()

    def upsert_repo(self, repo: dict[str, Any]) -> None:
        now = utc_now()
        self.conn.execute(
            """
            INSERT INTO repos(
                repo_id, full_name, url, html_url, stars, description,
                default_branch, language, pushed_at, created_at, updated_at
            )
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(repo_id) DO UPDATE SET
                full_name = excluded.full_name,
                url = excluded.url,
                html_url = excluded.html_url,
                stars = excluded.stars,
                description = excluded.description,
                default_branch = excluded.default_branch,
                language = excluded.language,
                pushed_at = excluded.pushed_at,
                updated_at = excluded.updated_at
            """,
            (
                repo["id"],
                repo["full_name"],
                repo["url"],
                repo["html_url"],
                repo.get("stargazers_count") or 0,
                repo.get("description"),
                repo.get("default_branch"),
                repo.get("language"),
                repo.get("pushed_at"),
                now,
                now,
            ),
        )
        self.conn.commit()

    def repo_count(self) -> int:
        row = self.conn.execute("SELECT COUNT(*) AS count FROM repos").fetchone()
        return int(row["count"])

    def accepted_product_count(self) -> int:
        row = self.conn.execute(
            "SELECT COUNT(*) AS count FROM repos WHERE product_status = 'accepted'"
        ).fetchone()
        return int(row["count"])

    def iter_repos_for_readme(self) -> Iterable[sqlite3.Row]:
        yield from self.conn.execute(
            """
            SELECT * FROM repos
            WHERE readme_status IN ('pending', 'retry')
            ORDER BY stars DESC, repo_id ASC
            """
        )

    def iter_repos_for_embedding(self) -> Iterable[sqlite3.Row]:
        yield from self.conn.execute(
            """
            SELECT * FROM repos
            WHERE readme_status = 'done'
              AND product_status = 'accepted'
              AND embedding_status IN ('pending', 'retry')
            ORDER BY stars DESC, repo_id ASC
            """
        )

    def mark_readme_done(
        self,
        repo_id: int,
        readme_sha: str,
        clean_sha: str,
        product_score: int,
        product_reason: str,
    ) -> None:
        self.conn.execute(
            """
            UPDATE repos
            SET readme_status = 'done',
                product_status = 'accepted',
                product_score = ?,
                product_reason = ?,
                readme_sha = ?,
                clean_sha = ?,
                error = NULL,
                updated_at = ?
            WHERE repo_id = ?
            """,
            (product_score, product_reason[:1000], readme_sha, clean_sha, utc_now(), repo_id),
        )
        self.conn.commit()

    def mark_repo_rejected(self, repo_id: int, product_score: int, product_reason: str) -> None:
        self.conn.execute(
            """
            UPDATE repos
            SET readme_status = 'filtered',
                product_status = 'rejected',
                product_score = ?,
                product_reason = ?,
                error = NULL,
                updated_at = ?
            WHERE repo_id = ?
            """,
            (product_score, product_reason[:1000], utc_now(), repo_id),
        )
        self.conn.commit()

    def mark_readme_error(self, repo_id: int, status: str, error: str) -> None:
        self.conn.execute(
            """
            UPDATE repos
            SET readme_status = ?,
                error = ?,
                updated_at = ?
            WHERE repo_id = ?
            """,
            (status, error[:1000], utc_now(), repo_id),
        )
        self.conn.commit()

    def mark_embedding_done(self, repo_id: int, chunk_count: int) -> None:
        self.conn.execute(
            """
            UPDATE repos
            SET embedding_status = 'done',
                chunk_count = ?,
                error = NULL,
                updated_at = ?
            WHERE repo_id = ?
            """,
            (chunk_count, utc_now(), repo_id),
        )
        self.conn.commit()

    def mark_embedding_error(self, repo_id: int, error: str) -> None:
        self.conn.execute(
            """
            UPDATE repos
            SET embedding_status = 'retry',
                error = ?,
                updated_at = ?
            WHERE repo_id = ?
            """,
            (error[:1000], utc_now(), repo_id),
        )
        self.conn.commit()


class GitHubClient:
    """带 PAT、限流处理和指数退避的 GitHub REST API 客户端。"""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.session = requests.Session()
        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "IntelliDeploy-Offlline-Vector-Bootstrap",
        }
        if settings.github_token:
            headers["Authorization"] = f"Bearer {settings.github_token}"
        self.session.headers.update(headers)

    def get_json(self, url: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        for attempt in range(1, self.settings.max_retries + 1):
            response = self.session.get(url, params=params, timeout=self.settings.request_timeout)

            if response.status_code == 403 and self._is_primary_rate_limited(response):
                self._sleep_until_rate_limit_reset(response, attempt)
                continue

            if response.status_code in (429, 500, 502, 503, 504):
                self._sleep_with_backoff(response, attempt)
                continue

            if response.status_code == 403 and "secondary rate limit" in response.text.lower():
                self._sleep_with_backoff(response, attempt, minimum=60.0)
                continue

            if response.status_code == 404:
                raise FileNotFoundError("GitHub API resource not found")

            response.raise_for_status()
            self._polite_sleep_if_remaining_low(response)
            return response.json()

        raise RuntimeError(f"GitHub API retry exhausted: {url}")

    def search_repositories(self, query: str, page: int, per_page: int) -> dict[str, Any]:
        return self.get_json(
            f"{GITHUB_API_URL}/search/repositories",
            params={
                "q": query,
                "sort": "stars",
                "order": "desc",
                "page": page,
                "per_page": per_page,
            },
        )

    def fetch_readme_markdown(self, full_name: str) -> str:
        # GitHub README API 返回 base64 内容；这里不用 raw.githubusercontent.com，
        # 是为了统一走 GitHub API 的认证和限流处理。
        payload = self.get_json(f"{GITHUB_API_URL}/repos/{full_name}/readme")
        encoding = payload.get("encoding")
        content = payload.get("content", "")
        if encoding != "base64" or not content:
            raise ValueError(f"Unsupported README payload encoding: {encoding}")
        return base64.b64decode(content).decode("utf-8", errors="replace")

    def _is_primary_rate_limited(self, response: requests.Response) -> bool:
        remaining = response.headers.get("X-RateLimit-Remaining")
        return remaining == "0"

    def _sleep_until_rate_limit_reset(self, response: requests.Response, attempt: int) -> None:
        reset_header = response.headers.get("X-RateLimit-Reset")
        now = int(time.time())
        if reset_header and reset_header.isdigit():
            sleep_seconds = max(int(reset_header) - now + 5, 5)
        else:
            sleep_seconds = self._backoff_seconds(attempt, minimum=60.0)
        logging.warning("GitHub primary rate limit hit, sleeping %.1fs", sleep_seconds)
        time.sleep(sleep_seconds)

    def _sleep_with_backoff(
        self,
        response: requests.Response,
        attempt: int,
        minimum: float | None = None,
    ) -> None:
        retry_after = response.headers.get("Retry-After")
        if retry_after and retry_after.isdigit():
            sleep_seconds = float(retry_after) + 1.0
        else:
            sleep_seconds = self._backoff_seconds(attempt, minimum=minimum)
        logging.warning(
            "GitHub API status=%s, attempt=%s, sleeping %.1fs",
            response.status_code,
            attempt,
            sleep_seconds,
        )
        time.sleep(sleep_seconds)

    def _backoff_seconds(self, attempt: int, minimum: float | None = None) -> float:
        base = self.settings.retry_base_sleep * (2 ** max(attempt - 1, 0))
        jitter = random.uniform(0.0, self.settings.retry_base_sleep)
        return max(base + jitter, minimum or 0.0)

    def _polite_sleep_if_remaining_low(self, response: requests.Response) -> None:
        remaining = response.headers.get("X-RateLimit-Remaining")
        if remaining and remaining.isdigit() and int(remaining) < 10:
            logging.info("GitHub API remaining quota is low: %s", remaining)
            time.sleep(2.0)


class EmbeddingProvider:
    """Embedding Provider 抽象，方便从 OpenAI 切换到本地模型。"""

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        raise NotImplementedError


class RetryingEmbeddingProvider(EmbeddingProvider):
    """对 embedding 调用做指数退避，避免临时网络/API 抖动导致整仓失败。"""

    def __init__(self, provider: EmbeddingProvider, max_retries: int, retry_base_sleep: float) -> None:
        self.provider = provider
        self.max_retries = max_retries
        self.retry_base_sleep = retry_base_sleep

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        for attempt in range(1, self.max_retries + 1):
            try:
                return self.provider.embed_documents(texts)
            except Exception:
                if attempt >= self.max_retries:
                    raise
                sleep_seconds = self.retry_base_sleep * (2 ** (attempt - 1)) + random.uniform(
                    0.0, self.retry_base_sleep
                )
                logging.warning("Embedding batch failed, attempt=%s, sleeping %.1fs", attempt, sleep_seconds)
                time.sleep(sleep_seconds)
        raise RuntimeError("Embedding retry exhausted")


class OpenAIEmbeddingProvider(EmbeddingProvider):
    def __init__(self, model: str) -> None:
        from openai import OpenAI

        self.client = OpenAI()
        self.model = model

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        response = self.client.embeddings.create(model=self.model, input=texts)
        return [item.embedding for item in response.data]


class SentenceTransformerEmbeddingProvider(EmbeddingProvider):
    def __init__(self, model: str) -> None:
        from sentence_transformers import SentenceTransformer

        self.model = SentenceTransformer(model)

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        vectors = self.model.encode(texts, normalize_embeddings=True)
        return vectors.tolist()


def parse_args() -> Settings:
    parser = argparse.ArgumentParser(
        description="Build an offline local vector database from high-star GitHub README files."
    )
    parser.add_argument("--target-repos", type=int, default=10000, help="目标仓库数量。")
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR, help="本地状态和数据目录。")
    parser.add_argument(
        "--github-query",
        action="append",
        help=(
            "GitHub search query，可重复传入。默认按多种语言拆分查询，绕开 Search API "
            "单查询最多约 1000 条结果的限制。"
        ),
    )
    parser.add_argument("--github-per-page", type=int, default=100, help="GitHub search 每页数量，最大 100。")
    parser.add_argument("--max-search-pages", type=int, default=100, help="GitHub search 最多页数。")
    parser.add_argument("--request-timeout", type=int, default=30, help="HTTP 请求超时秒数。")
    parser.add_argument("--max-retries", type=int, default=8, help="限流或临时失败时最大重试次数。")
    parser.add_argument("--retry-base-sleep", type=float, default=5.0, help="指数退避基础休眠秒数。")
    parser.add_argument("--chunk-size", type=int, default=1200, help="文本分块大小。")
    parser.add_argument("--chunk-overlap", type=int, default=180, help="文本分块重叠大小。")
    parser.add_argument(
        "--embedding-provider",
        default=os.getenv("EMBEDDING_PROVIDER", "openai"),
        choices=("openai", "sentence-transformers"),
        help="Embedding provider。",
    )
    parser.add_argument(
        "--embedding-model",
        default=os.getenv("EMBEDDING_MODEL", "text-embedding-3-small"),
        help="OpenAI 或 sentence-transformers 模型名。",
    )
    parser.add_argument("--embedding-batch-size", type=int, default=64, help="Embedding 批大小。")
    parser.add_argument("--chroma-collection", default=DEFAULT_CHROMA_COLLECTION, help="Chroma collection 名称。")
    parser.add_argument(
        "--skip-embedding",
        action="store_true",
        help="只抓取和清洗 README，不执行 embedding 和入库，便于先验证爬虫。",
    )
    args = parser.parse_args()

    return Settings(
        target_repos=args.target_repos,
        data_dir=args.data_dir,
        github_token=os.getenv("GITHUB_TOKEN") or os.getenv("GH_TOKEN"),
        github_queries=args.github_query or default_github_queries(),
        github_per_page=min(args.github_per_page, 100),
        max_search_pages=args.max_search_pages,
        request_timeout=args.request_timeout,
        max_retries=args.max_retries,
        retry_base_sleep=args.retry_base_sleep,
        chunk_size=args.chunk_size,
        chunk_overlap=args.chunk_overlap,
        embedding_provider=args.embedding_provider,
        embedding_model=args.embedding_model,
        embedding_batch_size=args.embedding_batch_size,
        chroma_collection=args.chroma_collection,
        skip_embedding=args.skip_embedding,
    )


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )


def default_github_queries() -> list[str]:
    return [f"{DEFAULT_QUERY} {facet}" for facet in DEFAULT_QUERY_FACETS]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def safe_repo_filename(full_name: str) -> str:
    return full_name.replace("/", "__")


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def clean_readme(markdown: str) -> str:
    """清洗 README 噪音，只保留适合 embedding 的纯文本描述。

    处理范围包括：
        - HTML 标签和注释。
        - Markdown 图片、链接、标题、引用、列表、代码围栏。
        - 常见 badge 徽章和 Shields.io 链接。
        - 多余空白。

    注意：这是面向向量召回的清洗，不追求完美 Markdown 渲染，只追求减少噪音。
    """
    text = html.unescape(markdown)

    # 去掉 HTML 注释、script/style 块和 HTML 标签。
    text = re.sub(r"<!--.*?-->", " ", text, flags=re.DOTALL)
    text = re.sub(r"<(script|style).*?>.*?</\1>", " ", text, flags=re.DOTALL | re.IGNORECASE)
    text = BeautifulSoup(text, "html.parser").get_text(" ")

    # 去掉 fenced code block 和 inline code，避免安装日志、配置片段污染语义空间。
    text = re.sub(r"```.*?```", " ", text, flags=re.DOTALL)
    text = re.sub(r"`([^`]*)`", r"\1", text)

    # 去掉 Markdown 图片，尤其是 badge 图片。
    text = re.sub(r"!\[[^\]]*]\([^)]+\)", " ", text)
    text = re.sub(r"!\[[^\]]*]\[[^\]]*]", " ", text)

    # 去掉独立 badge / shield / CI 状态 URL。
    badge_patterns = [
        r"https?://img\.shields\.io/[^\s)]+",
        r"https?://badge\.fury\.io/[^\s)]+",
        r"https?://github\.com/[^/\s)]+/[^/\s)]+/workflows/[^\s)]+/badge\.svg[^\s)]*",
        r"https?://github\.com/[^/\s)]+/[^/\s)]+/actions/workflows/[^\s)]+/badge\.svg[^\s)]*",
        r"https?://travis-ci\.[^\s)]+",
        r"https?://circleci\.com/[^\s)]+",
        r"https?://codecov\.io/[^\s)]+",
    ]
    for pattern in badge_patterns:
        text = re.sub(pattern, " ", text, flags=re.IGNORECASE)

    # Markdown 链接保留 anchor 文本，去掉 URL。
    text = re.sub(r"\[([^\]]+)]\([^)]+\)", r"\1", text)
    text = re.sub(r"\[([^\]]+)]\[[^\]]*]", r"\1", text)
    text = re.sub(r"^\s*\[[^\]]+]:\s+\S+.*$", " ", text, flags=re.MULTILINE)

    # 去掉 Markdown 标题、引用、列表、表格分隔符和强调符号。
    text = re.sub(r"^\s{0,3}#{1,6}\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s{0,3}>\s?", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*\d+[.)]\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$", " ", text, flags=re.MULTILINE)
    text = re.sub(r"[*_~]{1,3}", "", text)

    # 去掉裸 URL 和邮箱，降低无意义 token 的比重。
    text = re.sub(r"https?://\S+", " ", text)
    text = re.sub(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b", " ", text)

    # 收敛空白。
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    lines = [line.strip() for line in text.splitlines()]
    lines = [line for line in lines if line]
    return "\n".join(lines).strip()


def signal_hits(text: str, signals: set[str]) -> set[str]:
    normalized = text.lower()
    return {signal for signal in signals if signal in normalized}


def classify_fullstack_product(repo: sqlite3.Row, cleaned_readme: str) -> tuple[bool, int, str]:
    """判断仓库是否像一个“前后端一体的产品型项目”。

    这是离线 bootstrap 阶段的轻量规则过滤，目标是提高向量库语料质量：
        - 必须同时有前端、后端、产品信号。
        - 强负面信号会扣分，减少纯库/教程/模板仓库。
        - README 信号和仓库 description 一起判断。
    """
    haystack = " ".join(
        [
            str(repo["full_name"] or ""),
            str(repo["description"] or ""),
            str(repo["language"] or ""),
            cleaned_readme[:6000],
        ]
    ).lower()
    full_name = str(repo["full_name"] or "").lower()
    description = str(repo["description"] or "").lower()

    frontend_hits = signal_hits(haystack, FRONTEND_SIGNALS)
    backend_hits = signal_hits(haystack, BACKEND_SIGNALS)
    product_hits = signal_hits(haystack, PRODUCT_SIGNALS)
    negative_hits = signal_hits(f"{full_name} {description}", NEGATIVE_REPO_SIGNALS)

    score = len(frontend_hits) * 3 + len(backend_hits) * 3 + len(product_hits) * 2
    score -= len(negative_hits) * 4

    accepted = bool(frontend_hits and backend_hits and product_hits and score >= 8)
    reason = (
        f"frontend={sorted(frontend_hits)[:8]}; "
        f"backend={sorted(backend_hits)[:8]}; "
        f"product={sorted(product_hits)[:8]}; "
        f"negative={sorted(negative_hits)[:8]}; "
        f"score={score}"
    )
    return accepted, score, reason


def collect_repositories(settings: Settings, store: StateStore, client: GitHubClient) -> None:
    existing = store.repo_count()
    candidate_target = settings.target_repos * 5
    if existing >= candidate_target:
        logging.info("Repository metadata already has %s candidate rows, skip search.", existing)
        return

    logging.info("Collecting repository metadata with %s search queries.", len(settings.github_queries))

    for query_index, query in enumerate(settings.github_queries):
        state_key = f"github_search_next_page:{sha256_text(query)[:12]}"
        start_page = int(store.get_state(state_key, "1") or "1")
        if start_page > settings.max_search_pages:
            continue

        logging.info(
            "Search query %s/%s from page %s: %s",
            query_index + 1,
            len(settings.github_queries),
            start_page,
            query,
        )

        for page in range(start_page, settings.max_search_pages + 1):
            if store.repo_count() >= candidate_target:
                break

            payload = client.search_repositories(query, page, settings.github_per_page)
            items = payload.get("items", [])
            if not items:
                logging.info("No more search results for query at page %s.", page)
                store.set_state(state_key, str(settings.max_search_pages + 1))
                break

            for repo in items:
                store.upsert_repo(repo)
                if store.repo_count() >= candidate_target:
                    break

            store.set_state(state_key, str(page + 1))
            logging.info(
                "Search query %s page %s done, total unique repos=%s.",
                query_index + 1,
                page,
                store.repo_count(),
            )


def fetch_and_clean_readmes(settings: Settings, store: StateStore, client: GitHubClient) -> None:
    raw_dir = settings.data_dir / "readmes_raw"
    clean_dir = settings.data_dir / "readmes_clean"

    for repo in store.iter_repos_for_readme():
        if store.accepted_product_count() >= settings.target_repos:
            logging.info("Accepted product repo target reached: %s", settings.target_repos)
            break

        repo_id = int(repo["repo_id"])
        full_name = str(repo["full_name"])
        raw_path = raw_dir / f"{safe_repo_filename(full_name)}.md"
        clean_path = clean_dir / f"{safe_repo_filename(full_name)}.txt"

        try:
            logging.info("Fetching README: %s", full_name)
            raw = client.fetch_readme_markdown(full_name)
            cleaned = clean_readme(raw)

            if len(cleaned) < 80:
                store.mark_readme_error(repo_id, "empty", "README is missing or too short after cleaning")
                continue

            accepted, product_score, product_reason = classify_fullstack_product(repo, cleaned)
            if not accepted:
                store.mark_repo_rejected(repo_id, product_score, product_reason)
                logging.info("Filtered non-product/fullstack repo: %s (%s)", full_name, product_reason)
                continue

            write_text(raw_path, raw)
            write_text(clean_path, cleaned)
            store.mark_readme_done(
                repo_id,
                sha256_text(raw),
                sha256_text(cleaned),
                product_score,
                product_reason,
            )
        except FileNotFoundError:
            store.mark_readme_error(repo_id, "missing", "README not found")
        except Exception as exc:
            logging.exception("README fetch failed for %s", full_name)
            store.mark_readme_error(repo_id, "retry", repr(exc))


def build_embedding_provider(settings: Settings) -> EmbeddingProvider:
    if settings.embedding_provider == "openai":
        if not os.getenv("OPENAI_API_KEY"):
            raise RuntimeError("OPENAI_API_KEY is required when --embedding-provider=openai")
        provider: EmbeddingProvider = OpenAIEmbeddingProvider(settings.embedding_model)
    else:
        provider = SentenceTransformerEmbeddingProvider(settings.embedding_model)

    return RetryingEmbeddingProvider(provider, settings.max_retries, settings.retry_base_sleep)


def build_chroma_collection(settings: Settings) -> Any:
    import chromadb

    chroma_dir = settings.data_dir / "chroma"
    chroma_dir.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(path=str(chroma_dir))
    return client.get_or_create_collection(
        name=settings.chroma_collection,
        metadata={"description": "Offline GitHub README bootstrap vectors"},
    )


def chunk_text(settings: Settings, text: str) -> list[str]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    chunks = splitter.split_text(text)
    return [chunk.strip() for chunk in chunks if len(chunk.strip()) >= 80]


def embed_and_store(settings: Settings, store: StateStore) -> None:
    provider = build_embedding_provider(settings)
    collection = build_chroma_collection(settings)
    clean_dir = settings.data_dir / "readmes_clean"

    for repo in store.iter_repos_for_embedding():
        repo_id = int(repo["repo_id"])
        full_name = str(repo["full_name"])
        clean_path = clean_dir / f"{safe_repo_filename(full_name)}.txt"

        try:
            if not clean_path.exists():
                store.mark_embedding_error(repo_id, "Cleaned README file is missing")
                continue

            cleaned = read_text(clean_path)
            chunks = chunk_text(settings, cleaned)
            if not chunks:
                store.mark_embedding_done(repo_id, 0)
                continue

            logging.info("Embedding %s chunks for %s", len(chunks), full_name)
            for start in range(0, len(chunks), settings.embedding_batch_size):
                batch = chunks[start : start + settings.embedding_batch_size]
                vectors = provider.embed_documents(batch)
                ids = [f"github:{repo_id}:{start + offset}" for offset in range(len(batch))]
                metadatas = [
                    {
                        "repo_id": repo_id,
                        "full_name": full_name,
                        "html_url": repo["html_url"],
                        "stars": int(repo["stars"]),
                        "description": repo["description"] or "",
                        "language": repo["language"] or "",
                        "product_score": int(repo["product_score"] or 0),
                        "product_reason": repo["product_reason"] or "",
                        "chunk_index": start + offset,
                        "source": "github_readme",
                    }
                    for offset in range(len(batch))
                ]

                # upsert 保证断点续传时幂等；相同 chunk ID 会被覆盖而不是重复写入。
                collection.upsert(
                    ids=ids,
                    documents=batch,
                    embeddings=vectors,
                    metadatas=metadatas,
                )

            store.mark_embedding_done(repo_id, len(chunks))
        except Exception as exc:
            logging.exception("Embedding failed for %s", full_name)
            store.mark_embedding_error(repo_id, repr(exc))


def print_summary(settings: Settings, store: StateStore) -> None:
    rows = store.conn.execute(
        """
        SELECT
            COUNT(*) AS repos,
            SUM(CASE WHEN readme_status = 'done' THEN 1 ELSE 0 END) AS readme_done,
            SUM(CASE WHEN product_status = 'accepted' THEN 1 ELSE 0 END) AS product_accepted,
            SUM(CASE WHEN product_status = 'rejected' THEN 1 ELSE 0 END) AS product_rejected,
            SUM(CASE WHEN readme_status = 'missing' THEN 1 ELSE 0 END) AS readme_missing,
            SUM(CASE WHEN readme_status = 'empty' THEN 1 ELSE 0 END) AS readme_empty,
            SUM(CASE WHEN embedding_status = 'done' THEN 1 ELSE 0 END) AS embedding_done,
            SUM(chunk_count) AS chunks
        FROM repos
        """
    ).fetchone()
    logging.info(
        "Summary: candidates=%s, product_accepted=%s, product_rejected=%s, "
        "readme_done=%s, readme_missing=%s, readme_empty=%s, "
        "embedding_done=%s, chunks=%s, data_dir=%s",
        rows["repos"],
        rows["product_accepted"] or 0,
        rows["product_rejected"] or 0,
        rows["readme_done"] or 0,
        rows["readme_missing"] or 0,
        rows["readme_empty"] or 0,
        rows["embedding_done"] or 0,
        rows["chunks"] or 0,
        settings.data_dir,
    )


def main() -> int:
    configure_logging()
    settings = parse_args()
    settings.data_dir.mkdir(parents=True, exist_ok=True)

    if not settings.github_token:
        logging.warning(
            "GITHUB_TOKEN/GH_TOKEN is not set. Anonymous GitHub API quota is too low for 10000 repos."
        )

    store = StateStore(settings.data_dir / "bootstrap_state.sqlite3")
    client = GitHubClient(settings)
    try:
        collect_repositories(settings, store, client)
        fetch_and_clean_readmes(settings, store, client)
        if settings.skip_embedding:
            logging.info("Skip embedding because --skip-embedding is set.")
        else:
            embed_and_store(settings, store)
        print_summary(settings, store)
    finally:
        store.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())

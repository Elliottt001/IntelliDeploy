import argparse
import asyncio
import json
from pathlib import Path

from app.agent.repository_index import update_index
from app.agent_core.brains.github_retriever import GitHubRepositorySearchClient


def seeds(path: Path) -> list[str]:
    cases = json.loads(path.read_text())
    return list(dict.fromkeys(url for case in cases for url in case.get("known_repositories", [])))


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--seeds", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    report = await update_index(seeds(args.seeds), args.output, GitHubRepositorySearchClient())
    print(report.model_dump_json())
    if report.failed:
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())

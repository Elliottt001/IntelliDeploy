from __future__ import annotations

import argparse
import asyncio
import json

from app.core.types import AppManifest, ServiceSpec
from app.runtime.linux import preflight_linux_target


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target-id", required=True)
    parser.add_argument("--environment", required=True, choices=["dev", "test", "boe"])
    parser.add_argument("--image", required=True, help="Digest-pinned disposable test image")
    args = parser.parse_args()
    manifest = AppManifest(
        web_service="web",
        services=[ServiceSpec(name="web", image=args.image, port=8080, health_path="/health")],
    )
    result = await preflight_linux_target(args.target_id, manifest)
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    asyncio.run(main())

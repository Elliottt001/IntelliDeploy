"""Discover deployment material from fixed repository bytes; discovery is not verification."""
import hashlib
import re
from pathlib import PurePosixPath
from urllib.parse import urlsplit

import yaml

from app.agent.contracts import DeploymentAsset


def discover_deployment_assets(candidate):
    if not candidate.commit:
        return []
    result = []
    seen = set()

    def add(kind, location, path, content):
        if (kind, location) in seen:
            return
        seen.add((kind, location))
        result.append(DeploymentAsset(kind=kind, location=location,
            source_ref=f'{candidate.repo_url}@{candidate.commit}:{path}',
            source_digest=hashlib.sha256(content.encode()).hexdigest()))

    if candidate.homepage:
        homepage=urlsplit(candidate.homepage)
        if homepage.scheme in {'https','http'} and homepage.hostname and not homepage.username and not homepage.password:
            kind='INSTALL_DOC' if homepage.hostname.startswith('docs.') or homepage.hostname=='github.com' else 'OFFICIAL_SERVICE'
            result.append(DeploymentAsset(kind=kind,location=candidate.homepage,
                source_ref='github-api:'+candidate.repo_url+':homepage',
                source_digest=hashlib.sha256(candidate.homepage.encode()).hexdigest()))

    for path, content in candidate.key_files.items():
        relative = PurePosixPath(path)
        if relative.is_absolute() or '..' in relative.parts:
            continue
        name = relative.name.lower()
        if name in {'compose.yml', 'compose.yaml', 'docker-compose.yml', 'docker-compose.yaml'}:
            try:
                compose = yaml.safe_load(content)
            except yaml.YAMLError:
                compose = None
            if isinstance(compose, dict) and isinstance(compose.get('services'), dict):
                add('COMPOSE', path, path, content)
                for service in compose['services'].values():
                    image = service.get('image') if isinstance(service, dict) else None
                    if isinstance(image, str) and re.fullmatch(r'[\w./:@-]+', image):
                        add('IMAGE', image, path, content)
        elif name in {'deploy.sh', 'install.sh', 'setup.sh'}:
            add('SCRIPT', path, path, content)
        elif name.startswith('readme'):
            for line in content.splitlines():
                lowered = line.lower()
                if re.search(r'\bdemo\b|演示|体验站', lowered):
                    kind = 'DEMO'
                elif re.search(r'official (?:hosted )?(?:service|app)|hosted (?:service|version)|官方.{0,6}(服务|在线)|online service', lowered):
                    kind = 'OFFICIAL_SERVICE'
                elif re.search(r'deploy|install|部署|安装', lowered):
                    kind = 'INSTALL_DOC'
                else:
                    continue
                for url in re.findall(r'https?://[^\s<>\)\]]+', line):
                    parts = urlsplit(url)
                    if parts.hostname and not parts.username and not parts.password:
                        add(kind, url.rstrip('.,'), path, content)
            for image in re.findall(r'docker\s+(?:pull|run)\s+([\w./:@-]+)', content):
                add('IMAGE', image, path, content)
    return result

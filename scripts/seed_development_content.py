"""Seed local development with truthful GitHub retrievals and human-style posts."""
from __future__ import annotations

import secrets
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.engine import make_url

from app.apps.models import App, Conversation, Message, RequirementRecord
from app.community.models import CommunityPost
from app.config import settings
from app.database import SessionLocal
from app.jobs.models import Job, JobEvent
from app.models.user import User
from app.utils.security import get_password_hash


USERS = (
    ('linqi', '林栖', 'linqi@intellideploy.example'),
    ('chenmo', '陈墨', 'chenmo@intellideploy.example'),
    ('zhouyuan', '周予安', 'zhouyuan@intellideploy.example'),
    ('suhe', '苏禾', 'suhe@intellideploy.example'),
    ('yezhou', '叶舟', 'yezhou@intellideploy.example'),
)

REPOSITORIES = (
    dict(slug='pawzzle', owner='linqi', name='Pawzzle', repo_url='https://github.com/Elliottt001/Pawzzle', commit='10fd1a5aefd4143f18fc15538f9ff5611a159393', language='TypeScript', updated_at='2026-03-20T16:55:35Z', description='基于 Expo 与 Spring Boot 的宠物领养平台，通过问答画像、向量检索和重排帮助用户匹配合适的宠物。', tags=['宠物领养', 'Expo', 'Spring Boot'], prompt='我想部署 Pawzzle，先按仓库现有功能跑起来，确认移动端、后端和数据库依赖。'),
    dict(slug='mapify', owner='yezhou', name='Mapify', repo_url='https://github.com/Elliottt001/Mapify', commit='c982833f8b6c0f52b4b924c0ecafaa69e225e031', language='TypeScript', updated_at='2026-03-23T09:54:50Z', description='为多种大模型聊天网页增加可视化侧栏，把长对话整理成思维导图或树状结构，并支持导出。', tags=['浏览器扩展', '思维导图', 'LLM'], prompt='帮我看看 Mapify 能不能直接部署，至少保留对话结构展示和导出能力。'),
    dict(slug='quiz-studio', owner='zhouyuan', name='Quiz Studio', repo_url='https://github.com/Elliottt001/quiz-studio', commit='5655043ab658aa07f8749698886891a26c9b6f96', language='JavaScript', updated_at='2026-10-12T10:25:47Z', description='面向现场问答活动的浏览器应用，组织者可以编题、发布和开轮，参与者通过链接报名并作答。', tags=['现场问答', '活动工具', 'PostgreSQL'], prompt='部署 Quiz Studio，我想用它办一场现场答题活动，先确认组织者和参与者两条流程。'),
    dict(slug='desk-mate', owner='linqi', name='DeskMate', repo_url='https://github.com/Elliottt001/desk-mate', commit='d177bbf1f10f4c69377f89c58dba9f49ad910f39', language='C', updated_at='2026-07-28T16:40:50Z', description='基于 Tauri 的桌面宠物，会感知系统状态、做出性格化反应，并通过大模型与用户聊天。', tags=['桌面宠物', 'Tauri', 'LLM'], prompt='我想试试 DeskMate，先分析它的桌面端构建要求和大模型配置，再决定部署方式。'),
    dict(slug='timo', owner='zhouyuan', name='Timo', repo_url='https://github.com/Phil-Fan/Timo', commit='ddf5c7b093f80127faa114a853c657620dfedb7e', language='Swift', updated_at='2026-11-03T11:40:24Z', description='使用 SwiftUI、EventKit 和 Swift Charts 编写的 macOS 菜单栏番茄钟，支持专注分类、日历记录与统计。', tags=['macOS', '番茄钟', '时间管理'], prompt='帮我部署或打包 Timo，我主要想确认菜单栏计时、日历记录和统计功能。'),
    dict(slug='zju-coffee', owner='suhe', name='ZJU 早 C 晚 A', repo_url='https://github.com/Phil-Fan/zju-coffee', commit='99f3a20bcfc05769b2aeb0920444e3d893c5fc33', language='TypeScript', updated_at='2026-04-06T07:27:32Z', description='面向杭州咖啡与酒吧打卡场景的地图应用，项目基于 Next.js。', tags=['杭州', '地图', 'Next.js'], prompt='部署 zju-coffee，我想先看看地图页面和地点数据在本地环境里能不能正常工作。'),
    dict(slug='grs-enhance', owner='chenmo', name='grs-enhance', repo_url='https://github.com/Phil-Fan/grs-enhance', commit='cbd382b1141381a5d6a9c011a8914ee59313e04b', language='JavaScript', updated_at='2026-09-14T10:38:50Z', description='研究生选课系统用户脚本，提供悬浮课表、排队监视和教学班一键切换。', tags=['用户脚本', '选课', '效率工具'], prompt='帮我分析 grs-enhance 的安装方式，我想保留悬浮课表和排队提醒，但不要改动选课逻辑。'),
    dict(slug='gh-slim', owner='chenmo', name='gh-slim', repo_url='https://github.com/Phil-Fan/gh-slim', commit='1043e6eea712ad198a233f268cf16dcc7304a486', language='JavaScript', updated_at='2026-09-13T09:11:30Z', description='用于精简 GitHub Feed 的用户脚本，可以隐藏 PR 动态、Star、趋势仓库和推荐等卡片。', tags=['GitHub', '用户脚本', '信息过滤'], prompt='我想装 gh-slim，先确认脚本只处理 Feed 展示，不会影响仓库和账号数据。'),
)

POSTS = (
    dict(slug='pawzzle-notes', author='linqi', title=None, body='今天翻到 Pawzzle，宠物匹配不是简单选几个标签，而是先做一轮问答，再用向量检索筛候选。准备先把移动端和后端跑通，看看这套流程实际用起来顺不顺。', tags=['开源项目', '宠物领养'], created_at='2026-11-12T09:18:00+08:00'),
    dict(slug='k8s-permission', author='chenmo', title=None, body='有人在 K8s 上部署服务时碰到过 service account 权限不够吗？Pod 能起来，但读取资源列表会被拒绝。我不太想直接给最高权限，想找个权限收得住的配法。', tags=['Kubernetes', '部署求助'], created_at='2026-11-12T10:06:00+08:00'),
    dict(slug='timo-rhythm', author='zhouyuan', title=None, body='试着把一天拆成几个 30 分钟以后，反而没那么焦虑了。Timo 把专注记录写进日历这个思路挺适合我，至少晚上回看时不用再凭感觉猜今天做了什么。', tags=['时间管理', 'macOS'], created_at='2026-11-11T21:42:00+08:00'),
    dict(slug='coffee-map', author='suhe', title=None, body='最近想整理一份杭州适合带电脑坐一下午的店，正好看到 zju-coffee 这个地图项目。比起单纯收藏店名，我更想记插座、桌面大小和下午会不会太吵。', tags=['杭州', '地图'], created_at='2026-11-11T16:25:00+08:00'),
    dict(slug='mapify-long-chat', author='yezhou', title=None, body='长对话最麻烦的不是内容多，是过几天回来根本想不起当时从哪条分支聊出去的。Mapify 的树状视图挺对症，准备拿几段真实对话试试导出后的结构。', tags=['效率工具', 'LLM'], created_at='2026-11-10T22:13:00+08:00'),
    dict(slug='quiz-night', author='linqi', title='想办一场不用装 App 的答题夜', body='看了 Quiz Studio 的流程，参与者打开链接就能报名和作答，这点很适合临时活动。现在比较关心的是现场网络抖一下以后，交卷回执还能不能正常保住。', tags=['活动工具', '现场问答'], created_at='2026-11-10T19:34:00+08:00'),
)


def _dt(value: str) -> datetime:
    return datetime.fromisoformat(value.replace('Z', '+00:00'))


def _checkpoint(repository: dict) -> dict:
    return {
        'schema_version': 1,
        'requirement_revision': 1,
        'mode': 'baseline',
        'algorithm_version': 'fusion-v1',
        'retrieval': {
            'queries': [repository['name']],
            'completed': True,
            'candidates': [{
                'repo_url': repository['repo_url'],
                'commit': repository['commit'],
                'description': repository['description'],
                'last_commit_at': repository['updated_at'],
                'sources': ['github', 'readme'],
                'enrichment_status': 'COMPLETE',
            }],
        },
        'selected_sources': [{
            'url': repository['repo_url'],
            'commit': repository['commit'],
            'role': 'primary',
        }],
    }


def seed_development_content(session) -> dict[str, int]:
    users = {}
    for key, username, email in USERS:
        user = session.scalar(select(User).where(User.email == email))
        if user is None:
            user = User(username=username, email=email, hashed_password=get_password_hash(secrets.token_urlsafe(32)), is_active=True)
            session.add(user)
            session.flush()
        users[key] = user

    for repository in REPOSITORIES:
        slug = repository['slug']
        app_id = f'dev-content-app-{slug}'
        message_id = f'dev-content-message-{slug}-user'
        app = session.get(App, app_id)
        if app is None:
            app = App(id=app_id, owner_id=users[repository['owner']].id, name=repository['name'], prompt=repository['prompt'])
            session.add(app)
            session.flush()
        if session.scalar(select(Conversation).where(Conversation.app_id == app_id)) is None:
            session.add(Conversation(id=f'dev-content-conversation-{slug}', app_id=app_id))
        if session.get(Message, message_id) is None:
            session.add(Message(id=message_id, app_id=app_id, sequence=1, role='user', content=repository['prompt']))
        answer = f"我找到了 {repository['name']} 的公开仓库。{repository['description']}要按仓库当前版本继续准备部署吗？"
        if session.get(Message, f'dev-content-message-{slug}-assistant') is None:
            session.add(Message(id=f'dev-content-message-{slug}-assistant', app_id=app_id, sequence=2, role='assistant', content=answer))
        requirement = session.scalar(select(RequirementRecord).where(RequirementRecord.app_id == app_id, RequirementRecord.revision == 1))
        if requirement is None:
            session.add(RequirementRecord(
                id=f'dev-content-requirement-{slug}', app_id=app_id, revision=1,
                requirement={
                    'prompt': repository['prompt'],
                    'acceptance': [{'id': 'deploy-source', 'action': f"从 {repository['repo_url']} 准备部署", 'expected': '完成构建和验证后再提供可访问地址', 'private_data': False}],
                    'revision': 1,
                    'facts': [{'id': 'source-repository', 'source_message_id': message_id, 'quote': repository['repo_url'], 'kind': 'EXTERNAL', 'acceptance_ids': ['deploy-source']}],
                    'source_message_ids': [message_id],
                },
                review={'source': 'github', 'deployment_claimed': False},
            ))
        job = session.get(Job, f'dev-content-job-{slug}')
        if job is None:
            job = Job(
                id=f'dev-content-job-{slug}', app_id=app_id, operation_id=f'dev-content:{slug}:search',
                kind='GENERATE', status='WAITING_USER', phase='clarifying', checkpoint=_checkpoint(repository),
                requirement_revision=1, budget_units=100, used_units=0, question=answer,
            )
            session.add(job)
            session.flush()
            session.add(JobEvent(job_id=job.id, kind='question', public_payload={
                'id': 0, 'kind': 'question', 'message': answer, 'status': 'WAITING_USER',
                'phase': 'clarifying', 'usage_units': 0,
            }))

    for post_data in POSTS:
        post = session.get(CommunityPost, f"dev-content-post-{post_data['slug']}")
        if post is None:
            post = CommunityPost(
                id=f"dev-content-post-{post_data['slug']}", author_id=users[post_data['author']].id,
                title=post_data['title'], body=post_data['body'], tags=post_data['tags'],
                visibility='PUBLIC', created_at=_dt(post_data['created_at']),
            )
            session.add(post)
        else:
            post.author_id = users[post_data['author']].id
            post.title = post_data['title']
            post.body = post_data['body']
            post.tags = post_data['tags']
            post.visibility = 'PUBLIC'
            post.created_at = _dt(post_data['created_at'])
    session.flush()
    return {'users': len(USERS), 'apps': len(REPOSITORIES), 'posts': len(POSTS)}


def main() -> None:
    url = make_url(settings.DATABASE_URL)
    if url.get_backend_name() != 'postgresql' or url.database != 'intellideploy_dev' or url.host not in {'127.0.0.1', 'localhost'}:
        raise SystemExit('Refusing to seed anything except local intellideploy_dev PostgreSQL')
    with SessionLocal() as session:
        counts = seed_development_content(session)
        session.commit()
    print(f"seeded users={counts['users']} apps={counts['apps']} posts={counts['posts']}")


if __name__ == '__main__':
    main()

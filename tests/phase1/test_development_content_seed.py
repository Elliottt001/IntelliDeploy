from sqlalchemy import func, inspect, select


def test_development_content_seed_is_truthful_and_idempotent(pg_session):
    from app.apps.models import App, AppVersion, Instance, Message
    from app.community.models import CommunityPost, Publication
    from app.jobs.models import Job
    from app.models.user import User
    from scripts.seed_development_content import seed_development_content

    first = seed_development_content(pg_session)
    pg_session.commit()
    second = seed_development_content(pg_session)
    pg_session.commit()

    assert first == second == {"users": 5, "apps": 8, "posts": 6}
    users = list(pg_session.scalars(select(User).where(User.email.like("%@intellideploy.example"))))
    assert {user.username for user in users} == {"林栖", "陈墨", "周予安", "苏禾", "叶舟"}
    assert all("test" not in user.username.lower() and "admin" not in user.username.lower() for user in users)

    apps = list(pg_session.scalars(select(App).where(App.id.like("dev-content-app-%"))))
    jobs = list(pg_session.scalars(select(Job).where(Job.id.like("dev-content-job-%"))))
    posts = list(pg_session.scalars(select(CommunityPost).where(CommunityPost.id.like("dev-content-post-%"))))
    assert len(apps) == len(jobs) == 8
    assert len(posts) == 6
    assert pg_session.scalar(select(func.count()).select_from(Message).where(Message.app_id.like("dev-content-app-%"))) == 16

    for job in jobs:
        assert job.status == "WAITING_USER"
        assert job.phase == "clarifying"
        assert job.result is None
        assert job.used_units == 0
        sources = job.checkpoint["selected_sources"]
        candidates = job.checkpoint["retrieval"]["candidates"]
        assert len(sources) == len(candidates) == 1
        assert sources[0]["url"] == candidates[0]["repo_url"]
        assert sources[0]["url"].startswith("https://github.com/")
        assert len(sources[0]["commit"]) == 40
        assert not ({"stars", "views", "likes", "favorites", "comments", "rating", "downloads"} & set(candidates[0]))

    assert not list(pg_session.scalars(select(AppVersion).where(AppVersion.app_id.like("dev-content-app-%"))))
    assert not list(pg_session.scalars(select(Instance).where(Instance.app_id.like("dev-content-app-%"))))
    assert not list(pg_session.scalars(select(Publication).where(Publication.app_id.like("dev-content-app-%"))))
    assert all(post.body.strip() and post.visibility == "PUBLIC" for post in posts)
    assert all("admin" not in post.body.lower() and "test" not in post.body.lower() for post in posts)
    assert not ({"view_count", "like_count", "favorite_count", "comment_count", "rating"} & {column.name for column in inspect(CommunityPost).columns})

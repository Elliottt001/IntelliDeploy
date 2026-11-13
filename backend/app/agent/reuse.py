"""Reuse route decisions separated from raw keyword scores."""
from app.agent.contracts import ReuseDecision
from app.core.types import RepoSource, RoutePlan
from app.agent.ranking import _WEB_TYPES


class NoReusableSolution(ValueError):
    def __init__(self, closest_candidates):
        self.closest_candidates = closest_candidates
        super().__init__('尚未确认可直接使用的仓库；可以继续搜索、选择主体改造，或明确接受从头生成。')


class ExternalServiceSelected(Exception):
    def __init__(self, decision):
        self.decision = decision


def core_supported(requirement, assessment):
    known = {c.acceptance_id:c for c in assessment.capabilities}
    return all(a.id in known and known[a.id].status == 'SUPPORTED'
               for a in requirement.acceptance if a.importance == 'CORE')


def disclosed_differences(requirement, assessment):
    known={c.acceptance_id:c.status for c in assessment.capabilities}
    differences=list(assessment.differences)
    for item in requirement.acceptance:
        if item.importance=='PREFERENCE' and known.get(item.id)!='SUPPORTED':
            label='未确认偏好：' if known.get(item.id)!='MISSING' else '偏好差异：'
            differences.append(label+item.action)
    return list(dict.fromkeys(differences))


def validate_reuse_decision(decision, requirement, assessments):
    if decision.route == 'GENERATE_APP':
        if not requirement.delivery_policy.allow_generation:
            raise NoReusableSolution(assessments)
        return decision
    known = {(a.repo_url,a.commit):a for a in assessments}
    if not decision.selected_sources or any((s.url,s.commit) not in known for s in decision.selected_sources):
        raise ValueError('reuse source lacks assessment')
    for s in decision.selected_sources:
        if known[(s.url,s.commit)].requirement_revision != requirement.revision:
            raise ValueError('reuse assessment revision differs')
    primary = known[(decision.selected_sources[0].url,decision.selected_sources[0].commit)]
    if decision.delivery_kind == 'EXTERNAL_LINK':
        if requirement.delivery_policy.preference == 'SELF_HOSTED' or not core_supported(requirement,primary):
            raise ValueError('external service does not satisfy delivery policy or core requirements')
        if decision.deployment_asset is None or decision.deployment_asset.kind != 'OFFICIAL_SERVICE':
            raise ValueError('external delivery requires official service evidence')
    elif decision.route == 'DEPLOY_EXISTING' and not core_supported(requirement, primary):
        raise ValueError('direct deployment requires core coverage')
    return decision


def choose_reuse_decision(requirement, assessments, profiles):
    facts = {(p.repo_url,p.commit):p for p in profiles}
    core_ids={a.id for a in requirement.acceptance if a.importance=='CORE'}
    assessments=sorted(assessments,key=lambda a:(
        not core_supported(requirement,a),
        -sum(c.status=='SUPPORTED' and c.acceptance_id in core_ids for c in a.capabilities),
        len(a.adaptations)))
    usable = [a for a in assessments if (a.repo_url,a.commit) in facts
              and facts[(a.repo_url,a.commit)].license_status == 'ALLOWED']
    if requirement.delivery_policy.preference == 'EXISTING_SERVICE_FIRST':
        # Using a public official service does not distribute its source code.
        # Its actual availability/account/payment conditions are checked separately.
        for a in (a for a in assessments if (a.repo_url,a.commit) in facts):
            p = facts[(a.repo_url,a.commit)]
            asset = next((x for x in p.deployment_assets if x.kind=='OFFICIAL_SERVICE'),None)
            if asset and core_supported(requirement,a):
                return validate_reuse_decision(ReuseDecision(delivery_kind='EXTERNAL_LINK',
                    selected_sources=[RepoSource(url=a.repo_url,commit=a.commit,role='official service')],
                    assessment_refs=[a.repo_url+'@'+a.commit],deployment_asset=asset,differences=disclosed_differences(requirement,a)),requirement,assessments)
    for a in usable:
        p = facts[(a.repo_url,a.commit)]
        if p.compatibility.status != 'SUPPORTED' or p.project_type not in _WEB_TYPES:
            continue
        direct = core_supported(requirement,a)
        b = a.route_verdicts.get('B')
        if direct or (b and b.status == 'ELIGIBLE' and b.evidence_refs):
            asset = next((x for kind in ('COMPOSE','IMAGE','SCRIPT','INSTALL_DOC')
                          for x in p.deployment_assets if x.kind==kind),None)
            return validate_reuse_decision(ReuseDecision(delivery_kind='HOSTED_INSTANCE',
                route='DEPLOY_EXISTING' if direct else 'MODIFY_EXISTING',
                selected_sources=[RepoSource(url=a.repo_url,commit=a.commit,role='principal')],
                assessment_refs=[a.repo_url+'@'+a.commit],deployment_asset=asset,
                differences=disclosed_differences(requirement,a),adaptations=a.adaptations),requirement,assessments)
    # C remains the evidence-bound gap/integration route after a usable principal is selected.
    if requirement.delivery_policy.allow_generation:
        return ReuseDecision(delivery_kind='HOSTED_INSTANCE',route='GENERATE_APP')
    raise NoReusableSolution(assessments)


def route_from_decision(decision):
    if decision.delivery_kind == 'EXTERNAL_LINK':
        raise ExternalServiceSelected(decision)
    return RoutePlan(route=decision.route,sources=decision.selected_sources,
        steps=['沿用已确认主体和官方部署材料，只补必要缺口'],reason='source-bound reuse decision',confidence='HIGH')

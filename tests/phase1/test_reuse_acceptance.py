from scripts.summarize_phase1_evaluations import summarize_pairs


def test_external_link_is_not_hosted_deployment_success():
    from scripts.summarize_phase1_evaluations import summarize_reuse_records
    summary=summarize_reuse_records([
        {'delivery_kind':'EXTERNAL_LINK','status':'SUCCEEDED','route':None},
        {'delivery_kind':'HOSTED_INSTANCE','status':'FAILED','route':'DEPLOY_EXISTING'},
    ])
    assert summary['external_link_successes']==1
    assert summary['hosted_successes']==0


def test_external_pairs_never_authorize_hybrid_default():
    rows=[{'pair_id':'pair','algorithm_mode':mode,'case_id':'notes','delivery_kind':'EXTERNAL_LINK',
           'status':'SUCCEEDED','source_mode':'real','real_delivery_passed':True,
           'cost_status':'known','cost_units':1,'evidence_gate':{'status':'PASS'}} for mode in ['baseline','hybrid']]
    result=summarize_pairs(rows)
    assert result['hybrid_default_ready'] is False
    assert 'EXTERNAL_LINK_NOT_HOSTED_PAIR' in result['not_run_reasons']

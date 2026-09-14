with open("backend/tests/test_approvals_api.py", "a") as f:
    f.write("""
def test_submission_isolation_azure(test_db):
    from app.models.cloud import CloudAccount, CloudProvider
    from app.models.resource import Resource
    from app.models.tagging import TaggingChange, ChangeStatus, TaggingBatch, BatchStatus

    # Azure Account
    azure_acc = CloudAccount(id=1, name="Azure Sub", account_id="sub-1", provider=CloudProvider.AZURE, account_identifier="sub-1")
    test_db.add(azure_acc)
    test_db.commit()

    # Resources in the same Resource Group
    res1 = Resource(id=1, cloud_account_id=1, resource_name="res1", resource_type="vm", resource_group="rg-1")
    res2 = Resource(id=2, cloud_account_id=1, resource_name="res2", resource_type="vm", resource_group="rg-1")
    test_db.add_all([res1, res2])
    test_db.commit()

    # Batch only includes res1
    batch = TaggingBatch(batch_id="AZURE-B1", cloud="AZURE", scope="sub-1", status=BatchStatus.PENDING_APPROVAL, created_by=1)
    test_db.add(batch)
    test_db.commit()

    tc1 = TaggingChange(batch_id=batch.id, resource_id=res1.id, tag_key="ENV", proposed_value="PROD", status=ChangeStatus.PENDING_APPROVAL)
    # tc2 belongs to a different batch for res2
    batch2 = TaggingBatch(batch_id="AZURE-B2", cloud="AZURE", scope="sub-1", status=BatchStatus.PENDING_APPROVAL, created_by=1)
    test_db.add(batch2)
    test_db.commit()
    tc2 = TaggingChange(batch_id=batch2.id, resource_id=res2.id, tag_key="ENV", proposed_value="DEV", status=ChangeStatus.PENDING_APPROVAL)
    
    test_db.add_all([tc1, tc2])
    test_db.commit()

    # Approve rg-1 from batch 1
    resp = client.post(f"/api/approvals/batches/{batch.batch_id}/decide", json={
        "scope_type": "RESOURCE_GROUP",
        "scope_value": "rg-1",
        "action": "APPROVE",
        "account_id": "sub-1"
    })
    assert resp.status_code == 200

    test_db.refresh(tc1)
    test_db.refresh(tc2)
    
    # Only tc1 is approved
    assert tc1.status == ChangeStatus.APPROVED
    assert tc2.status == ChangeStatus.PENDING_APPROVAL


def test_submission_isolation_aws(test_db):
    from app.models.cloud import CloudAccount, CloudProvider
    from app.models.resource import Resource
    from app.models.tagging import TaggingChange, ChangeStatus, TaggingBatch, BatchStatus

    aws_acc = CloudAccount(id=2, name="AWS Acc", account_id="acc-1", provider=CloudProvider.AWS, account_identifier="acc-1")
    test_db.add(aws_acc)
    test_db.commit()

    # Resources in the same Region
    res3 = Resource(id=3, cloud_account_id=2, resource_name="res3", resource_type="ec2", location="ap-south-1")
    res4 = Resource(id=4, cloud_account_id=2, resource_name="res4", resource_type="ec2", location="ap-south-1")
    test_db.add_all([res3, res4])
    test_db.commit()

    batch = TaggingBatch(batch_id="AWS-B1", cloud="AWS", scope="acc-1", status=BatchStatus.PENDING_APPROVAL, created_by=1)
    test_db.add(batch)
    test_db.commit()

    tc3 = TaggingChange(batch_id=batch.id, resource_id=res3.id, tag_key="ENV", proposed_value="PROD", status=ChangeStatus.PENDING_APPROVAL)
    
    batch2 = TaggingBatch(batch_id="AWS-B2", cloud="AWS", scope="acc-1", status=BatchStatus.PENDING_APPROVAL, created_by=1)
    test_db.add(batch2)
    test_db.commit()
    tc4 = TaggingChange(batch_id=batch2.id, resource_id=res4.id, tag_key="ENV", proposed_value="DEV", status=ChangeStatus.PENDING_APPROVAL)
    
    test_db.add_all([tc3, tc4])
    test_db.commit()

    # Approve ap-south-1 region from batch 1
    resp = client.post(f"/api/approvals/batches/{batch.batch_id}/decide", json={
        "scope_type": "REGION",
        "scope_value": "ap-south-1",
        "action": "APPROVE",
        "account_id": "acc-1"
    })
    assert resp.status_code == 200

    test_db.refresh(tc3)
    test_db.refresh(tc4)
    
    # Only tc3 is approved
    assert tc3.status == ChangeStatus.APPROVED
    assert tc4.status == ChangeStatus.PENDING_APPROVAL

def test_aws_resource_type_approval(test_db):
    from app.models.cloud import CloudAccount, CloudProvider
    from app.models.resource import Resource
    from app.models.tagging import TaggingChange, ChangeStatus, TaggingBatch, BatchStatus

    aws_acc = CloudAccount(id=3, name="AWS Acc 2", account_id="acc-2", provider=CloudProvider.AWS, account_identifier="acc-2")
    test_db.add(aws_acc)
    test_db.commit()

    res5 = Resource(id=5, cloud_account_id=3, resource_name="res5", resource_type="s3", location="us-east-1")
    test_db.add(res5)
    test_db.commit()

    batch = TaggingBatch(batch_id="AWS-B3", cloud="AWS", scope="acc-2", status=BatchStatus.PENDING_APPROVAL, created_by=1)
    test_db.add(batch)
    test_db.commit()

    tc5 = TaggingChange(batch_id=batch.id, resource_id=res5.id, tag_key="ENV", proposed_value="PROD", status=ChangeStatus.PENDING_APPROVAL)
    test_db.add(tc5)
    test_db.commit()

    # Approve s3 resource type in us-east-1
    resp = client.post(f"/api/approvals/batches/{batch.batch_id}/decide", json={
        "scope_type": "RESOURCE_TYPE",
        "scope_value": "s3",
        "action": "APPROVE",
        "account_id": "acc-2",
        "region": "us-east-1"
    })
    assert resp.status_code == 200

    test_db.refresh(tc5)
    assert tc5.status == ChangeStatus.APPROVED

def test_individual_resource_approval(test_db):
    from app.models.cloud import CloudAccount, CloudProvider
    from app.models.resource import Resource
    from app.models.tagging import TaggingChange, ChangeStatus, TaggingBatch, BatchStatus

    res6 = Resource(id=6, cloud_account_id=1, resource_name="res6", resource_type="vm", resource_group="rg-1")
    test_db.add(res6)
    test_db.commit()

    batch = TaggingBatch(batch_id="INDIVIDUAL-B1", cloud="AZURE", scope="sub-1", status=BatchStatus.PENDING_APPROVAL, created_by=1)
    test_db.add(batch)
    test_db.commit()

    tc6 = TaggingChange(batch_id=batch.id, resource_id=res6.id, tag_key="ENV", proposed_value="PROD", status=ChangeStatus.PENDING_APPROVAL)
    test_db.add(tc6)
    test_db.commit()

    resp = client.post(f"/api/approvals/batches/{batch.batch_id}/decide", json={
        "scope_type": "RESOURCE",
        "scope_value": "6",
        "action": "APPROVE"
    })
    assert resp.status_code == 200

    test_db.refresh(tc6)
    assert tc6.status == ChangeStatus.APPROVED
""")

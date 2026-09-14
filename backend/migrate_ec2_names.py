import os
import sys
import logging

# Ensure we can import app modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models.resource import Resource
from app.models.cloud import CloudProvider

def main():
    db = SessionLocal()
    try:
        # Get all AWS EC2 instances
        resources = db.query(Resource).filter(
            Resource.provider == CloudProvider.AWS,
            Resource.resource_type == 'ec2/instance'
        ).all()
        
        updated_count = 0
        skipped_count = 0
        
        for res in resources:
            # Check if Name tag exists
            if res.cloud_tags and "Name" in res.cloud_tags:
                new_name = res.cloud_tags["Name"]
                # If current name is different, update it
                if res.resource_name != new_name:
                    print(f"Updating {res.resource_id.split('/')[-1]}: {res.resource_name} -> {new_name}")
                    res.resource_name = new_name
                    updated_count += 1
                else:
                    skipped_count += 1
            else:
                skipped_count += 1
                
        if updated_count > 0:
            db.commit()
            print(f"Successfully updated {updated_count} EC2 instances.")
        else:
            print("No updates required.")
            
        print(f"Skipped {skipped_count} EC2 instances (already correct or no Name tag).")
        
    finally:
        db.close()

if __name__ == "__main__":
    main()

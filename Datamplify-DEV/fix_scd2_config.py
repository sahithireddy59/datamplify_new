#!/usr/bin/env python3
"""
Script to fix the SCD2 configuration to support both insert and update operations.
This updates the JSON config and forces Airflow to reload the DAG.
"""
import json
import os
import subprocess
import time

CONFIG_FILE = 'Configs/FlowBoard/29bc5cc3-42dd-44ed-b4a9-2483a3e46b32/127001-20251117085609-7.json'
DAG_ID = '127001-20251117085609-7'

def update_config():
    """Update the JSON configuration to support both insert and update."""
    print(f"Reading config from: {CONFIG_FILE}")
    
    with open(CONFIG_FILE, 'r') as f:
        config = json.load(f)
    
    # Find the target task
    target_task = None
    target_index = None
    for i, task in enumerate(config['tasks']):
        if task['id'] == 'TGT_dim_customer':
            target_task = task
            target_index = i
            break
    
    if not target_task:
        print("ERROR: Target task 'TGT_dim_customer' not found!")
        return False
    
    print(f"Current previous_task_id: {target_task['previous_task_id']}")
    print(f"Current update_strategy: {target_task.get('update_strategy')}")
    
    # Update the configuration
    target_task['previous_task_id'] = ['update_strategy_1', 'update_strategy_2']
    target_task['previous_instance_id'] = ['update_strategy_1', 'update_strategy_2']
    target_task['update_strategy'] = 'scd2'
    
    # Also fix expression_2 to output correct fields for update
    for task in config['tasks']:
        if task['id'] == 'expression_2':
            # Keep only the fields needed for update
            task['expressions_list'] = [
                ["customer_sk", "bigint", "router_1.customer_sk"],
                ["end_date", "date", "CURRENT_DATE - INTERVAL '1 day'"],
                ["is_current", "varchar", "'N'"]
            ]
            print("Fixed expression_2 to output only update fields")
        
        # Fix update_strategy_2 to use customer_sk as key column
        if task['id'] == 'update_strategy_2':
            task['key_columns'] = ['customer_sk']
            print("Fixed update_strategy_2 to use customer_sk as key column")
    
    # Save the updated config
    config['tasks'][target_index] = target_task
    
    with open(CONFIG_FILE, 'w') as f:
        json.dump(config, f, indent=4)
    
    print(f"\n✅ Updated configuration:")
    print(f"   previous_task_id: {target_task['previous_task_id']}")
    print(f"   update_strategy: {target_task['update_strategy']}")
    
    return True

def delete_dag():
    """Delete the DAG from Airflow to force recreation."""
    print(f"\nDeleting DAG {DAG_ID} from Airflow...")
    
    try:
        result = subprocess.run(
            ['docker', 'exec', 'datamplify-dev-airflow-scheduler-1', 
             'airflow', 'dags', 'delete', DAG_ID, '-y'],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            print("✅ DAG deleted successfully")
            return True
        else:
            print(f"⚠️  DAG deletion returned code {result.returncode}")
            print(result.stderr)
            return False
    except Exception as e:
        print(f"❌ Failed to delete DAG: {e}")
        return False

def touch_dag_file():
    """Touch the FlowBoard.py file to trigger Airflow to reload."""
    dag_file = 'Airflow/Dags/FlowBoard.py'
    print(f"\nTouching {dag_file} to trigger reload...")
    
    try:
        # Update the file's modification time
        os.utime(dag_file, None)
        print("✅ File touched successfully")
        return True
    except Exception as e:
        print(f"❌ Failed to touch file: {e}")
        return False

def restart_scheduler():
    """Restart the Airflow scheduler."""
    print("\nRestarting Airflow scheduler...")
    
    try:
        result = subprocess.run(
            ['docker', 'restart', 'datamplify-dev-airflow-scheduler-1'],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            print("✅ Scheduler restarted successfully")
            return True
        else:
            print(f"❌ Scheduler restart failed: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ Failed to restart scheduler: {e}")
        return False

def main():
    print("=" * 60)
    print("SCD2 Configuration Fix Script")
    print("=" * 60)
    
    # Step 1: Update the config
    if not update_config():
        print("\n❌ Failed to update configuration")
        return 1
    
    # Step 2: Delete the DAG
    delete_dag()
    
    # Step 3: Touch the DAG file
    touch_dag_file()
    
    # Step 4: Restart scheduler
    restart_scheduler()
    
    print("\n" + "=" * 60)
    print("✅ Configuration updated successfully!")
    print("=" * 60)
    print("\nNext steps:")
    print("1. Wait 30 seconds for the scheduler to start")
    print("2. Trigger the DAG from the Airflow UI")
    print("3. Check the logs - you should see:")
    print("   - Previous Task ID: ['update_strategy_1', 'update_strategy_2']")
    print("   - Found 2 upstream task(s)")
    print("   - Processing both insert and update operations")
    print("\n⚠️  NOTE: If the UI overwrites this config, you'll need to")
    print("   update the FlowBoard UI to set previous_task_id as a list.")
    
    return 0

if __name__ == '__main__':
    exit(main())

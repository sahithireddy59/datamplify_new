"""
Utility to refresh Airflow DAGs when FlowBoard configurations are updated.
Call this from your Django views after saving FlowBoard changes.
"""
import os
import subprocess
import logging

logger = logging.getLogger(__name__)


def refresh_airflow_dags():
    """
    Touch the FlowBoard.py file to trigger Airflow to reload DAGs.
    This should be called after updating FlowBoard configurations.
    """
    try:
        dag_file = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            'Airflow', 'Dags', 'FlowBoard.py'
        )
        
        if os.path.exists(dag_file):
            # Touch the file to update its modification time
            os.utime(dag_file, None)
            logger.info(f"✅ Touched {dag_file} to trigger Airflow DAG reload")
            return True
        else:
            logger.error(f"❌ DAG file not found: {dag_file}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Failed to refresh Airflow DAGs: {str(e)}")
        return False


def refresh_airflow_scheduler_docker():
    """
    Restart the Airflow scheduler container to force DAG reload.
    Use this as a fallback if touching the file doesn't work.
    """
    try:
        result = subprocess.run(
            ['docker', 'restart', 'datamplify-dev-airflow-scheduler-1'],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            logger.info("✅ Airflow scheduler restarted successfully")
            return True
        else:
            logger.error(f"❌ Failed to restart scheduler: {result.stderr}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Failed to restart Airflow scheduler: {str(e)}")
        return False

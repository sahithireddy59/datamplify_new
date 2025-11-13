
from pytz import utc

from sqlalchemy import create_engine,inspect,text
from datetime import datetime, timezone


from django.db.models import Subquery, OuterRef,IntegerField,CharField
from django.db.models.functions import Cast
from django.db.utils import IntegrityError
from django.http import JsonResponse, HttpResponse
from Connections.utils import generate_engine

import subprocess,paramiko

import logging


logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)



def file_watcher(path_pattern, timeout=-1, sleep_interval=5):

    import time
    import glob

    start_time = time.time()
    while True:
        files = glob.glob(path_pattern)
        if files:
            print(f"Files found: {files}")
            return True
        if timeout != -1 and (time.time() - start_time) > timeout:
            print("Timeout reached, file(s) not found")
            return False
        time.sleep(sleep_interval)

def bash_cmd(command_type,commands,timeout=1,sleep_interval=1):
    if command_type.lower() =='external':
        command = f"""
        bash -c '
        {commands}
        '
        """

        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        if result.returncode ==0:
            logger.info(f'Commands Run Sucessfully {result.stdout}')
        else:
            logger.error(f'Error {result.stderr}')
    elif command_type.lower() == 'file_watcher':

        result = file_watcher(commands,timeout,sleep_interval)
        return result




def run_sql_commands(queries,hierarchy_id,user_id):
    engine = generate_engine(hierarchy_id,user_id=user_id)
    results =[]
    with engine['engine'].connect() as conn:
    # Start a transaction block
        trans = conn.begin()
        try:
            for query in queries.split(';'):
                if query.strip():  # Avoid executing empty strings
                    output = conn.execute(text(query))

                # Only fetch results if the statement returns rows
                if output.returns_rows:
                    rows = [dict(row._mapping) for row in output.fetchall()]
                    results.extend(rows)
                else:
                    logger.info(f"Executed non-returning query: {query}")
            
        except Exception as e:
            logger.error(f'Error: {str(e)}')
            trans.rollback()
    return results if results else None
    



FROM apache/airflow:2.8.2-python3.10
USER root
COPY requirements.txt /
RUN chown airflow: /requirements.txt
USER airflow
ARG AIRFLOW_CONSTRAINTS_URL="https://raw.githubusercontent.com/apache/airflow/constraints-2.8.2/constraints-3.10.txt"
RUN pip install --no-cache-dir -r /requirements.txt --constraint ${AIRFLOW_CONSTRAINTS_URL}
from Datamplify import settings
import requests,pytz

from datetime import datetime, timezone
from dateutil.relativedelta import relativedelta



def airflow_token():
    login_url = settings.airflow_url
    payload = {"username": f"{settings.airflow_username}", "password": f"{settings.airflow_password}"}
    response = requests.post(
            login_url,
            json=payload,  
            headers={"Content-Type": "application/json"}
        )
    if response.status_code ==201:
        data = response.json()
        return data.get('access_token')
    else:
        return 'unauthorised'
    


def time_ago(timestamp_str):
    # Parse ISO timestamp
    if isinstance(timestamp_str, str):
        if timestamp_str.endswith("Z"):
            timestamp = timestamp_str[:-1] + "+00:00"
        timestamp = datetime.fromisoformat(timestamp)
    
    # If it's already datetime, use directly
    if isinstance(timestamp_str, datetime):
        timestamp = timestamp_str
        if timestamp.tzinfo is None:  # make it timezone-aware
            timestamp = timestamp.replace(tzinfo=timezone.utc)
    else:
        raise TypeError("time_ago() expects str or datetime, got %s" % type(timestamp))

    now = datetime.now(pytz.utc)
    delta = relativedelta(now, timestamp)
    
    if delta.years > 0:
        if delta.months > 0:
            return f"{delta.years} years {delta.months} months ago"
        return f"{delta.years} years ago"
    elif delta.months > 0:
        return f"{delta.months} months ago"
    elif delta.days > 0:
        return f"{delta.days} days ago"
    elif delta.hours > 0:
        return f"{delta.hours} hours ago"
    elif delta.minutes > 0:
        return f"{delta.minutes} mins ago"
    else:
        return "just now"

# Example usage




def count_by_date(current_runs):
    total_runs = current_runs.count()
    success_count = current_runs.filter(status="success").count()
    failure_count = current_runs.filter(status="failed").count()
    running_count = current_runs.filter(status="running").count()

    counts = {
        'success':success_count,
        'failed':failure_count,
        'running':running_count
    }

    success_rate = (success_count / total_runs * 100) if total_runs else 0
    failure_rate = (failure_count / total_runs * 100) if total_runs else 0
    running_rate = (running_count / total_runs * 100) if total_runs else 0

    rates = {
        'success':round(success_rate,0),
        'failed':round(failure_rate,0),
        'running':round(running_rate,0)
    }
    return {
        'total_runs':total_runs,
        'counts':counts,
        'rate':rates
    }


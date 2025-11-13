from Datamplify import settings
import requests

from datetime import datetime
from dateutil.relativedelta import relativedelta
from django.utils import timezone



def airflow_token():
    """
    Get authentication session for Airflow.
    Since the REST API token endpoint is not available, we'll use session-based auth.
    """
    import requests
    from requests.auth import HTTPBasicAuth
    
    # Try basic auth first (most common for Airflow API)
    try:
        # Test if basic auth works with a simple API call
        test_url = f"{settings.airflow_host}/api/v2/dags"
        auth = HTTPBasicAuth(settings.airflow_username, settings.airflow_password)
        response = requests.get(test_url, auth=auth, timeout=5)
        
        if response.status_code == 200:
            # Basic auth works, return the auth object
            return auth
        elif response.status_code == 404:
            # API endpoint doesn't exist, but auth might be working
            # Try with health endpoint
            health_url = f"{settings.airflow_host}/health"
            health_response = requests.get(health_url, auth=auth, timeout=5)
            if health_response.status_code == 200:
                return auth
    except:
        pass
    
    # If basic auth doesn't work, try session-based login
    try:
        session = requests.Session()
        
        # Get the login page to extract CSRF token
        login_page_url = f"{settings.airflow_host}/login/"
        login_page = session.get(login_page_url, timeout=10)
        
        if login_page.status_code == 200:
            # Extract CSRF token from the page
            import re
            csrf_match = re.search(r'name="csrf_token".*?value="([^"]+)"', login_page.text)
            if csrf_match:
                csrf_token = csrf_match.group(1)
                
                # Perform login
                login_data = {
                    'username': settings.airflow_username,
                    'password': settings.airflow_password,
                    'csrf_token': csrf_token
                }
                
                login_response = session.post(login_page_url, data=login_data, timeout=10)
                
                # Check if login was successful (redirect or success page)
                if login_response.status_code in [200, 302] and 'login' not in login_response.url.lower():
                    return session
    except:
        pass
    
    # If all else fails, return None to indicate auth failure
    return None
    


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
            timestamp = timezone.make_aware(timestamp)
    else:
        raise TypeError("time_ago() expects str or datetime, got %s" % type(timestamp))

    now = timezone.now()
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


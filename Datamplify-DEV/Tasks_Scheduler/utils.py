from datetime import datetime, timedelta
from croniter import croniter
import pendulum

def calculate_next_run(schedule_type, schedule_value, tzinfo='UTC'):
    """
    Returns the next run datetime based on schedule type.
    Handles both cron expressions and airflow-style presets.
    Returns a Python datetime.datetime object ready for Django DateTimeField.
    """
    now = pendulum.now(tzinfo)

    def pendulum_to_python(p):
        """Convert Pendulum datetime to native Python datetime (timezone-aware)"""
        return datetime(
            year=p.year,
            month=p.month,
            day=p.day,
            hour=p.hour,
            minute=p.minute,
            second=p.second,
            microsecond=p.microsecond,
            tzinfo=p.tzinfo  # timezone-aware
        )

    if schedule_type == 'custom':
        iter = croniter(schedule_value, now.in_timezone('UTC').naive())
        next_dt = iter.get_next(datetime)
        # convert naive croniter datetime to pendulum with correct tz
        next_p = pendulum.instance(next_dt, tz=tzinfo)
        return pendulum_to_python(next_p)

    elif schedule_type == 'preset':
        if schedule_value == '@once':
            return None
        elif schedule_value == '@hourly':
            p = now.add(hours=1).start_of('hour')
        elif schedule_value in ('@daily', '@midnight'):
            p = now.add(days=1).start_of('day')
        elif schedule_value == '@weekly':
            p = now.add(weeks=1).start_of('week')
        elif schedule_value == '@monthly':
            p = now.add(months=1).start_of('month')
        elif schedule_value == '@quarterly':
            current_quarter = ((now.month - 1) // 3) + 1
            next_quarter_month = ((current_quarter % 4) * 3) + 1
            next_quarter_year = now.year
            if next_quarter_month <= now.month:
                next_quarter_year += 1
            p = now.replace(year=next_quarter_year, month=next_quarter_month, day=1, hour=0, minute=0, second=0, microsecond=0)
        elif schedule_value in ('@yearly', '@annually'):
            p = now.add(years=1).start_of('year')
        else:
            raise ValueError(f"Unsupported schedule preset: {schedule_value}")

        return pendulum_to_python(p)

    else:
        raise ValueError(f"Unsupported schedule type: {schedule_type}")

from django.db import models
from Connections.models import TimeStampedModel
import uuid
# Create your models here.
class RunHistory(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run_id = models.CharField(max_length=100, unique=True)  # airflow dag_run_id
    source_type = models.CharField(max_length=20)
    source_id = models.CharField()  # FlowBoard.id or TaskPlan.id
    name = models.CharField()
    status = models.CharField(max_length=20, default="pending")
    started_at = models.DateTimeField()
    finished_at = models.DateTimeField(null=True, blank=True)
    user_id = models.UUIDField(null=True, blank=True)

    class Meta:
        db_table = "run_history"

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SyncConnectorViewSet, SyncJobViewSet, SyncTableViewSet,
    SyncRunViewSet, SyncStatsView
)

router = DefaultRouter()
router.register(r'connectors', SyncConnectorViewSet, basename='sync-connector')
router.register(r'jobs', SyncJobViewSet, basename='sync-job')
router.register(r'tables', SyncTableViewSet, basename='sync-table')
router.register(r'runs', SyncRunViewSet, basename='sync-run')

urlpatterns = [
    path('', include(router.urls)),
    path('stats/', SyncStatsView.as_view(), name='sync-stats'),
]

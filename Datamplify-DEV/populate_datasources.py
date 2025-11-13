#!/usr/bin/env python
"""
Script to populate DataSources table with common connection types
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Datamplify.settings')
django.setup()

from Connections.models import DataSources

# Define common data sources
data_sources = [
    {'name': 'PostgreSQL', 'type': 'DATABASE'},
    {'name': 'MySQL', 'type': 'DATABASE'},
    {'name': 'Oracle', 'type': 'DATABASE'},
    {'name': 'SQL Server', 'type': 'DATABASE'},
    {'name': 'SQLite', 'type': 'DATABASE'},
    {'name': 'MongoDB', 'type': 'DATABASE'},
    {'name': 'Redis', 'type': 'DATABASE'},
    {'name': 'Cassandra', 'type': 'DATABASE'},
    {'name': 'Snowflake', 'type': 'DATABASE'},
    {'name': 'CSV', 'type': 'FILES'},
    {'name': 'Excel', 'type': 'FILES'},
    {'name': 'JSON', 'type': 'FILES'},
    {'name': 'XML', 'type': 'FILES'},
    {'name': 'Parquet', 'type': 'FILES'},
    {'name': 'SFTP', 'type': 'REMOTE_FILES'},
    {'name': 'FTP', 'type': 'REMOTE_FILES'},
    {'name': 'S3', 'type': 'REMOTE_FILES'},
    {'name': 'SMB', 'type': 'REMOTE_FILES'},
]

# Create data sources
created_count = 0
for ds in data_sources:
    obj, created = DataSources.objects.get_or_create(
        name=ds['name'],
        defaults={'type': ds['type']}
    )
    if created:
        created_count += 1
        print(f"✓ Created: {ds['name']} ({ds['type']})")
    else:
        print(f"  Exists: {ds['name']} ({ds['type']})")

print(f"\n✅ Done! Created {created_count} new data sources.")
print(f"📊 Total data sources in database: {DataSources.objects.count()}")

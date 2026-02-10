from django.core.management.base import BaseCommand
from Connections.models import DataSources


class Command(BaseCommand):
    help = 'Create default data sources/connection types'

    def handle(self, *args, **kwargs):
        # Define all connection types in exact order provided
        datasources = [
            {'name': 'POSTGRESQL', 'type': 'DATABASE'},
            {'name': 'CSV', 'type': 'FILES'},
            {'name': 'SFTP', 'type': 'REMOTE_FILES'},
            {'name': 'FTP', 'type': 'REMOTE_FILES'},
            {'name': 'SMB', 'type': 'REMOTE_FILES'},
            {'name': 'MONGODB', 'type': 'DATABASE'},
            {'name': 'ORACLE', 'type': 'DATABASE'},
            {'name': 'MICROSOFTSQLSERVER', 'type': 'DATABASE'},
            {'name': 'MYSQL', 'type': 'DATABASE'},
            {'name': 'SNOWFLAKE', 'type': 'DATABASE'},
            {'name': 'NINJA', 'type': 'INTEGRATIONS'},
            {'name': 'CONNECTWISE', 'type': 'INTEGRATIONS'},
            {'name': 'HALOPSA', 'type': 'INTEGRATIONS'},
            {'name': 'SHOPIFY', 'type': 'INTEGRATIONS'},
            {'name': 'TALLY', 'type': 'INTEGRATIONS'},
            {'name': 'QUICKBOOKS', 'type': 'INTEGRATIONS'},
            {'name': 'SALESFORCE', 'type': 'INTEGRATIONS'},
            {'name': 'JIRA', 'type': 'INTEGRATIONS'},
            {'name': 'HUBSPOT', 'type': 'INTEGRATIONS'},
            {'name': 'GOOGLESHEET', 'type': 'INTEGRATIONS'},
            {'name': 'DBT', 'type': 'INTEGRATIONS'},
            {'name': 'PAX8', 'type': 'INTEGRATIONS'},
            {'name': 'BAMBOOHR', 'type': 'INTEGRATIONS'},
            {'name': 'ZOHO_CRM', 'type': 'INTEGRATIONS'},
            {'name': 'ZOHO_INVENTORY', 'type': 'INTEGRATIONS'},
            {'name': 'ZOHO_BOOKS', 'type': 'INTEGRATIONS'},
            {'name': 'GOOGLEANALYTIC', 'type': 'INTEGRATIONS'},
            {'name': 'EXCEL', 'type': 'FILES'},
        ]

        created_count = 0
        skipped_count = 0

        for ds_data in datasources:
            # Check if datasource already exists
            existing = DataSources.objects.filter(
                name=ds_data['name'],
                type=ds_data['type']
            ).first()

            if existing:
                self.stdout.write(
                    self.style.WARNING(f"⚠️  Skipped: {ds_data['name']} ({ds_data['type']}) - already exists")
                )
                skipped_count += 1
            else:
                # Create new datasource
                DataSources.objects.create(
                    name=ds_data['name'],
                    type=ds_data['type']
                )
                self.stdout.write(
                    self.style.SUCCESS(f"✅ Created: {ds_data['name']} ({ds_data['type']})")
                )
                created_count += 1

        # Summary
        self.stdout.write("\n" + "="*60)
        self.stdout.write(self.style.SUCCESS(f"✅ Created: {created_count} data sources"))
        self.stdout.write(self.style.WARNING(f"⚠️  Skipped: {skipped_count} data sources (already exist)"))
        self.stdout.write("="*60 + "\n")

        # Display all datasources in ID order (insertion order)
        all_datasources = DataSources.objects.all().order_by('id')
        self.stdout.write(f"\n📊 Total Data Sources in Database: {all_datasources.count()}\n")
        
        self.stdout.write(f"{'ID':<5} {'NAME':<30} {'TYPE':<20}")
        self.stdout.write(f"{'-'*5} {'-'*30} {'-'*20}")
        
        for ds in all_datasources:
            self.stdout.write(f"{ds.id:<} {ds.name:<30} {ds.type:<20}")

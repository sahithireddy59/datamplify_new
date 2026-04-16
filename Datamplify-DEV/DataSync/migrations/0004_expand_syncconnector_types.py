from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('DataSync', '0003_alter_syncjob_sync_mode_incremental_auto'),
    ]

    operations = [
        migrations.AlterField(
            model_name='syncconnector',
            name='connector_type',
            field=models.CharField(
                choices=[
                    ('hubspot', 'HubSpot'),
                    ('salesforce', 'Salesforce'),
                    ('shopify', 'Shopify'),
                    ('quickbooks', 'QuickBooks'),
                    ('jira', 'Jira'),
                    ('pax8', 'Pax8'),
                    ('bamboohr', 'BambooHR'),
                    ('zoho_crm', 'Zoho CRM'),
                    ('zoho_books', 'Zoho Books'),
                    ('zoho_inventory', 'Zoho Inventory'),
                    ('tally', 'Tally'),
                    ('dbt', 'dbt'),
                    ('postgresql', 'PostgreSQL'),
                    ('mysql', 'MySQL'),
                    ('api', 'REST API'),
                ],
                max_length=50,
            ),
        ),
    ]

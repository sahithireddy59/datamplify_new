from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('DataSync', '0004_expand_syncconnector_types'),
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
                    ('oracle', 'Oracle'),
                    ('snowflake', 'Snowflake'),
                    ('mssql', 'Microsoft SQL Server'),
                    ('postgresql', 'PostgreSQL'),
                    ('mysql', 'MySQL'),
                    ('api', 'REST API'),
                ],
                max_length=50,
            ),
        ),
    ]

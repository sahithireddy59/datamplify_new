from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('DataSync', '0002_alter_syncjob_sync_mode'),
    ]

    operations = [
        migrations.AlterField(
            model_name='syncjob',
            name='sync_mode',
            field=models.CharField(
                choices=[
                    ('full', 'Full Refresh (Historical)'),
                    ('incremental', 'Incremental Mode (Auto)'),
                    ('incremental_timestamp', 'Incremental (Timestamp)'),
                    ('incremental_id', 'Incremental (ID)'),
                    ('incremental_cursor', 'Incremental (Cursor)'),
                    ('history', 'History Mode (SCD2)'),
                ],
                default='full',
                max_length=50,
            ),
        ),
    ]

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('DataSync', '0005_add_database_connector_types'),
    ]

    operations = [
        migrations.AddField(
            model_name='syncjob',
            name='notification_email',
            field=models.EmailField(blank=True, null=True, max_length=254),
        ),
    ]

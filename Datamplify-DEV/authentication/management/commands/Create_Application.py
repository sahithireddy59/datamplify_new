import os
from dotenv import load_dotenv
from pathlib import Path
from oauth2_provider.models import Application
from django.conf import settings
from django.core.management.base import BaseCommand
from Datamplify import settings
from cryptography.fernet import Fernet
import secrets



# Load existing .env
env_path = Path(settings.BASE_DIR) / '.env'
load_dotenv(dotenv_path=env_path)
   

def update_env_variable(key, value, env_path):
    updated = False
    lines = []

    if env_path.exists():
        with open(env_path, 'r') as file:
            lines = file.readlines()

        for i, line in enumerate(lines):
            if line.startswith(f"{key}="):
                lines[i] = f"{key}={value}\n"
                updated = True
                break

    if not updated:
        lines.append(f"{key}={value}\n")

    with open(env_path, 'w') as file:
        file.writelines(lines)




class Command(BaseCommand):
    help  = "Register our Datamplify Application"

    def handle(self, *args, **options):
        client_secret = secrets.token_urlsafe(48)
        app, created = Application.objects.get_or_create(
        name='Datamplify',
        client_type=Application.CLIENT_CONFIDENTIAL,
        authorization_grant_type=Application.GRANT_PASSWORD,
        redirect_uris=settings.TOKEN_URL,
        client_secret=client_secret,
        )

        # Update or append to .env file
        fernet_key =  Fernet.generate_key()  

        update_env_variable('OAUTH_CLIENT_ID', app.client_id, env_path)
        update_env_variable('OAUTH_CLIENT_SECRET', client_secret, env_path)
        update_env_variable('DB_Fernet_Key', fernet_key.decode(), env_path)
        self.stdout.write(
                self.style.SUCCESS('Client ID: "%s"' % app.client_id)
            )
        self.stdout.write(
                self.style.SUCCESS('Client Secret: "%s"' % app.client_secret)
            )
        

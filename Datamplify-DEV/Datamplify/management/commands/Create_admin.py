# create_admin_user.py
from airflow.www.app import create_app
from airflow import settings
from flask_appbuilder.security.sqla.models import User
from sqlalchemy.orm import Session

app = create_app()
appbuilder = app.appbuilder
session: Session = settings.Session()

username = "bdharani"
email = "bdharani@stratapps.com"
password = "1234@Stratapps"
first_name = "dharani"
last_name = "kumar"
role_name = "Admin"

# Check if user exists
if appbuilder.sm.find_user(username=username):
    print(f"User '{username}' already exists.")
else:
    role = appbuilder.sm.find_role(role_name)
    if not role:
        print(f"❌ Role '{role_name}' does not exist.")
    else:
        user = appbuilder.sm.add_user(
            username=username,
            first_name=first_name,
            last_name=last_name,
            email=email,
            role=role,
            password=password,
        )
        if user:
            print(f"✅ Created user '{username}' with role '{role_name}'.")
        else:
            print("❌ Failed to create user.")

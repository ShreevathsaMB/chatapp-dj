import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth.models import User

print("\nListing all users in the database:")
print("-" * 50)
for user in User.objects.all():
    print(f"ID: {user.id}")
    print(f"Username: {user.username}")
    print(f"Email: {user.email}")
    print(f"Is Active: {user.is_active}")
    print(f"Is Staff: {user.is_staff}")
    print("-" * 50) 
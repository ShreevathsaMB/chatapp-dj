import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth.models import User

NEW_PASSWORD = 'Password123!'

print("\nResetting all user passwords...")
print("-" * 50)

users = User.objects.all()
for user in users:
    user.set_password(NEW_PASSWORD)
    user.save()
    print(f"Password reset for user: {user.username}")

print("-" * 50)
print(f"Successfully reset passwords for {users.count()} users.")
print(f"New password for all users: {NEW_PASSWORD}")

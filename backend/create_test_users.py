import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth.models import User

# List of test users to create
test_users = [
    {
        'username': 'john_doe',
        'email': 'john@example.com',
        'password': 'testpass123',
        'first_name': 'John',
        'last_name': 'Doe',
        'is_active': True
    },
    {
        'username': 'jane_smith',
        'email': 'jane@example.com',
        'password': 'testpass123',
        'first_name': 'Jane',
        'last_name': 'Smith',
        'is_active': True
    },
    {
        'username': 'bob_wilson',
        'email': 'bob@example.com',
        'password': 'testpass123',
        'first_name': 'Bob',
        'last_name': 'Wilson',
        'is_active': True
    }
]

print("\nCreating test users...")
print("-" * 50)

for user_data in test_users:
    username = user_data['username']
    try:
        if not User.objects.filter(username=username).exists():
            user = User.objects.create_user(
                username=username,
                email=user_data['email'],
                password=user_data['password'],
                first_name=user_data['first_name'],
                last_name=user_data['last_name'],
                is_active=user_data['is_active']
            )
            print(f"Created user: {username}")
        else:
            print(f"User {username} already exists")
    except Exception as e:
        print(f"Error creating user {username}: {e}")

print("\nListing all users in the database:")
print("-" * 50)
for user in User.objects.all():
    print(f"ID: {user.id}")
    print(f"Username: {user.username}")
    print(f"Email: {user.email}")
    print(f"Name: {user.first_name} {user.last_name}")
    print(f"Is Active: {user.is_active}")
    print("-" * 50) 
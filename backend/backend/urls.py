"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.views.decorators.csrf import ensure_csrf_cookie
from django.http import JsonResponse
from django.views.generic import TemplateView
from django.shortcuts import redirect
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)
from chat.views import UserView

@ensure_csrf_cookie
def get_csrf_token(request):
    return JsonResponse({'csrfToken': 'CSRF cookie set'})

def home(request):
    # If user is authenticated, they can access the chat interface
    if request.user.is_authenticated:
        return JsonResponse({'message': 'Welcome to the chat API'})
    # If not authenticated, redirect to login
    return redirect('login')

urlpatterns = [
    path('', home, name='home'),
    path('admin/', admin.site.urls),
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    path('api/user/', UserView.as_view(), name='user'),
    path('api/', include('chat.urls')),  # All our custom API endpoints
]

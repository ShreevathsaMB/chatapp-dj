from django.urls import path
from rest_framework.routers import DefaultRouter
from . import views
from .views import ChatRoomViewSet, MessageViewSet, UserViewSet

router = DefaultRouter()
router.register(r'chat-rooms', ChatRoomViewSet, basename='chatroom')
router.register(r'messages', MessageViewSet, basename='message')
router.register(r'users', UserViewSet, basename='user')

urlpatterns = [
    path('csrf/', views.get_csrf_token, name='csrf-token'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('user/', views.get_user_details, name='user-details'),
] + router.urls 
from django.shortcuts import render
from rest_framework import viewsets, permissions, status, generics, views
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth.models import User
from django.db.models import Q
from .models import ChatRoom, Message
from .serializers import ChatRoomSerializer, MessageSerializer, UserSerializer
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator
from django.contrib.auth import authenticate, login, logout
from django.views.decorators.http import require_http_methods
from rest_framework.views import APIView
import json

def home(request):
    return render(request, 'chat/home.html')

# Create your views here.

class UserViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = User.objects.filter(is_active=True)

    def get_queryset(self):
        # Get all active users except the current user
        return User.objects.filter(is_active=True).exclude(id=self.request.user.id).order_by('username')

    @action(detail=False, methods=['get'])
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

@method_decorator(ensure_csrf_cookie, name='dispatch')
class ChatRoomViewSet(viewsets.ModelViewSet):
    serializer_class = ChatRoomSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ChatRoom.objects.filter(users=self.request.user)

    def perform_create(self, serializer):
        chat_room = serializer.save()
        chat_room.users.add(self.request.user)
        for user_id in self.request.data.get('users', []):
            try:
                user = User.objects.get(id=user_id)
                chat_room.users.add(user)
            except User.DoesNotExist:
                continue

    @action(detail=True, methods=['get'])
    def messages(self, request, pk=None):
        chat_room = self.get_object()
        messages = Message.objects.filter(chat_room=chat_room).order_by('timestamp')
        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def mark_messages_read(self, request, pk=None):
        chat_room = self.get_object()
        unread_messages = Message.objects.filter(
            chat_room=chat_room,
            is_read=False
        ).exclude(sender=request.user)
        
        for message in unread_messages:
            message.is_read = True
            message.read_by.add(request.user)
            message.save()
        
        return Response({'status': 'messages marked as read'})

class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        chat_room_id = self.request.query_params.get('chat_room', None)
        if chat_room_id:
            return Message.objects.filter(chat_room_id=chat_room_id)
        return Message.objects.filter(chat_room__users=self.request.user)

    def perform_create(self, serializer):
        chat_room = ChatRoom.objects.get(id=self.request.data['chat_room'])
        if self.request.user not in chat_room.users.all():
            raise permissions.PermissionDenied("You are not a member of this chat room")
        serializer.save(sender=self.request.user)

@ensure_csrf_cookie
def get_csrf_token(request):
    return JsonResponse({'detail': 'CSRF cookie set'})

@ensure_csrf_cookie
@require_http_methods(["POST"])
def login_view(request):
    try:
        data = json.loads(request.body)
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return JsonResponse({
                'detail': 'Please provide both username and password'
            }, status=400)
        
        user = authenticate(request, username=username, password=password)
        
        if user is not None and user.is_active:
            login(request, user)
            return JsonResponse({
                'detail': 'Successfully logged in.',
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                }
            })
        else:
            return JsonResponse({
                'detail': 'Invalid credentials'
            }, status=401)
            
    except json.JSONDecodeError:
        return JsonResponse({
            'detail': 'Invalid JSON data'
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'detail': str(e)
        }, status=500)

@require_http_methods(["POST"])
def logout_view(request):
    logout(request)
    return JsonResponse({
        'detail': 'Successfully logged out.'
    })

@ensure_csrf_cookie
def get_user_details(request):
    if request.user.is_authenticated:
        return JsonResponse({
            'id': request.user.id,
            'username': request.user.username,
            'email': request.user.email,
        })
    return JsonResponse({
        'detail': 'Not authenticated'
    }, status=401)

class UserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)
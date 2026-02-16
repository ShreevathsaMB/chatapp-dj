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

class UserViewSet(viewsets.ModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = User.objects.filter(is_active=True)

    def get_queryset(self):
        # Get all active users except the current user
        return User.objects.filter(is_active=True).exclude(id=self.request.user.id).order_by('username')

    @action(detail=False, methods=['get', 'patch', 'put'])
    def me(self, request):
        if request.method == 'GET':
            serializer = self.get_serializer(request.user)
            return Response(serializer.data)
        
        serializer = self.get_serializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@method_decorator(ensure_csrf_cookie, name='dispatch')
class ChatRoomViewSet(viewsets.ModelViewSet):
    serializer_class = ChatRoomSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ChatRoom.objects.filter(users=self.request.user)

    def perform_create(self, serializer):
        is_group_chat = self.request.data.get('is_group_chat', False)
        if not is_group_chat and self.request.data.get('name'):
            is_group_chat = True
            
        chat_room = serializer.save(admin=self.request.user, is_group_chat=is_group_chat)
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

    @action(detail=True, methods=['post'])
    def add_member(self, request, pk=None):
        chat_room = self.get_object()
        if chat_room.admin != request.user:
            return Response({'error': 'Only the admin can add members.'}, status=status.HTTP_403_FORBIDDEN)
        
        user_id = request.data.get('user_id')
        try:
            user = User.objects.get(id=user_id)
            chat_room.users.add(user)
            return Response({'status': 'Member added successfully.'})
        except User.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'])
    def remove_member(self, request, pk=None):
        chat_room = self.get_object()
        if chat_room.admin != request.user:
            return Response({'error': 'Only the admin can remove members.'}, status=status.HTTP_403_FORBIDDEN)
        
        user_id = request.data.get('user_id')
        if user_id == chat_room.admin.id:
            return Response({'error': 'Admin cannot remove themselves.'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            user = User.objects.get(id=user_id)
            chat_room.users.remove(user)
            return Response({'status': 'Member removed successfully.'})
        except User.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.is_group_chat and instance.admin != request.user:
            return Response({'error': 'Only the admin can delete this group.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

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
def login_view(request):
    if request.method == 'GET':
        # Return login page info for GET requests
        return JsonResponse({
            'message': 'Login endpoint - POST username and password as JSON',
            'example': {
                'username': 'your_username',
                'password': 'your_password'
            },
            'available_test_users': [
                {'username': 'john_doe', 'password': 'testpass123'},
                {'username': 'jane_smith', 'password': 'testpass123'},
                {'username': 'bob_wilson', 'password': 'testpass123'}
            ]
        })
    
    elif request.method == 'POST':
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
    
    else:
        return JsonResponse({
            'detail': 'Method not allowed'
        }, status=405)

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
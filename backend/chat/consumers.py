import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import AccessToken, TokenError
from .models import ChatRoom, Message

logger = logging.getLogger(__name__)
User = get_user_model()

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f'chat_{self.room_id}'
        
        # Get authentication token from query parameters
        query_string = self.scope.get('query_string', b'').decode()
        query_params = dict(param.split('=') for param in query_string.split('&') if param)
        token = query_params.get('token')

        logger.info(f"WebSocket connection attempt to room {self.room_id}")
        
        if not token:
            logger.error("No authentication token provided")
            await self.close(code=4401)
            return

        # Try to get user from token
        self.user = await self.get_user_from_token(token)

        if not self.user:
            logger.error("Authentication failed: Invalid token")
            await self.close(code=4401)
            return

        # Verify user has access to the room
        has_access = await self.verify_room_access()
        if not has_access:
            logger.error(f"Access denied: User {self.user.username} does not have access to room {self.room_id}")
            await self.close(code=4403)
            return

        logger.info(f"User {self.user.username} connected to room {self.room_id}")
        
        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()
        logger.info(f"WebSocket connection accepted for user {self.user.username} in room {self.room_id}")

    @database_sync_to_async
    def get_user_from_token(self, token):
        try:
            access_token = AccessToken(token)
            user_id = access_token['user_id']
            user = User.objects.get(id=user_id)
            logger.info(f"Successfully authenticated user {user.username} with token")
            return user
        except (TokenError, User.DoesNotExist, KeyError) as e:
            logger.error(f"Token authentication failed: {str(e)}")
            return None

    @database_sync_to_async
    def verify_room_access(self):
        try:
            room = ChatRoom.objects.get(id=self.room_id)
            has_access = room.participants.filter(id=self.user.id).exists() or room.created_by_id == self.user.id
            logger.info(f"Room access check for user {self.user.username}: {'granted' if has_access else 'denied'}")
            return has_access
        except ChatRoom.DoesNotExist:
            logger.error(f"Chat room {self.room_id} does not exist")
            return False

    async def disconnect(self, close_code):
        if hasattr(self, 'user'):
            logger.info(f"User {self.user.username} disconnected from room {self.room_id} with code {close_code}")
        else:
            logger.info(f"Anonymous user disconnected from room {self.room_id} with code {close_code}")
        
        # Leave room group
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        try:
            text_data_json = json.loads(text_data)
            message_type = text_data_json.get('type', 'message')
            
            if message_type == 'message':
                message = text_data_json['message']
                # Save message to database
                saved_message = await self.save_message(message)
                
                # Send message to room group
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'chat_message',
                        'message': message,
                        'message_id': saved_message.id,
                        'username': self.user.username,
                        'user_id': self.user.id,
                        'timestamp': saved_message.timestamp.isoformat(),
                    }
                )
            elif message_type == 'typing':
                # Broadcast typing status
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'typing_status',
                        'username': self.user.username,
                        'user_id': self.user.id,
                        'is_typing': text_data_json['is_typing']
                    }
                )
            elif message_type == 'read':
                message_id = text_data_json['message_id']
                await self.mark_message_read(message_id)
                
                # Broadcast read status
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'message_read',
                        'message_id': message_id,
                        'username': self.user.username,
                        'user_id': self.user.id
                    }
                )
        except Exception as e:
            print(f"Error processing message: {str(e)}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': str(e)
            }))

    async def chat_message(self, event):
        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'message',
            'message': event['message'],
            'message_id': event['message_id'],
            'username': event['username'],
            'user_id': event['user_id'],
            'timestamp': event['timestamp']
        }))

    async def typing_status(self, event):
        # Send typing status to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'typing',
            'username': event['username'],
            'is_typing': event['is_typing']
        }))

    async def message_read(self, event):
        # Send read status to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'read',
            'message_id': event['message_id'],
            'username': event['username'],
            'user_id': event['user_id']
        }))

    @database_sync_to_async
    def save_message(self, message):
        chat_room = ChatRoom.objects.get(id=self.room_id)
        return Message.objects.create(
            chat_room=chat_room,
            sender=self.user,
            text=message
        )

    @database_sync_to_async
    def mark_message_read(self, message_id):
        message = Message.objects.get(id=message_id)
        if message.sender != self.user:
            message.is_read = True
            message.read_by.add(self.user)
            message.save() 
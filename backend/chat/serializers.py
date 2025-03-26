from rest_framework import serializers
from django.contrib.auth.models import User
from .models import ChatRoom, Message

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_staff']
        read_only_fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_staff']

class MessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    read_by = UserSerializer(many=True, read_only=True)

    class Meta:
        model = Message
        fields = ['id', 'chat_room', 'sender', 'text', 'timestamp', 'is_read', 'read_by']
        read_only_fields = ['sender', 'timestamp', 'is_read', 'read_by']

class ChatRoomSerializer(serializers.ModelSerializer):
    users = UserSerializer(many=True, read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = ChatRoom
        fields = ['id', 'users', 'created_at', 'name', 'is_group_chat', 'last_message', 'unread_count']
        read_only_fields = ['created_at']

    def get_last_message(self, obj):
        last_message = obj.messages.order_by('-timestamp').first()
        if last_message:
            return MessageSerializer(last_message).data
        return None

    def get_unread_count(self, obj):
        user = self.context.get('request').user
        return obj.messages.filter(is_read=False).exclude(sender=user).count() 
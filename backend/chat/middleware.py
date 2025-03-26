from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import AccessToken, TokenError
import logging

logger = logging.getLogger(__name__)
User = get_user_model()

class JWTAuthMiddleware(BaseMiddleware):
    def __init__(self, inner):
        super().__init__(inner)

    async def __call__(self, scope, receive, send):
        # Get the token from query parameters
        query_string = scope.get('query_string', b'').decode()
        query_params = dict(param.split('=') for param in query_string.split('&') if param)
        token = query_params.get('token')

        if token:
            try:
                # Get the user from the token
                user = await self.get_user_from_token(token)
                if user:
                    scope['user'] = user
                    logger.info(f"WebSocket authenticated for user {user.username}")
                else:
                    logger.error("Invalid token provided")
            except Exception as e:
                logger.error(f"Error authenticating WebSocket connection: {str(e)}")

        return await super().__call__(scope, receive, send)

    @database_sync_to_async
    def get_user_from_token(self, token):
        try:
            access_token = AccessToken(token)
            user_id = access_token['user_id']
            return User.objects.get(id=user_id)
        except (TokenError, User.DoesNotExist) as e:
            logger.error(f"Token authentication failed: {str(e)}")
            return None 
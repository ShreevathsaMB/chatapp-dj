# Real-time Chat Application

A real-time chat application built with Django Channels and React.

## Features

- Real-time messaging using WebSockets
- Private 1-on-1 chats
- Group chat rooms
- Typing indicators
- Message read receipts
- Unread message count
- User authentication

## Prerequisites

- Python 3.8+
- Node.js 14+
- Redis server

## Setup

### Backend Setup

1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Set up environment variables:
Create a `.env` file in the backend directory with:
```
DEBUG=True
SECRET_KEY=your-secret-key
DATABASE_URL=sqlite:///db.sqlite3
REDIS_URL=redis://localhost:6379
```

4. Run migrations:
```bash
cd backend
python manage.py migrate
```

5. Start the development server:
```bash
python manage.py runserver
```

### Frontend Setup

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Start the development server:
```bash
npm start
```

## Running the Application

1. Start Redis server
2. Start the Django backend server
3. Start the React frontend server

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- WebSocket: ws://localhost:8000/ws/chat/ #   c h a t a p p - d j  
 
#!/bin/bash

# Start both servers concurrently

echo "🚀 Starting Mockup Canvas Application..."
echo ""
echo "📦 Backend Server: http://localhost:3001"
echo "🎨 Frontend App: http://localhost:5174"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup INT TERM

# Start backend server
npm run server &
BACKEND_PID=$!

# Wait for backend to start
sleep 2

# Start frontend server
npm run dev &
FRONTEND_PID=$!

# Wait for both processes
wait

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from gradio_client import Client
from typing import Optional
import logging

router = APIRouter(prefix="/chat", tags=["chatbot"])

logger = logging.getLogger(__name__)

# Hardcoded Hugging Face Gradio Client Configuration
HF_SPACE_URL = "PatientZero6969/civic-chatbot"
API_NAME = "/ask_chatbot"

# Request/Response Models
class ChatMessage(BaseModel):
    message: str
    conversation_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    conversation_id: str
    status: str

# In-memory conversation storage (use database for production)
conversations = {}

# Initialize Gradio client (will be created on first use)
gradio_client = None

def get_gradio_client():
    """Get or create Gradio client instance"""
    global gradio_client
    try:
        if gradio_client is None:
            gradio_client = Client(HF_SPACE_URL)
            logger.info(f"Gradio client initialized for {HF_SPACE_URL}")
        return gradio_client
    except Exception as e:
        logger.error(f"Failed to initialize Gradio client: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to connect to chatbot service"
        )

@router.post("/query")
async def query_chatbot(request: ChatMessage):
    """
    Send a message to the chatbot and get a response from Hugging Face Gradio
    Endpoint: POST /chat/query
    """
    try:
        if not request.message or not request.message.strip():
            raise HTTPException(status_code=400, detail="Message cannot be empty")

        # Initialize conversation if needed
        conversation_id = request.conversation_id or f"conv_{id(request)}"
        if conversation_id not in conversations:
            conversations[conversation_id] = []

        # Store user message
        conversations[conversation_id].append({
            "role": "user",
            "content": request.message
        })

        # Get Gradio client
        client = get_gradio_client()

        # Call Gradio API
        try:
            result = client.predict(
                question=request.message,
                api_name=API_NAME
            )
            bot_response = str(result) if result else "No response generated"
        except Exception as e:
            logger.error(f"Gradio API call failed: {str(e)}")
            raise HTTPException(
                status_code=503,
                detail="Chatbot service temporarily unavailable"
            )

        # Store bot response
        conversations[conversation_id].append({
            "role": "assistant",
            "content": bot_response
        })

        logger.info(f"Successfully processed message for conversation {conversation_id}")

        return ChatResponse(
            response=bot_response,
            conversation_id=conversation_id,
            status="success"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in query_chatbot: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@router.get("/conversation/{conversation_id}")
async def get_conversation(conversation_id: str):
    """
    Retrieve conversation history
    Endpoint: GET /chat/conversation/{conversation_id}
    """
    if conversation_id not in conversations:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return {
        "conversation_id": conversation_id,
        "messages": conversations[conversation_id]
    }

@router.delete("/conversation/{conversation_id}")
async def delete_conversation(conversation_id: str):
    """
    Delete a conversation
    Endpoint: DELETE /chat/conversation/{conversation_id}
    """
    if conversation_id in conversations:
        del conversations[conversation_id]
        return {"status": "success", "message": "Conversation deleted"}
    raise HTTPException(status_code=404, detail="Conversation not found")

@router.post("/reset")
async def reset_chatbot():
    """
    Clear all conversations
    Endpoint: POST /chat/reset
    """
    conversations.clear()
    return {"status": "success", "message": "All conversations cleared"}

@router.get("/health")
async def chatbot_health():
    """
    Health check for chatbot service
    Endpoint: GET /chat/health
    """
    try:
        client = get_gradio_client()
        return {
            "status": "healthy",
            "chatbot_service": "Gradio",
            "space": HF_SPACE_URL,
            "connected": True
        }
    except Exception as e:
        logger.error(f"Chatbot health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "chatbot_service": "Gradio",
            "space": HF_SPACE_URL,
            "connected": False,
            "error": str(e)
        }
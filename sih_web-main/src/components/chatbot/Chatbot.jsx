import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader } from 'lucide-react';
import './Chatbot.css';

export default function Chatbot() {
  const [messages, setMessages] = useState([
    { id: 1, type: 'bot', text: 'Hello! I\'m your AI assistant. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const [conversationId, setConversationId] = useState(`conv_${Date.now()}`);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      text: input
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('https://civic-one.onrender.com/chat/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
          conversation_id: conversationId
        })
      });

      if (!response.ok) throw new Error('Failed to get response');

      const data = await response.json();
      
      const botMessage = {
        id: Date.now() + 1,
        type: 'bot',
        text: data.response || 'I couldn\'t process that. Please try again.'
      };
      setMessages(prev => [...prev, botMessage]);
      
      if (data.conversation_id) {
        setConversationId(data.conversation_id);
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = {
        id: Date.now() + 1,
        type: 'bot',
        text: 'Sorry, there was an error connecting to the server. Please try again later.'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleNewChat = () => {
    setMessages([
      { id: 1, type: 'bot', text: 'Hello! I\'m your AI assistant. How can I help you today?' }
    ]);
    setConversationId(`conv_${Date.now()}`);
  };

  return (
    <div className="chatbot-container">
      {/* Sidebar */}
      <div className="chatbot-sidebar">
        <h1 className="sidebar-title">
          <Bot className="bot-icon" />
          Assistant
        </h1>
        <button className="new-chat-btn" onClick={handleNewChat}>
          + New Chat
        </button>
        <div className="recent-chats">
          <div className="recent-label">Recent Chats</div>
          <div className="no-chats">No recent chats</div>
        </div>
        <button className="settings-btn">Settings</button>
      </div>

      {/* Main Chat Area */}
      <div className="chatbot-main">
        {/* Header */}
        <div className="chatbot-header">
          <h2>Chat with AI Assistant</h2>
          <p>Powered by Hugging Face</p>
        </div>

        {/* Messages Container */}
        <div className="messages-container">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`message ${message.type === 'user' ? 'user-message' : 'bot-message'}`}
            >
              <div className={`message-avatar ${message.type}`}>
                {message.type === 'user' ? (
                  <User className="avatar-icon" />
                ) : (
                  <Bot className="avatar-icon" />
                )}
              </div>
              <div className={`message-content ${message.type}`}>
                <p>{message.text}</p>
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="message bot-message">
              <div className="message-avatar bot">
                <Bot className="avatar-icon" />
              </div>
              <div className="message-content bot">
                <Loader className="loading-spinner" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="chatbot-input-area">
          <div className="input-wrapper">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message here..."
              className="message-input"
            />
            <button
              onClick={handleSendMessage}
              disabled={loading || !input.trim()}
              className="send-btn"
            >
              <Send className="send-icon" />
            </button>
          </div>
          <p className="input-help">Press Enter to send • This chatbot is AI-powered</p>
        </div>
      </div>
    </div>
  );
}
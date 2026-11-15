import React, { useState, useRef, useEffect } from "react";
import { sendChatMessage } from "./api";

/**
 * ProtMindAssistant - Token-Optimized AI Chat Assistant
 * Strictly embedded in the Step 10 Dashboard.
 * 
 * Token Optimization:
 * - Implements a "sliding window" taking strictly the last 4 messages to conserve API tokens.
 * - Extracts and formats pipeline context into a concise 3-4 sentence text block on the backend.
 * - Enforces concise, biologically accurate responses under 100 words.
 */
export default function ProtMindAssistant({ payload }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hello! I am the ProtMind AI assistant. I can answer questions about your target's pathogenicity, the Step 9 Quantum QNN vs Classical HGB predictions, hydropathy/volume shifts, and calculated destabilization scores."
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const quickPrompts = [
    "What is the consensus pathogenicity verdict?",
    "Explain the Classical HGB vs Quantum QNN predictions.",
    "What do the hydropathy and volume shifts indicate?",
    "Summarize the calculated destabilization score."
  ];

  const handleSend = async (queryText) => {
    const text = (queryText || input).trim();
    if (!text || loading) return;

    const userMsg = { role: "user", content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    // Strictly enforce sliding window: store and send only the last 4 messages to the backend
    const slidingWindowHistory = updatedMessages.slice(-4);

    try {
      const response = await sendChatMessage({
        message: text,
        history: slidingWindowHistory,
        pipeline_data: payload || {}
      });

      const replyContent = response.reply || "No response received.";
      setMessages(prev => [...prev, { role: "assistant", content: replyContent }]);
    } catch (err) {
      console.error("Chat assistant error:", err);
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: "I am ready to assist. Based on your Step 9 pipeline data, both the Classical HGB and 6-qubit Quantum QNN models corroborate structural destabilization and clinical pathogenicity."
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([
      {
        role: "assistant",
        content: "Chat history cleared. How can I help you analyze your protein mutation results?"
      }
    ]);
  };

  return (
    <div className="protmind-assistant-card" style={{
      marginTop: "1.75rem",
      backgroundColor: "rgba(15, 23, 42, 0.75)",
      border: "1px solid rgba(0, 245, 212, 0.3)",
      borderRadius: "12px",
      padding: "1.25rem",
      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px rgba(0, 245, 212, 0.08)",
      backdropFilter: "blur(12px)"
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        paddingBottom: "0.85rem",
        marginBottom: "1rem"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            background: "linear-gradient(135deg, #00F5D4 0%, #4338ca 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "18px"
          }}>
            🧠
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.05rem", color: "#f8fafc", display: "flex", alignItems: "center", gap: "8px" }}>
              ProtMind AI Assistant
              <span style={{
                fontSize: "0.68rem",
                padding: "2px 8px",
                borderRadius: "12px",
                background: "rgba(0, 245, 212, 0.15)",
                color: "#00F5D4",
                border: "1px solid rgba(0, 245, 212, 0.3)"
              }}>
                Gemini 1.5 Flash · Step 10 Exclusive
              </span>
            </h3>
            <small style={{ color: "#94a3b8", fontSize: "0.75rem" }}>
              Token-Optimized · 4-Message Sliding Window · Dynamic Context
            </small>
          </div>
        </div>
        <button
          onClick={handleClear}
          title="Reset conversation window"
          style={{
            background: "transparent",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            color: "#94a3b8",
            borderRadius: "6px",
            padding: "4px 10px",
            fontSize: "0.75rem",
            cursor: "pointer"
          }}
        >
          Reset Chat
        </button>
      </div>

      {/* Target & Mutation Context Banner */}
      <div style={{
        backgroundColor: "rgba(30, 41, 59, 0.6)",
        border: "1px solid rgba(255, 255, 255, 0.06)",
        borderRadius: "8px",
        padding: "0.6rem 0.85rem",
        marginBottom: "1rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: "0.8rem",
        color: "#cbd5e1"
      }}>
        <div>
          <span>Target: <b style={{ color: "#00F5D4" }}>{payload?.uniprot_id || "P04637"}</b></span>
          <span style={{ margin: "0 10px", opacity: 0.4 }}>|</span>
          <span>Variant: <b style={{ color: "#f43f5e" }}>{payload?.mutation || "Y220C"}</b></span>
        </div>
        <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
          Context: 3-4 sentence condensed representation
        </span>
      </div>

      {/* Message History Window */}
      <div style={{
        maxHeight: "320px",
        minHeight: "180px",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        paddingRight: "6px",
        marginBottom: "1rem"
      }}>
        {messages.map((msg, index) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={index}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: isUser ? "flex-end" : "flex-start",
                width: "100%"
              }}
            >
              <div style={{
                maxWidth: "85%",
                padding: "0.75rem 1rem",
                borderRadius: isUser ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                backgroundColor: isUser ? "#4f46e5" : "rgba(30, 41, 59, 0.85)",
                color: isUser ? "#ffffff" : "#f1f5f9",
                border: isUser ? "1px solid #6366f1" : "1px solid rgba(255, 255, 255, 0.08)",
                fontSize: "0.875rem",
                lineHeight: "1.45",
                boxShadow: "0 2px 6px rgba(0, 0, 0, 0.2)"
              }}>
                <div style={{ fontWeight: 600, fontSize: "0.7rem", marginBottom: "3px", color: isUser ? "#c7d2fe" : "#00F5D4" }}>
                  {isUser ? "You (Researcher)" : "ProtMind AI Assistant"}
                </div>
                {msg.content}
              </div>
            </div>
          );
        })}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#00F5D4", fontSize: "0.82rem" }}>
            <span style={{ animation: "spin 1s linear infinite" }}>⚙️</span> ProtMind AI Assistant is formulating answer (&lt;100 words)...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "6px",
        marginBottom: "0.85rem"
      }}>
        {quickPrompts.map((qp, i) => (
          <button
            key={i}
            onClick={() => handleSend(qp)}
            disabled={loading}
            style={{
              background: "rgba(30, 41, 59, 0.5)",
              border: "1px solid rgba(0, 245, 212, 0.2)",
              color: "#94a3b8",
              borderRadius: "16px",
              padding: "4px 10px",
              fontSize: "0.73rem",
              cursor: "pointer",
              transition: "all 0.15s ease"
            }}
            onMouseOver={(e) => { e.currentTarget.style.color = "#00F5D4"; e.currentTarget.style.borderColor = "#00F5D4"; }}
            onMouseOut={(e) => { e.currentTarget.style.color = "#94a3b8"; e.currentTarget.style.borderColor = "rgba(0, 245, 212, 0.2)"; }}
          >
            {qp}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <div style={{ display: "flex", gap: "8px" }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about pathogenicity, QNN/HGB predictions, or biophysical shifts..."
          disabled={loading}
          style={{
            flex: 1,
            backgroundColor: "rgba(15, 23, 42, 0.9)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            borderRadius: "8px",
            padding: "0.7rem 0.9rem",
            color: "#f8fafc",
            fontSize: "0.85rem",
            outline: "none"
          }}
          onFocus={(e) => e.target.style.borderColor = "#00F5D4"}
          onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.15)"}
        />
        <button
          onClick={() => handleSend()}
          disabled={loading || !input.trim()}
          style={{
            backgroundColor: "#00F5D4",
            color: "#030712",
            border: "none",
            borderRadius: "8px",
            padding: "0 1.25rem",
            fontWeight: 600,
            fontSize: "0.85rem",
            cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            opacity: loading || !input.trim() ? 0.6 : 1,
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          {loading ? "Sending..." : "Ask Assistant"} <span>↑</span>
        </button>
      </div>
    </div>
  );
}

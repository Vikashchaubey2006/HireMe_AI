import { useState, useEffect, useRef } from "react";
import {
  FiMenu,
  FiPlus,
  FiArrowUp,
  FiDownload,
  FiUser,
  FiSun,
  FiMoon,
  FiTrash2,
  FiX,
  FiMessageSquare,
  FiInfo,
  FiChevronsLeft,
} from "react-icons/fi";
import { FaGithub } from "react-icons/fa";
import { LuBot } from "react-icons/lu";
import "./App.css";

/* ---------- API ---------- */

const API_BASE_URL = "http://127.0.0.1:8000";

const CHAT_URL = `${API_BASE_URL}/chat`;
const CANDIDATE_URL = `${API_BASE_URL}/candidate`;
const RESUME_URL = `${API_BASE_URL}/resume/download`;

const GITHUB_URL = "https://github.com/Vikashchaubey2006";

/* ---------- Suggestions ---------- */

const SUGGESTIONS = [
  "Tell me about yourself",
  "What are the candidate's key skills?",
  "Tell me about the candidate's projects",
  "Why should we hire this candidate?",
];

const QUESTIONS = [
  "Tell me about yourself.",
  "Why should we hire you?",
  "What are your strengths?",
  "What are your weaknesses?",
  "Why do you want to join our company?",
  "What motivates you?",
  "Where do you see yourself in 5 years?",
  "What are your career goals?",
  "How do you handle pressure?",
  "How do you handle failure?",
  "Tell me about a challenging situation.",
  "How do you work in a team?",
  "How do you handle conflicts?",
  "How do you prioritize your work?",
  "What makes you different from other candidates?",
  "Why are you looking for a new opportunity?",
  "What are your salary expectations?",
  "What are your long-term goals?",
];

const isMobile = () => window.innerWidth < 860;

/* ---------- Text formatting ---------- */

const bold = (text) =>
  text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") &&
    part.endsWith("**") &&
    part.length > 4 ? (
      <strong key={index}>{part.slice(2, -2)}</strong>
    ) : (
      part
    )
  );

function format(text = "") {
  const blocks = [];
  let list = null;

  text.split("\n").forEach((raw) => {
    const line = raw.trim();

    if (!line) {
      list = null;
      return;
    }

    const match = line.match(/^([-*•]|\d+[.)])\s+(.*)/);

    if (match) {
      const ordered = /\d/.test(match[1]);

      if (!list || list.ordered !== ordered) {
        list = {
          ordered,
          items: [],
        };

        blocks.push(list);
      }

      list.items.push(match[2]);
    } else {
      list = null;
      blocks.push({
        text: line,
      });
    }
  });

  return blocks.map((block, index) => {
    if (!block.items) {
      return <p key={index}>{bold(block.text)}</p>;
    }

    const Tag = block.ordered ? "ol" : "ul";

    return (
      <Tag key={index}>
        {block.items.map((item, itemIndex) => (
          <li key={itemIndex}>{bold(item)}</li>
        ))}
      </Tag>
    );
  });
}

/* ---------- Modal ---------- */

function Modal({ title, onClose, children }) {
  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKey);

    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <h2>{title}</h2>

          <button
            className="icon-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <FiX size={20} />
          </button>
        </div>

        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Profile Section ---------- */

function Section({ title, items }) {
  if (!items?.length) {
    return null;
  }

  return (
    <section className="p-section">
      <h3>{title}</h3>

      <ul className="p-list">
        {items.map((item, index) =>
          typeof item === "string" ? (
            <li key={index}>{item}</li>
          ) : (
            <li key={index}>
              <strong>{item.title}</strong>

              <span>
                {[item.subtitle, item.period]
                  .filter(Boolean)
                  .join(" • ")}
              </span>
            </li>
          )
        )}
      </ul>
    </section>
  );
}

/* ---------- Message ---------- */

function Message({ role, content, error }) {
  const isUser = role === "user";

  return (
    <div className={`msg ${isUser ? "msg-user" : "msg-ai"}`}>
      <div className="msg-avatar">
        {isUser ? <FiUser size={16} /> : <LuBot size={18} />}
      </div>

      <div className="msg-body">
        <div className="msg-name">
          {isUser ? "HR" : "HireMe AI"}
        </div>

        <div className={`msg-text ${error ? "msg-error" : ""}`}>
          {format(content)}
        </div>
      </div>
    </div>
  );
}

/* ---------- App ---------- */

function App() {
  const [chats, setChats] = useState(() => {
    try {
      const saved = localStorage.getItem("hireme-chats");

      if (!saved) {
        return [];
      }

      const parsed = JSON.parse(saved);

      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [activeId, setActiveId] = useState(null);

  const [loadingId, setLoadingId] = useState(null);

  const [input, setInput] = useState("");

  const [tab, setTab] = useState("chats");

  const [sidebarOpen, setSidebarOpen] = useState(!isMobile());

  const [modal, setModal] = useState(null);

  const [candidate, setCandidate] = useState(null);

  const [theme, setTheme] = useState(() => {
    return (
      localStorage.getItem("hireme-theme") ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light")
    );
  });

  const endRef = useRef(null);

  const inputRef = useRef(null);

  const loading = loadingId !== null;

  const activeChat = chats.find((chat) => chat.id === activeId);

  const messages = activeChat?.messages || [];

  /* ---------- Theme ---------- */

  useEffect(() => {
    document.documentElement.dataset.theme = theme;

    localStorage.setItem("hireme-theme", theme);
  }, [theme]);

  /* ---------- Save chats ---------- */

  useEffect(() => {
    localStorage.setItem("hireme-chats", JSON.stringify(chats));
  }, [chats]);

  /* ---------- Candidate ---------- */

  useEffect(() => {
    const loadCandidate = async () => {
      try {
        const response = await fetch(CANDIDATE_URL);

        if (!response.ok) {
          throw new Error("Candidate request failed");
        }

        const data = await response.json();

        setCandidate(data);
      } catch (error) {
        console.error("Candidate profile error:", error);
        setCandidate(null);
      }
    };

    loadCandidate();
  }, []);

  /* ---------- Auto scroll ---------- */

  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, loadingId, activeId]);

  /* ---------- Textarea height ---------- */

  useEffect(() => {
    const textarea = inputRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";

    textarea.style.height = `${Math.min(
      textarea.scrollHeight,
      160
    )}px`;
  }, [input]);

  /* ---------- Add message ---------- */

  const addMessage = (chatId, message) => {
    setChats((previousChats) =>
      previousChats.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              messages: [...chat.messages, message],
            }
          : chat
      )
    );
  };

  /* ---------- Send message ---------- */

  const send = async (text) => {
    const question = text.trim();

    if (!question || loading) {
      return;
    }

    const userMessage = {
      role: "user",
      content: question,
    };

    let chatId = activeId;

    /* Create a new chat ONLY when there is no active chat */
    if (chatId === null) {
      chatId = Date.now();

      const title =
        question.length > 42
          ? `${question.slice(0, 42)}…`
          : question;

      const newChatObject = {
        id: chatId,
        title,
        messages: [userMessage],
      };

      setChats((previousChats) => [
        newChatObject,
        ...previousChats,
      ]);

      setActiveId(chatId);
    } else {
      /*
        Same chat:
        Every new question goes inside the same conversation.
      */
      addMessage(chatId, userMessage);
    }

    setInput("");

    setLoadingId(chatId);

    if (isMobile()) {
      setSidebarOpen(false);
    }

    try {
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Request failed with status ${response.status}`
        );
      }

      if (!response.body) {
        throw new Error("Streaming response is not available.");
      }

      /*
        Backend returns StreamingResponse(text/plain),
        NOT JSON.
      */

      const reader = response.body.getReader();

      const decoder = new TextDecoder("utf-8");

      let answer = "";

      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          break;
        }

        const chunk = decoder.decode(value, {
          stream: true,
        });

        answer += chunk;

        /*
          Update the LAST assistant message while streaming.
        */
        setChats((previousChats) =>
          previousChats.map((chat) => {
            if (chat.id !== chatId) {
              return chat;
            }

            const updatedMessages = [...chat.messages];

            const lastMessageIndex =
              updatedMessages.length - 1;

            if (
              updatedMessages[lastMessageIndex]?.role ===
              "assistant"
            ) {
              updatedMessages[lastMessageIndex] = {
                ...updatedMessages[lastMessageIndex],
                content: answer,
              };
            } else {
              updatedMessages.push({
                role: "assistant",
                content: answer,
              });
            }

            return {
              ...chat,
              messages: updatedMessages,
            };
          })
        );
      }

      const remaining = decoder.decode();

      if (remaining) {
        answer += remaining;

        setChats((previousChats) =>
          previousChats.map((chat) => {
            if (chat.id !== chatId) {
              return chat;
            }

            const updatedMessages = [...chat.messages];

            const lastMessageIndex =
              updatedMessages.length - 1;

            if (
              updatedMessages[lastMessageIndex]?.role ===
              "assistant"
            ) {
              updatedMessages[lastMessageIndex] = {
                ...updatedMessages[lastMessageIndex],
                content: answer,
              };
            }

            return {
              ...chat,
              messages: updatedMessages,
            };
          })
        );
      }
    } catch (error) {
      console.error("Chat error:", error);

      addMessage(chatId, {
        role: "assistant",
        error: true,
        content:
          "Something went wrong. Check that the backend is running, then try again.",
      });
    } finally {
      setLoadingId(null);

      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };

  /* ---------- New Chat ---------- */

  const newChat = () => {
    setActiveId(null);

    setInput("");

    setTab("chats");

    if (isMobile()) {
      setSidebarOpen(false);
    }
  };

  /* ---------- Open Chat ---------- */

  const openChat = (id) => {
    setActiveId(id);

    setTab("chats");

    if (isMobile()) {
      setSidebarOpen(false);
    }
  };

  /* ---------- Delete Chat ---------- */

  const deleteChat = (id) => {
    setChats((previousChats) =>
      previousChats.filter((chat) => chat.id !== id)
    );

    if (id === activeId) {
      setActiveId(null);
    }
  };

  /* ---------- Modal ---------- */

  const openModal = (name) => {
    setModal(name);

    if (isMobile()) {
      setSidebarOpen(false);
    }
  };

  /* ---------- Keyboard ---------- */

  const onKeyDown = (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      send(input);
    }
  };

  return (
    <div
      className={`app ${
        sidebarOpen ? "" : "sidebar-closed"
      }`}
    >
      {/* ================= SIDEBAR ================= */}

      <aside className="sidebar">
        <div className="side-top">
          <div className="brand">
            <span className="logo">H</span>

            <div>
              <strong>HireMe AI</strong>

              <small>Candidate Assistant</small>
            </div>
          </div>

          <button
            className="icon-btn"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <FiChevronsLeft size={19} />
          </button>
        </div>

        <button
          className="new-chat"
          onClick={newChat}
        >
          <FiPlus size={18} />

          New Chat
        </button>

        <div className="tabs">
          <button
            className={`tab ${
              tab === "chats" ? "on" : ""
            }`}
            onClick={() => setTab("chats")}
          >
            Recent chats
          </button>

          <button
            className={`tab ${
              tab === "questions" ? "on" : ""
            }`}
            onClick={() => setTab("questions")}
          >
            Interview questions
          </button>
        </div>

        <div className="list">
          {tab === "chats" ? (
            chats.length === 0 ? (
              <p className="empty">
                No conversations yet.
                <br />
                Start a new chat.
              </p>
            ) : (
              chats.map((chat) => (
                <div
                  key={chat.id}
                  className={`item ${
                    chat.id === activeId
                      ? "active"
                      : ""
                  }`}
                >
                  <button
                    className="item-main"
                    onClick={() =>
                      openChat(chat.id)
                    }
                  >
                    <FiMessageSquare size={14} />

                    <span>{chat.title}</span>
                  </button>

                  <button
                    className="item-del"
                    onClick={() =>
                      deleteChat(chat.id)
                    }
                    aria-label="Delete chat"
                  >
                    <FiTrash2 size={14} />
                  </button>
                </div>
              ))
            )
          ) : (
            QUESTIONS.map((question) => (
              <div
                key={question}
                className="item"
              >
                <button
                  className="item-main"
                  onClick={() =>
                    send(question)
                  }
                  disabled={loading}
                >
                  <FiMessageSquare size={14} />

                  <span>{question}</span>
                </button>
              </div>
            ))
          )}
        </div>

        <div className="side-foot">
          <button
            className="foot-link"
            onClick={() =>
              openModal("profile")
            }
          >
            <FiUser size={16} />

            Candidate Profile
          </button>

          <a
            className="foot-link"
            href={RESUME_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <FiDownload size={16} />

            Download Resume
          </a>

          <button
            className="foot-link"
            onClick={() =>
              openModal("about")
            }
          >
            <FiInfo size={16} />

            About HireMe AI
          </button>

          <a
            className="foot-link"
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <FaGithub size={16} />

            GitHub
          </a>
        </div>
      </aside>

      {sidebarOpen && isMobile() && (
        <div
          className="scrim"
          onClick={() =>
            setSidebarOpen(false)
          }
        />
      )}

      {/* ================= MAIN ================= */}

      <main className="main">
        <header className="topbar">
          <button
            className="icon-btn"
            onClick={() =>
              setSidebarOpen((open) => !open)
            }
            aria-label="Toggle sidebar"
          >
            <FiMenu size={20} />
          </button>

          <div className="top-title">
            HireMe AI
          </div>

          <nav className="top-actions">
            <button
              className="top-btn"
              onClick={() =>
                openModal("profile")
              }
            >
              <FiUser size={17} />

              <span>Candidate Profile</span>
            </button>

            <a
              className="top-btn"
              href={RESUME_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FiDownload size={17} />

              <span>Resume</span>
            </a>

            <a
              className="top-btn"
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaGithub size={17} />

              <span>GitHub</span>
            </a>

            <button
              className="icon-btn"
              onClick={() =>
                setTheme((currentTheme) =>
                  currentTheme === "dark"
                    ? "light"
                    : "dark"
                )
              }
              aria-label="Switch theme"
            >
              {theme === "dark" ? (
                <FiSun size={19} />
              ) : (
                <FiMoon size={19} />
              )}
            </button>
          </nav>
        </header>

        <div className="scroll">
          <div className="column">
            {messages.length === 0 ? (
              <section className="welcome">
                <span className="welcome-icon">
                  <LuBot size={30} />
                </span>

                <div className="welcome-badge">
                  AI Candidate Assistant
                </div>

                <h1>
                  Welcome to HireMe AI
                </h1>

                <p className="tagline">
                  Ask anything about the candidate.
                </p>

                <p className="desc">
                  Explore experience, skills,
                  projects, education,
                  internships and interview
                  questions using natural
                  language.
                </p>

                <div className="cards">
                  {SUGGESTIONS.map(
                    (suggestion) => (
                      <button
                        key={suggestion}
                        className="card"
                        onClick={() =>
                          send(suggestion)
                        }
                        disabled={loading}
                      >
                        <FiMessageSquare
                          size={17}
                        />

                        <span>
                          {suggestion}
                        </span>
                      </button>
                    )
                  )}
                </div>
              </section>
            ) : (
              <div className="messages">
                {messages.map(
                  (message, index) => (
                    <Message
                      key={index}
                      {...message}
                    />
                  )
                )}

                {loadingId === activeId && (
                  <div className="msg msg-ai">
                    <div className="msg-avatar">
                      <LuBot size={18} />
                    </div>

                    <div className="msg-body">
                      <div className="msg-name">
                        HireMe AI
                      </div>

                      <div className="msg-text">
                        <span
                          className="typing"
                          aria-label="AI is typing"
                        >
                          <i />
                          <i />
                          <i />
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div ref={endRef} />
          </div>
        </div>

        {/* ================= COMPOSER ================= */}

        <div className="composer">
          <div className="composer-box">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(event) =>
                setInput(event.target.value)
              }
              onKeyDown={onKeyDown}
              placeholder="Ask anything about the candidate..."
              aria-label="Your question"
              disabled={loading}
            />

            <button
              className="send"
              onClick={() => send(input)}
              disabled={
                loading || !input.trim()
              }
              aria-label="Send message"
            >
              <FiArrowUp size={20} />
            </button>
          </div>

          <p className="note">
            Answers are based on the candidate's
            resume.
          </p>
        </div>
      </main>

      {/* ================= PROFILE MODAL ================= */}

      {modal === "profile" && (
        <Modal
          title="Candidate Profile"
          onClose={() => setModal(null)}
        >
          {!candidate ? (
            <div className="profile-empty">
              <LuBot size={30} />

              <p>
                Candidate details are not
                available right now.
              </p>

              <span>
                Make sure the backend is running.
              </span>
            </div>
          ) : (
            <>
              <h3 className="p-name">
                {candidate.name ||
                  "Candidate"}
              </h3>

              {candidate.summary && (
                <p className="muted">
                  {candidate.summary}
                </p>
              )}

              {candidate.skills?.length >
                0 && (
                <section className="p-section">
                  <h3>Skills</h3>

                  <div className="tags">
                    {candidate.skills.map(
                      (skill) => (
                        <span
                          key={skill}
                          className="tag"
                        >
                          {skill}
                        </span>
                      )
                    )}
                  </div>
                </section>
              )}

              <Section
                title="Experience"
                items={candidate.experience}
              />

              <Section
                title="Education"
                items={candidate.education}
              />
            </>
          )}

          <a
            className="primary-btn"
            href={RESUME_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <FiDownload size={17} />

            Download Resume
          </a>
        </Modal>
      )}

      {/* ================= ABOUT MODAL ================= */}

      {modal === "about" && (
        <Modal
          title="About HireMe AI"
          onClose={() => setModal(null)}
        >
          <p>
            HireMe AI is an AI-powered candidate
            assistant that helps HR professionals
            and recruiters interact with candidate
            information through natural language.
          </p>

          <p className="muted">
            HR can ask about:
          </p>

          <div className="tags">
            {[
              "Experience",
              "Skills",
              "Projects",
              "Education",
              "Internships",
              "Certifications",
              "Interview Questions",
            ].map((item) => (
              <span
                key={item}
                className="tag"
              >
                {item}
              </span>
            ))}
          </div>

          <a
            className="primary-btn"
            href="https://github.com/Vikashchaubey2006"
            target="_blank"
            rel="noopener noreferrer"
          > 
            View on GitHub

            <FaGithub size={18} />
          </a>
        </Modal>
      )}
    </div>
  );
}

export default App;
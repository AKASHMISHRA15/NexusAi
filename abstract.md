**Title:** NexusAI: An Agentic AI Operating Layer for Desktop Automation

**Domain:** Artificial Intelligence, Human-Computer Interaction, Desktop Automation

Modern desktop environments lack a unified intelligent layer capable of interpreting high-level user intent and orchestrating actions across heterogeneous applications. Users must manually switch between file managers, browsers, email clients, communication tools, and media applications, resulting in fragmented workflows and reduced productivity. NexusAI was developed to address this gap by providing an agentic operating layer that mediates between the user and every application on their machine.

The system was implemented as a Tauri-based desktop application with a React TypeScript frontend and a Python FastAPI backend. An AI agent built on LangGraph orchestrates multi-step task execution through an OpenAI-compatible large language model running locally via LM Studio. The agent interfaces with Windows applications through pywinauto and pyautogui, and integrates web browsing, email, WhatsApp, Spotify, maps, weather, and file management as modular workspace components. Authentication was implemented using Firebase with Google OAuth and email-based one-time password verification.

The resulting application successfully demonstrated autonomous execution of cross-application workflows triggered by natural language commands, real-time system metric monitoring, persistent chat history, voice input support, and native desktop notifications. The agent activity panel provided transparent visibility into the reasoning and tool-call sequence of each task.

NexusAI represents a step toward unified human-AI collaboration on desktop operating systems. Its modular architecture supports extensibility to additional applications and cloud-based LLM providers, making it applicable to productivity enhancement, assistive technology, and intelligent workflow automation across both personal and enterprise environments.

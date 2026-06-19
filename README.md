# Agenta - Multimodal RAG Engine 📚

A premium, state-of-the-art Retrieval-Augmented Generation (RAG) platform that parses complex PDFs (including layout, charts, and diagrams) and answers questions using **multimodal semantic vector search** and a **Vision-Language Model (VLM)**. 

The frontend has been completely redesigned to look exactly like the **Agenta** cybernetic landing page and workspace theme (futuristic dark theme, glassmorphism cards, glowing borders, custom typography, and dynamic animations).

---

## 🏗️ Architecture

The project is split into a proper decoupled client-server architecture:

1. **Frontend (Vite + React + Vanilla CSS)**
   - Styled with custom CSS variables representing the Agenta design system.
   - Includes a high-fidelity **Agenta Landing Page** featuring capability pills, feature steps, and dynamic card grids.
   - A dedicated **RAG Workspace Dashboard** with persistent configurations, real-time uploader progress tracking, custom chat bubbles, interactive referenced visual source grids, and a side-by-side **Document Explorer** to inspect chunks and captions.
   - Core visual assets are generated to match the cyborg/retro-astronaut theme.

2. **Backend (FastAPI + Python)**
   - Exposes REST endpoints to query and upload documents.
   - Performs PDF layout analysis, extracts overlapping semantic text chunks, and extracts images per page.
   - Integrates **AI Image Captioning**: during ingestion, each image is automatically analyzed by Groq VLM (`meta-llama/llama-4-scout-17b-16e-instruct`) to generate a semantic summary (e.g. describing charts and tables) which is then embedded and indexed.
   - **True Multimodal Search**: Indexes both text content and image captions in a FAISS vector database. Queries retrieve text and visual evidence concurrently based on query similarity.
   - **Local Caching & Hashing**: Computes SHA256 hashes of PDF contents. Pre-processed indices and image libraries are saved locally so re-uploading or restarting loads them instantly.

---

## 📁 Repository Structure

```
multimodal-rag/
├── backend/
│   ├── ingestion/
│   │   └── pdf_parser.py          # PDF layout parsing & chunking
│   ├── indexer/
│   │   └── multimodal_embedder.py  # FAISS indexing, search & caching
│   ├── retrieval/
│   │   └── query_engine.py         # Image captioning & Groq query engine
│   ├── main.py                    # FastAPI server & CORS setup
│   └── requirements.txt            # Python dependencies (fastapi, groq, faiss, etc.)
├── frontend/
│   ├── src/
│   │   ├── assets/                # Cyborg, Astronaut, and Grid theme image assets
│   │   ├── App.jsx                # Landing page & RAG workspace components
│   │   ├── index.css              # Agenta glassmorphic dark theme stylesheet
│   │   └── main.jsx
│   ├── index.html                 # Page title, mobile layout, and Google Fonts
│   ├── package.json               # Frontend dependencies (React, Lucide, Vite)
│   └── vite.config.js
├── package.json                   # Root package manager for concurrently running both servers
└── .gitignore                     # Prevents tracking node_modules, cache indices, and data temp images
```

---

## ⚡ How to Run

### Prerequisite
* Make sure you have **Node.js (v18+)** and **Python (3.9+)** installed.
* Get your Groq API Key (required to access `meta-llama/llama-4-scout-17b-16e-instruct`).

### 1. One-Time Setup (Install Dependencies)
Run the following script at the root directory to install both frontend and backend dependencies:
```bash
# Installs root, frontend packages, and python packages
npm run install-all
```

### 2. Running Locally (Concurrent Launch)
Start both the FastAPI backend (port `8000`) and the Vite React frontend (port `5173`) with a single command from the root folder:
```bash
npm run dev
```

Open your browser to [http://localhost:5173](http://localhost:5173) to explore the Agenta landing page. Click **Get Started** or **Begin Now** to launch the Multimodal RAG workspace.

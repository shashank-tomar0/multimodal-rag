# Multimodal RAG Engine 📚

A Retrieval-Augmented Generation application that parses complex PDFs (including images and charts) and answers questions using Vector Search and a Vision-Language Model.

## Features
- **Visual Question Answering**: Uses the `llama-3.2-11b-vision-preview` model via Groq to analyze embedded document images.
- **Vector Search**: Indexes text extracted via PyMuPDF into a local FAISS vector database.
- **Streamlit UI**: Clean, interactive chat interface where users can upload documents and chat with them.

## How to Run
```bash
pip install -r requirements.txt
streamlit run app.py
```

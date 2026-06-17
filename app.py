import streamlit as st
import os
from dotenv import load_dotenv
from ingestion.pdf_parser import parse_complex_pdf
from indexer.multimodal_embedder import MultimodalEmbedder
from retrieval.query_engine import MultimodalQueryEngine

load_dotenv()

# Initialize session state
if 'embedder' not in st.session_state:
    st.session_state.embedder = MultimodalEmbedder()
if 'parsed_data' not in st.session_state:
    st.session_state.parsed_data = None
if 'chat_history' not in st.session_state:
    st.session_state.chat_history = []

def main():
    st.set_page_config(page_title="Multimodal RAG with Groq", layout="wide")
    st.title("Multimodal RAG (Vision + Text) with Groq")
    
    api_key = st.sidebar.text_input("Groq API Key", value=os.getenv("GROQ_API_KEY", ""), type="password")
    
    st.sidebar.markdown("---")
    uploaded_file = st.sidebar.file_uploader("Upload PDF", type=['pdf'])
    
    if uploaded_file and st.session_state.parsed_data is None:
        with st.spinner("Processing document (extracting text & images)..."):
            # Save uploaded file temporarily
            temp_pdf_path = "temp.pdf"
            with open(temp_pdf_path, "wb") as f:
                f.write(uploaded_file.getbuffer())
                
            # Parse PDF
            parsed_data = parse_complex_pdf(temp_pdf_path)
            st.session_state.parsed_data = parsed_data
            
            # Build Vector Index
            st.session_state.embedder.build_index(parsed_data["text_chunks"])
            st.success(f"Extracted {len(parsed_data['text_chunks'])} text chunks and {len(parsed_data['images'])} images.")

    # Render Chat
    for msg in st.session_state.chat_history:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])
            if "images" in msg and msg["images"]:
                cols = st.columns(len(msg["images"]))
                for idx, img_path in enumerate(msg["images"]):
                    cols[idx].image(img_path, caption=f"Referenced Image", use_container_width=True)

    query = st.chat_input("Ask a question about the document...")
    if query:
        if not api_key:
            st.error("Please enter a Groq API Key in the sidebar.")
            return
            
        if not st.session_state.parsed_data:
            st.warning("Please upload a PDF first.")
            return

        # Add user query to chat
        st.session_state.chat_history.append({"role": "user", "content": query})
        with st.chat_message("user"):
            st.markdown(query)

        # Retrieval
        with st.spinner("Retrieving context & generating answer..."):
            retrieved_texts = st.session_state.embedder.search(query, top_k=3)
            
            # Find images on the same pages as the retrieved text
            retrieved_pages = set([t["page"] for t in retrieved_texts])
            relevant_images = [img for img in st.session_state.parsed_data["images"] if img["page"] in retrieved_pages]
            
            # Limit to top 2 images to save context window and api limits
            relevant_images = relevant_images[:2]

            engine = MultimodalQueryEngine(api_key=api_key)
            answer = engine.query(query, retrieved_texts, relevant_images)
            
            # Store AI response
            st.session_state.chat_history.append({
                "role": "assistant", 
                "content": answer,
                "images": [img["path"] for img in relevant_images]
            })
            
            # Force re-render
            st.rerun()

if __name__ == "__main__":
    main()

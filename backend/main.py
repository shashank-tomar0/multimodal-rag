import os
# Force offline mode for Hugging Face to avoid network hangs in restricted environments
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import shutil
import json
import uvicorn
from typing import Optional, List
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv, find_dotenv

from ingestion.pdf_parser import parse_complex_pdf, get_pdf_hash
from indexer.multimodal_embedder import MultimodalEmbedder
from retrieval.query_engine import MultimodalQueryEngine

# Load environment variables (reads from .env if present in root or backend/)
load_dotenv(find_dotenv())
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

app = FastAPI(title="Lumen RAG Backend")

# Enable CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
CACHE_DIR = os.path.join(DATA_DIR, "cache")
IMAGES_DIR = os.path.join(DATA_DIR, "images")
TEMP_DIR = os.path.join(DATA_DIR, "temp")

os.makedirs(CACHE_DIR, exist_ok=True)
os.makedirs(IMAGES_DIR, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)

# Mount images directory to serve files to frontend
app.mount("/images", StaticFiles(directory=IMAGES_DIR), name="images")

# Load or maintain registry
REGISTRY_PATH = os.path.join(CACHE_DIR, "registry.json")

def load_registry():
    if os.path.exists(REGISTRY_PATH):
        try:
            with open(REGISTRY_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_registry(registry):
    with open(REGISTRY_PATH, "w", encoding="utf-8") as f:
        json.dump(registry, f, ensure_ascii=False, indent=2)

class QueryRequest(BaseModel):
    question: str
    pdf_hash: str
    top_k: Optional[int] = 4

@app.post("/api/upload")
async def upload_pdf(
    file: UploadFile = File(...),
    enable_captioning: bool = Form(True),
    chunk_size: int = Form(800),
    chunk_overlap: int = Form(200)
):
    # Save uploaded file to temp
    temp_path = os.path.join(TEMP_DIR, file.filename)
    with open(temp_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
        
    try:
        # Calculate hash
        pdf_hash = get_pdf_hash(temp_path)
        
        # Initialize Embedder
        embedder = MultimodalEmbedder()
        registry = load_registry()
        
        # Check cache
        if pdf_hash in registry and embedder.load_index(CACHE_DIR, pdf_hash):
            print(f"Cache hit for PDF hash: {pdf_hash}")
            if os.path.exists(temp_path):
                os.remove(temp_path)
            return {
                "pdf_hash": pdf_hash,
                "filename": registry[pdf_hash]["filename"],
                "text_chunks_count": registry[pdf_hash]["text_chunks_count"],
                "images_count": registry[pdf_hash]["images_count"],
                "image_chunks": registry[pdf_hash].get("image_chunks", []),
                "cached": True
            }
            
        # Parse PDF
        parsed_data = parse_complex_pdf(
            temp_path, 
            output_base_dir=IMAGES_DIR, 
            chunk_size=chunk_size, 
            chunk_overlap=chunk_overlap
        )
        
        text_chunks = parsed_data["text_chunks"]
        extracted_images = parsed_data["images"]
        image_chunks = []
        
        # Handle Image Captioning Concurrently
        if extracted_images and enable_captioning:
            if not GROQ_API_KEY:
                print("Warning: GROQ_API_KEY environment variable not configured. Skipping image captioning.")
                for img in extracted_images:
                    image_chunks.append({
                        "page": img["page"],
                        "path": img["path"],
                        "caption": f"Image extracted from page {img['page']}."
                    })
            else:
                query_engine = MultimodalQueryEngine(api_key=GROQ_API_KEY)
                
                # Define worker for parallel captioning
                def caption_worker(img):
                    try:
                        caption = query_engine.generate_image_caption(img["path"])
                        return {
                            "page": img["page"],
                            "path": img["path"],
                            "caption": caption
                        }
                    except Exception as e:
                        print(f"Error captioning image {img['path']}: {e}")
                        return {
                            "page": img["page"],
                            "path": img["path"],
                            "caption": f"Image on page {img['page']}."
                        }
                
                # Execute in parallel
                with ThreadPoolExecutor(max_workers=4) as executor:
                    image_chunks = list(executor.map(caption_worker, extracted_images))
        else:
            for img in extracted_images:
                image_chunks.append({
                    "page": img["page"],
                    "path": img["path"],
                    "caption": f"Image extracted from page {img['page']}."
                })
                
        # Build FAISS vector index
        embedder.build_index(text_chunks, image_chunks)
        embedder.save_index(CACHE_DIR, pdf_hash)
        
        # Format registry image chunks relative to static folder if needed
        # We store the image name so frontend can load it easily
        for chunk in image_chunks:
            chunk["name"] = os.path.basename(chunk["path"])
        
        # Update registry
        registry[pdf_hash] = {
            "filename": file.filename,
            "text_chunks_count": len(text_chunks),
            "images_count": len(extracted_images),
            "image_chunks": image_chunks
        }
        save_registry(registry)
        
        if os.path.exists(temp_path):
            os.remove(temp_path)
            
        return {
            "pdf_hash": pdf_hash,
            "filename": file.filename,
            "text_chunks_count": len(text_chunks),
            "images_count": len(extracted_images),
            "image_chunks": image_chunks,
            "cached": False
        }
        
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        print(f"Error during upload: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/query")
async def query_rag(request: QueryRequest):
    embedder = MultimodalEmbedder()
    registry = load_registry()
    
    if request.pdf_hash not in registry:
        raise HTTPException(status_code=404, detail="Document index not found.")
        
    # Load index
    if not embedder.load_index(CACHE_DIR, request.pdf_hash):
        raise HTTPException(status_code=500, detail="Failed to load document index.")
        
    # Search
    search_results = embedder.search(request.question, top_k=request.top_k)
    
    retrieved_texts = []
    retrieved_images = []
    
    for res in search_results:
        if res["type"] == "text":
            retrieved_texts.append({
                "page": res["page"],
                "content": res["content"],
                "score": res["score"]
            })
        elif res["type"] == "image":
            retrieved_images.append({
                "page": res["page"],
                "path": res["path"],
                "caption": res["content"],
                "score": res["score"]
            })
            
    # Page-match fallback for images
    if len(retrieved_images) < 2 and retrieved_texts:
        top_pages = [t["page"] for t in retrieved_texts[:2]]
        image_chunks = registry[request.pdf_hash].get("image_chunks", [])
        
        for img in image_chunks:
            if img["page"] in top_pages:
                if not any(r_img["path"] == img["path"] for r_img in retrieved_images):
                    retrieved_images.append({
                        "page": img["page"],
                        "path": img["path"],
                        "caption": img.get("caption", ""),
                        "score": 9.99
                    })
                    
    retrieved_images = retrieved_images[:3]
    
    # Query VLM using server's API key
    if not GROQ_API_KEY:
        raise HTTPException(
            status_code=500, 
            detail="GROQ_API_KEY environment variable is not configured on the server."
        )
        
    query_engine = MultimodalQueryEngine(api_key=GROQ_API_KEY)
    answer = query_engine.query(request.question, retrieved_texts, retrieved_images)
    
    # Format paths
    formatted_images = []
    for img in retrieved_images:
        rel_path = os.path.relpath(img["path"], IMAGES_DIR)
        rel_path = rel_path.replace(os.path.sep, "/")
        formatted_images.append({
            "page": img["page"],
            "url": f"/images/{rel_path}",
            "caption": img["caption"]
        })
        
    return {
        "answer": answer,
        "retrieved_texts": retrieved_texts,
        "retrieved_images": formatted_images
    }

@app.get("/api/documents")
async def get_documents():
    registry = load_registry()
    docs = []
    for pdf_hash, info in registry.items():
        docs.append({
            "pdf_hash": pdf_hash,
            "filename": info["filename"],
            "text_chunks_count": info["text_chunks_count"],
            "images_count": info["images_count"],
            "image_chunks": info.get("image_chunks", [])
        })
    return docs

@app.delete("/api/cache")
async def clear_cache():
    try:
        if os.path.exists(CACHE_DIR):
            shutil.rmtree(CACHE_DIR)
            os.makedirs(CACHE_DIR, exist_ok=True)
        if os.path.exists(IMAGES_DIR):
            shutil.rmtree(IMAGES_DIR)
            os.makedirs(IMAGES_DIR, exist_ok=True)
        save_registry({})
        return {"status": "success", "message": "Cache cleared."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

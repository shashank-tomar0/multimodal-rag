from sentence_transformers import SentenceTransformer
import faiss
import numpy as np
import os
import json

class MultimodalEmbedder:
    def __init__(self):
        print("Initializing SentenceTransformer model for text and image-caption embeddings...")
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        self.dimension = self.model.get_sentence_embedding_dimension()
        self.index = faiss.IndexFlatL2(self.dimension)
        self.metadata = []

    def build_index(self, text_chunks, image_chunks):
        # text_chunks: list of {"page": int, "chunk_id": str, "content": str}
        # image_chunks: list of {"page": int, "path": str, "caption": str}
        
        all_chunks = []
        texts_to_embed = []
        
        # Process text chunks
        for chunk in text_chunks:
            meta = {
                "type": "text",
                "page": chunk["page"],
                "chunk_id": chunk["chunk_id"],
                "content": chunk["content"]
            }
            all_chunks.append(meta)
            texts_to_embed.append(chunk["content"])
            
        # Process image chunks (using their captions for text search)
        for img in image_chunks:
            if img.get("caption"):
                meta = {
                    "type": "image",
                    "page": img["page"],
                    "path": img["path"],
                    "content": img["caption"]
                }
                all_chunks.append(meta)
                texts_to_embed.append(img["caption"])
                
        if not texts_to_embed:
            return
            
        # Re-initialize index to clear old data
        self.index = faiss.IndexFlatL2(self.dimension)
        embeddings = self.model.encode(texts_to_embed)
        
        self.index.add(np.array(embeddings).astype('float32'))
        self.metadata = all_chunks
        print(f"Built FAISS vector index with {len(all_chunks)} total chunks.")

    def search(self, query: str, top_k: int = 4):
        if self.index.ntotal == 0:
            return []
            
        query_embedding = self.model.encode([query])
        distances, indices = self.index.search(np.array(query_embedding).astype('float32'), top_k)
        
        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx != -1 and idx < len(self.metadata):
                item = self.metadata[idx].copy()
                item["score"] = float(dist)
                results.append(item)
        return results

    def save_index(self, cache_dir: str, pdf_hash: str):
        os.makedirs(cache_dir, exist_ok=True)
        index_path = os.path.join(cache_dir, f"{pdf_hash}.index")
        meta_path = os.path.join(cache_dir, f"{pdf_hash}.json")
        
        # Write FAISS index
        faiss.write_index(self.index, index_path)
        
        # Write Metadata
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(self.metadata, f, ensure_ascii=False, indent=2)
            
        print(f"Index and metadata saved for hash: {pdf_hash}")

    def load_index(self, cache_dir: str, pdf_hash: str) -> bool:
        index_path = os.path.join(cache_dir, f"{pdf_hash}.index")
        meta_path = os.path.join(cache_dir, f"{pdf_hash}.json")
        
        if os.path.exists(index_path) and os.path.exists(meta_path):
            try:
                self.index = faiss.read_index(index_path)
                with open(meta_path, "r", encoding="utf-8") as f:
                    self.metadata = json.load(f)
                print(f"Index and metadata loaded from cache for hash: {pdf_hash}")
                return True
            except Exception as e:
                print(f"Error loading index from cache: {e}")
                return False
        return False

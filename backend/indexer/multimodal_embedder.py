import faiss
import numpy as np
import os
import json
from sklearn.feature_extraction.text import TfidfVectorizer

class MultimodalEmbedder:
    def __init__(self):
        self.use_fallback = False
        self.model = None
        self.vectorizer = None
        self.dimension = 0
        self.index = None
        self.metadata = []

        # Read environment variable to force TF-IDF and save memory on free tier (defaults to false locally)
        force_tfidf = os.getenv("USE_TFIDF_ONLY", "false").lower() == "true"

        print("Initializing Embedder model...")
        if force_tfidf:
            print("USE_TFIDF_ONLY=true. Skipping SentenceTransformer loading to conserve memory.")
            self.use_fallback = True
            self.vectorizer = TfidfVectorizer(stop_words='english')
        else:
            try:
                # Attempt to load local SentenceTransformer model dynamically
                from sentence_transformers import SentenceTransformer
                self.model = SentenceTransformer('all-MiniLM-L6-v2')
                self.dimension = self.model.get_sentence_embedding_dimension()
                self.index = faiss.IndexFlatL2(self.dimension)
                print("Successfully loaded SentenceTransformer model ('all-MiniLM-L6-v2').")
            except Exception as e:
                print(f"HuggingFace loading failed: {e}")
                print("HuggingFace model not found or offline. Falling back to local TF-IDF Vectorizer.")
                self.use_fallback = True
                self.vectorizer = TfidfVectorizer(stop_words='english')
            # The dimension and index will be initialized dynamically in build_index based on vocabulary size

    def build_index(self, text_chunks, image_chunks):
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

        self.metadata = all_chunks

        if not self.use_fallback:
            try:
                embeddings = self.model.encode(texts_to_embed)
                self.index = faiss.IndexFlatL2(self.dimension)
                self.index.add(np.array(embeddings).astype('float32'))
                print(f"Built FAISS vector index with {len(all_chunks)} total chunks using SentenceTransformers.")
            except Exception as e:
                print(f"Encoding failed, falling back to TF-IDF: {e}")
                self.use_fallback = True
                self.vectorizer = TfidfVectorizer(stop_words='english')

        if self.use_fallback:
            # Fit and transform using TF-IDF
            embeddings = self.vectorizer.fit_transform(texts_to_embed).toarray()
            self.dimension = embeddings.shape[1]
            self.index = faiss.IndexFlatL2(self.dimension)
            self.index.add(np.array(embeddings).astype('float32'))
            print(f"Built FAISS vector index with {len(all_chunks)} total chunks using local TF-IDF fallback (dim: {self.dimension}).")

    def search(self, query: str, top_k: int = 4):
        if self.index is None or self.index.ntotal == 0:
            return []
            
        if not self.use_fallback:
            try:
                query_embedding = self.model.encode([query])
                distances, indices = self.index.search(np.array(query_embedding).astype('float32'), top_k)
            except Exception as e:
                print(f"Search failed with SentenceTransformers, switching to TF-IDF fallback: {e}")
                return []
        else:
            try:
                query_embedding = self.vectorizer.transform([query]).toarray()
                distances, indices = self.index.search(np.array(query_embedding).astype('float32'), top_k)
            except Exception as e:
                print(f"TF-IDF search failed: {e}")
                return []
        
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
        extra_path = os.path.join(cache_dir, f"{pdf_hash}_extra.json")
        
        # Save FAISS index
        faiss.write_index(self.index, index_path)
        
        # Save metadata
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(self.metadata, f, ensure_ascii=False, indent=2)

        # Save fallback details
        extra_data = {
            "use_fallback": self.use_fallback,
            "dimension": self.dimension
        }
        if self.use_fallback and self.vectorizer:
            # Save vectorizer vocabulary
            extra_data["vocabulary"] = self.vectorizer.vocabulary_
            extra_data["idf"] = self.vectorizer.idf_.tolist()
            
        with open(extra_path, "w", encoding="utf-8") as f:
            json.dump(extra_data, f, ensure_ascii=False, indent=2)
            
        print(f"Index and metadata saved for hash: {pdf_hash}")

    def load_index(self, cache_dir: str, pdf_hash: str) -> bool:
        index_path = os.path.join(cache_dir, f"{pdf_hash}.index")
        meta_path = os.path.join(cache_dir, f"{pdf_hash}.json")
        extra_path = os.path.join(cache_dir, f"{pdf_hash}_extra.json")
        
        if os.path.exists(index_path) and os.path.exists(meta_path):
            try:
                self.index = faiss.read_index(index_path)
                with open(meta_path, "r", encoding="utf-8") as f:
                    self.metadata = json.load(f)
                
                # Load fallback details if present
                if os.path.exists(extra_path):
                    with open(extra_path, "r", encoding="utf-8") as f:
                        extra_data = json.load(f)
                    self.use_fallback = extra_data.get("use_fallback", False)
                    self.dimension = extra_data.get("dimension", 0)
                    if self.use_fallback and "vocabulary" in extra_data:
                        self.vectorizer = TfidfVectorizer(stop_words='english')
                        self.vectorizer.vocabulary_ = extra_data["vocabulary"]
                        self.vectorizer.idf_ = np.array(extra_data["idf"])
                
                print(f"Index and metadata loaded from cache for hash: {pdf_hash}")
                return True
            except Exception as e:
                print(f"Error loading index from cache: {e}")
                return False
        return False

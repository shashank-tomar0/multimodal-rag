from sentence_transformers import SentenceTransformer
import faiss
import numpy as np

class MultimodalEmbedder:
    def __init__(self):
        print("Initializing SentenceTransformer model for text embeddings...")
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        self.dimension = self.model.get_sentence_embedding_dimension()
        self.index = faiss.IndexFlatL2(self.dimension)
        self.metadata = []

    def build_index(self, text_chunks):
        if not text_chunks:
            return
            
        texts = [chunk["content"] for chunk in text_chunks]
        embeddings = self.model.encode(texts)
        
        # Add to FAISS index
        self.index.add(np.array(embeddings).astype('float32'))
        self.metadata = text_chunks
        print(f"Built FAISS vector index with {len(text_chunks)} chunks.")

    def search(self, query: str, top_k: int = 3):
        if self.index.ntotal == 0:
            return []
            
        query_embedding = self.model.encode([query])
        distances, indices = self.index.search(np.array(query_embedding).astype('float32'), top_k)
        
        results = []
        for i in indices[0]:
            if i != -1 and i < len(self.metadata):
                results.append(self.metadata[i])
        return results

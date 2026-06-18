import fitz  # PyMuPDF
import os
import hashlib

def get_pdf_hash(filepath: str) -> str:
    hash_sha256 = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_sha256.update(chunk)
    return hash_sha256.hexdigest()

def split_text(text: str, chunk_size: int = 800, chunk_overlap: int = 200):
    if not text:
        return []
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunk = text[start:end]
        chunks.append(chunk.strip())
        if end == len(text):
            break
        start += (chunk_size - chunk_overlap)
    return chunks

def parse_complex_pdf(filepath: str, output_base_dir: str = "data/images", chunk_size: int = 800, chunk_overlap: int = 200):
    print(f"Parsing PDF: {filepath}")
    pdf_hash = get_pdf_hash(filepath)
    output_image_dir = os.path.join(output_base_dir, pdf_hash)
    os.makedirs(output_image_dir, exist_ok=True)
    
    doc = fitz.open(filepath)
    text_chunks = []
    images = []
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        
        # 1. Extract and Chunk Text
        text = page.get_text("text").strip()
        if text:
            page_chunks = split_text(text, chunk_size, chunk_overlap)
            for idx, content in enumerate(page_chunks):
                text_chunks.append({
                    "page": page_num + 1,
                    "chunk_id": f"page_{page_num+1}_chunk_{idx}",
                    "content": content
                })
            
        # 2. Extract Images
        for img_index, img in enumerate(page.get_images(full=True)):
            xref = img[0]
            try:
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                image_ext = base_image["ext"]
                
                image_path = os.path.join(output_image_dir, f"page_{page_num+1}_img_{img_index}.{image_ext}")
                
                with open(image_path, "wb") as f:
                    f.write(image_bytes)
                    
                images.append({
                    "page": page_num + 1,
                    "path": image_path,
                    "name": f"page_{page_num+1}_img_{img_index}.{image_ext}"
                })
            except Exception as e:
                print(f"Error extracting image index {img_index} on page {page_num+1}: {e}")
            
    return {
        "pdf_hash": pdf_hash,
        "text_chunks": text_chunks,
        "images": images
    }

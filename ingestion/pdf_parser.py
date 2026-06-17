import fitz  # PyMuPDF
import os

def parse_complex_pdf(filepath: str, output_image_dir: str = "temp_images"):
    print(f"Parsing PDF: {filepath}")
    os.makedirs(output_image_dir, exist_ok=True)
    
    doc = fitz.open(filepath)
    text_chunks = []
    images = []
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        
        # 1. Extract Text
        text = page.get_text("text").strip()
        if text:
            text_chunks.append({
                "page": page_num + 1,
                "content": text
            })
            
        # 2. Extract Images
        for img_index, img in enumerate(page.get_images(full=True)):
            xref = img[0]
            base_image = doc.extract_image(xref)
            image_bytes = base_image["image"]
            image_ext = base_image["ext"]
            
            image_path = os.path.join(output_image_dir, f"page_{page_num+1}_img_{img_index}.{image_ext}")
            
            with open(image_path, "wb") as f:
                f.write(image_bytes)
                
            images.append({
                "page": page_num + 1,
                "path": image_path
            })
            
    return {
        "text_chunks": text_chunks,
        "images": images
    }

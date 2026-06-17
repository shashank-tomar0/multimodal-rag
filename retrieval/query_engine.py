import os
import base64
from groq import Groq

def encode_image(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

class MultimodalQueryEngine:
    def __init__(self, api_key: str):
        self.client = Groq(api_key=api_key)
        # Groq's multimodal Llama 3.2 Vision model
        self.model_name = "llama-3.2-11b-vision-preview" 

    def query(self, question: str, retrieved_texts: list, retrieved_images: list):
        print(f"Querying Groq VLM for: {question}")
        
        context_str = "\n\n".join([f"Page {t['page']}: {t['content']}" for t in retrieved_texts])
        
        prompt = (
            "You are a helpful expert assistant analyzing a document.\n"
            f"Here is the extracted text context:\n{context_str}\n\n"
            f"Question: {question}"
        )
        
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt}
                ]
            }
        ]
        
        # Attach images context
        for img in retrieved_images:
            try:
                base64_image = encode_image(img["path"])
                messages[0]["content"].append({
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{base64_image}",
                    }
                })
            except Exception as e:
                print(f"Error encoding image {img['path']}: {e}")

        try:
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=messages,
                temperature=0.1,
                max_tokens=1024,
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"Error calling Groq API: {e}\n(Ensure your API Key is valid and has access to {self.model_name})"

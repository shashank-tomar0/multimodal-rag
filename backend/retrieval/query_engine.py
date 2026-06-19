import os
import base64
from groq import Groq

def encode_image(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

class MultimodalQueryEngine:
    def __init__(self, api_key: str):
        self.client = Groq(api_key=api_key)
        self.model_name = "meta-llama/llama-4-scout-17b-16e-instruct" 

    def generate_image_caption(self, image_path: str) -> str:
        """Generates a detailed summary of an image using Groq VLM."""
        print(f"Generating caption for image: {image_path}")
        try:
            base64_image = encode_image(image_path)
            messages = [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text", 
                            "text": (
                                "Describe this image extracted from a document page in detail. "
                                "Identify any charts, tables, diagrams, or key text present in the image. "
                                "Explain what information it represents so it can be searched semantically later. "
                                "Keep the summary concise but highly informative."
                            )
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}",
                            }
                        }
                    ]
                }
            ]
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=messages,
                temperature=0.2,
                max_tokens=512,
                timeout=25.0,
            )
            caption = response.choices[0].message.content.strip()
            print(f"Generated caption length: {len(caption)}")
            return caption
        except Exception as e:
            print(f"Error generating caption for {image_path}: {e}")
            return f"Image extracted from page. Error generating description: {e}"

    def query(self, question: str, retrieved_texts: list, retrieved_images: list):
        print(f"Querying Groq VLM with question: {question}")
        
        context_str = "\n\n".join([f"Page {t['page']}: {t['content']}" for t in retrieved_texts])
        
        prompt = (
            "You are Agenta, a helpful, expert RAG assistant analyzing a document.\n"
            "Answer the user's question accurately using the provided text context and any attached images.\n"
            "If an image contains critical data (like a chart or table) relevant to the query, rely heavily on it.\n\n"
            f"Here is the retrieved text context:\n{context_str}\n\n"
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
                temperature=0.2,
                max_tokens=1024,
                timeout=30.0,
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"Error calling Groq API: {e}\n(Ensure your API Key is valid and has access to {self.model_name})"

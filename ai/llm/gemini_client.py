# ai/llm/gemini_client.py

"""
Core module to initialize and configure the Gemini LLM for use in the application.
"""

import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI


# Load environment variables from .env file
load_dotenv()

# Configure the Gemini LLM
DEFAULT_MODEL = "gemini-3-flash-preview"
DEFAULT_TEMPERATURE = 0.1
DEFAULT_MAX_TOKENS = 4096


def get_gemini_llm(
        model: str = DEFAULT_MODEL, 
        temperature: float = DEFAULT_TEMPERATURE, 
        max_tokens: int = DEFAULT_MAX_TOKENS, 
        json_mode: bool = False
        ) -> ChatGoogleGenerativeAI:
    """
    Factory function to create a Gemini LLM instance with specific behaviors.
    
    Args:
        model (str): The specific model version (e.g., 'gemini-3-flash-preview').
        temperature (float): 0.0 = Precise/Deterministic, 1.0 = Creative/Random.
        max_tokens (int): Safety limit on output length (cost control).
    """
    if not model or not model.strip():
        raise ValueError("model name must be a non-empty string.")

    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_API_KEY environment variable is not set.")
    
    # Configuration arguments
    kwargs = {
        "model": model,
        "temperature": temperature,
        "max_output_tokens": max_tokens,
        "google_api_key": api_key,
    }
    if json_mode:
        kwargs["response_mime_type"] = "application/json"

    return ChatGoogleGenerativeAI(**kwargs)

def test_gemini_llm():
    """
    Simple test function to verify Gemini LLM setup.
    """
    llm = get_gemini_llm(model="gemini-3-flash-preview", temperature=0.0, max_tokens=256)
    response = llm.invoke("Hello, how are you?")
    print("Gemini LLM Response:", response)

if __name__ == "__main__":
    test_gemini_llm()

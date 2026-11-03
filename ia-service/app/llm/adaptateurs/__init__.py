"""Adaptateurs concrets du client LLM.

- ``factice`` : client simulé, déterministe, utilisé par les tests et le développement hors ligne ;
- ``compatible_openai`` : fournisseur réel exposant ``/chat/completions`` (OpenAI, Mistral, Ollama, vLLM…).
"""

# llm_client.py
# LLM Clients in the SAME style as ShopifyClient:
#  - __init__(token_metadata, credentials, Integration_id)
#  - headers()
#  - get_new_token()
#  - fetch_page(endpoint, params)
#  - stream_batches(endpoint, batch_size)

import requests


class BaseLLMClient:
    """
    Base class to keep the same interface style as your ShopifyClient.

    For LLMs:
      - endpoint is not "products/orders", it's more like "chat" (or ignore it).
      - params can contain:
          { "prompt": "..." }   OR
          { "prompts": ["...", "..."] }
    """

    def __init__(self, token_metadata, credentials, Integration_id):
        self.token_metadata = token_metadata or {}
        self.credentials = credentials or {}
        self.Integration_id = Integration_id

    def headers(self):
        return {
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    def get_new_token(self):
        # API-key providers don't need refresh; keep for compatibility.
        pass

    def _normalize_prompts(self, endpoint: str, params: dict):
        params = params or {}

        prompts = params.get("prompts")
        if isinstance(prompts, list) and prompts:
            return [str(p) for p in prompts if p is not None and str(p).strip()]

        prompt = params.get("prompt")
        if prompt is not None and str(prompt).strip():
            return [str(prompt)]

        # Optional convenience: if someone passes prompt directly as endpoint
        if endpoint and endpoint not in ("chat", "models") and str(endpoint).strip():
            return [str(endpoint)]

        return ["ping"]

    def fetch_page(self, endpoint: str, params: dict):
        raise NotImplementedError

    def stream_batches(self, endpoint: str, batch_size: int = 1, params: dict = None):
        """
        Same semantics as ShopifyClient.stream_batches:
        yields a list (batch) each time.

        Each item in the batch is a dict:
          { "prompt": ..., "response": ..., "raw": ... }
        """
        batch = []
        prompts = self._normalize_prompts(endpoint, params or {})

        for p in prompts:
            record = self.fetch_page("chat", {"prompt": p})
            batch.append(record)

            if len(batch) >= batch_size:
                yield batch
                batch = []

        if batch:
            yield batch
        return


class OpenAIClient(BaseLLMClient):
    def __init__(self, token_metadata, credentials, Integration_id):
        super().__init__(token_metadata, credentials, Integration_id)
        self.api_key = self.credentials["api_key"]
        self.site_url = (self.credentials.get("site_url") or "https://api.openai.com").rstrip("/")
        self.model = self.credentials.get("default_model") or "gpt-4o-mini"

    def headers(self):
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    def fetch_page(self, endpoint: str, params: dict):
        prompt = (params or {}).get("prompt") or "ping"

        url = (
            f"{self.site_url}/v1/chat/completions"
            if not self.site_url.endswith("/v1")
            else f"{self.site_url}/chat/completions"
        )

        r = requests.post(
            url,
            headers=self.headers(),
            json={
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=60,
        )
        if r.status_code != 200:
            raise PermissionError(r.text)

        data = r.json()
        return {
            "prompt": prompt,
            "response": data["choices"][0]["message"]["content"],
            "raw": data,
        }


class DeepSeekClient(BaseLLMClient):
    def __init__(self, token_metadata, credentials, Integration_id):
        super().__init__(token_metadata, credentials, Integration_id)
        self.api_key = self.credentials["api_key"]
        self.site_url = (self.credentials.get("site_url") or "https://api.deepseek.com").rstrip("/")
        self.model = self.credentials.get("default_model") or "deepseek-chat"

    def headers(self):
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    def fetch_page(self, endpoint: str, params: dict):
        prompt = (params or {}).get("prompt") or "ping"

        url = (
            f"{self.site_url}/v1/chat/completions"
            if not self.site_url.endswith("/v1")
            else f"{self.site_url}/chat/completions"
        )

        r = requests.post(
            url,
            headers=self.headers(),
            json={
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=60,
        )
        if r.status_code != 200:
            raise PermissionError(r.text)

        data = r.json()
        return {
            "prompt": prompt,
            "response": data["choices"][0]["message"]["content"],
            "raw": data,
        }


class GeminiClient(BaseLLMClient):
    def __init__(self, token_metadata, credentials, Integration_id):
        super().__init__(token_metadata, credentials, Integration_id)
        self.api_key = self.credentials["api_key"]
        self.site_url = (self.credentials.get("site_url") or "https://generativelanguage.googleapis.com").rstrip("/")
        self.model = self.credentials.get("default_model") or "gemini-1.5-flash"

    def headers(self):
        return {
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    def fetch_page(self, endpoint: str, params: dict):
        prompt = (params or {}).get("prompt") or "ping"
        url = f"{self.site_url}/v1beta/models/{self.model}:generateContent?key={self.api_key}"

        r = requests.post(
            url,
            headers=self.headers(),
            json={"contents": [{"parts": [{"text": prompt}]}]},
            timeout=60,
        )
        if r.status_code != 200:
            raise PermissionError(r.text)

        data = r.json()
        text = ""
        try:
            text = data["candidates"][0]["content"]["parts"][0]["text"]
        except Exception:
            text = str(data)

        return {"prompt": prompt, "response": text, "raw": data}


class AnthropicClient(BaseLLMClient):
    def __init__(self, token_metadata, credentials, Integration_id):
        super().__init__(token_metadata, credentials, Integration_id)
        self.api_key = self.credentials["api_key"]
        self.site_url = (self.credentials.get("site_url") or "https://api.anthropic.com").rstrip("/")
        self.model = self.credentials.get("default_model") or "claude-3-haiku-20240307"
        self.anthropic_version = self.credentials.get("anthropic_version") or "2023-06-01"

    def headers(self):
        return {
            "x-api-key": self.api_key,
            "anthropic-version": self.anthropic_version,
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    def fetch_page(self, endpoint: str, params: dict):
        prompt = (params or {}).get("prompt") or "ping"
        url = f"{self.site_url}/v1/messages"

        r = requests.post(
            url,
            headers=self.headers(),
            json={
                "model": self.model,
                "max_tokens": 256,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=60,
        )
        if r.status_code != 200:
            raise PermissionError(r.text)

        data = r.json()
        text = ""
        try:
            text = "".join([b.get("text", "") for b in data.get("content", [])])
        except Exception:
            text = str(data)

        return {"prompt": prompt, "response": text, "raw": data}


class AzureOpenAIClient(BaseLLMClient):
    def __init__(self, token_metadata, credentials, Integration_id):
        super().__init__(token_metadata, credentials, Integration_id)
        self.api_key = self.credentials["api_key"]
        self.endpoint = self.credentials["endpoint"].rstrip("/")
        self.deployment = self.credentials["deployment"]
        self.api_version = self.credentials.get("api_version") or "2024-10-21"

    def headers(self):
        return {
            "api-key": self.api_key,
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    def fetch_page(self, endpoint: str, params: dict):
        prompt = (params or {}).get("prompt") or "ping"
        url = f"{self.endpoint}/openai/deployments/{self.deployment}/chat/completions?api-version={self.api_version}"

        r = requests.post(
            url,
            headers=self.headers(),
            json={
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 256,
            },
            timeout=60,
        )
        if r.status_code != 200:
            raise PermissionError(r.text)

        data = r.json()
        return {
            "prompt": prompt,
            "response": data["choices"][0]["message"]["content"],
            "raw": data,
        }


class MetaLlamaClient(BaseLLMClient):
    """
    OpenAI-compatible self-hosted LLaMA (vLLM/Ollama/TGI).

    Required:
      - base_url OR site_url (example: http://localhost:8000 OR http://localhost:8000/v1)
    Optional:
      - api_key
      - default_model
    """

    def __init__(self, token_metadata, credentials, Integration_id):
        super().__init__(token_metadata, credentials, Integration_id)

        self.site_url = (self.credentials.get("base_url") or self.credentials.get("site_url") or "").rstrip("/")
        if not self.site_url:
            raise ValueError("base_url (or site_url) is required for meta_llama")

        self.api_key = self.credentials.get("api_key")  # optional
        self.model = self.credentials.get("default_model") or "llama-3.1-8b-instruct"

    def headers(self):
        h = {
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        if self.api_key:
            h["Authorization"] = f"Bearer {self.api_key}"
        return h

    def fetch_page(self, endpoint: str, params: dict):
        prompt = (params or {}).get("prompt") or "ping"

        url = (
            f"{self.site_url}/v1/chat/completions"
            if not self.site_url.endswith("/v1")
            else f"{self.site_url}/chat/completions"
        )

        r = requests.post(
            url,
            headers=self.headers(),
            json={
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=60,
        )
        if r.status_code != 200:
            raise PermissionError(r.text)

        data = r.json()
        return {
            "prompt": prompt,
            "response": data["choices"][0]["message"]["content"],
            "raw": data,
        }


# Registry (so IntegrationExtractor can pick correct client class)
LLM_CLIENTS = {
    "openai": OpenAIClient,
    "deepseek": DeepSeekClient,
    "gemini": GeminiClient,
    "anthropic": AnthropicClient,
    "azure_openai": AzureOpenAIClient,
    "meta_llama": MetaLlamaClient,
}

"""Lightweight web search used to ground answers about current information."""
import html
import re
from urllib.parse import parse_qs, unquote, urlparse
from typing import Any, Dict, List

import httpx
from loguru import logger


_RESULT_RE = re.compile(
    r'<a[^>]+class="result__a"[^>]+href="(?P<url>[^"]+)"[^>]*>(?P<title>.*?)</a>'
    r'.*?<a[^>]+class="result__snippet"[^>]*>(?P<snippet>.*?)</a>',
    re.IGNORECASE | re.DOTALL,
)
_TAG_RE = re.compile(r"<[^>]+>")


def _clean(value: str) -> str:
    return html.unescape(_TAG_RE.sub(" ", value)).replace("\n", " ").strip()


def _direct_url(url: str) -> str:
    """Turn DuckDuckGo's tracking redirect into the source URL shown to the user."""
    if url.startswith("//"):
        url = "https:" + url
    parsed = urlparse(url)
    if "duckduckgo.com" in parsed.netloc:
        target = parse_qs(parsed.query).get("uddg", [None])[0]
        if target:
            return unquote(target)
    return url


async def search_web(query: str, max_results: int = 5) -> Dict[str, Any]:
    """Search DuckDuckGo's HTML endpoint and return compact, model-ready results."""
    query = query.strip()
    if not query:
        return {"success": False, "output": "No search query was provided.", "data": {"results": []}}

    try:
        async with httpx.AsyncClient(
            timeout=12.0,
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; NexusAI/1.0)"},
        ) as client:
            response = await client.get("https://html.duckduckgo.com/html/", params={"q": query})
            response.raise_for_status()
    except (httpx.HTTPError, httpx.TimeoutException) as exc:
        logger.warning(f"Web search failed for {query!r}: {exc}")
        return {"success": False, "output": f"Web search was unavailable: {exc}", "data": {"results": []}}

    results: List[Dict[str, str]] = []
    for match in _RESULT_RE.finditer(response.text):
        title, url, snippet = (_clean(match.group("title")), _direct_url(html.unescape(match.group("url"))), _clean(match.group("snippet")))
        if title and url:
            results.append({"title": title, "url": url, "snippet": snippet})
        if len(results) >= max_results:
            break

    if not results:
        return {"success": False, "output": "The web search returned no readable results.", "data": {"results": []}}

    formatted = "\n".join(
        f"{index}. {item['title']}\n   {item['snippet']}\n   Source: {item['url']}"
        for index, item in enumerate(results, 1)
    )
    return {"success": True, "output": formatted, "data": {"query": query, "results": results}}

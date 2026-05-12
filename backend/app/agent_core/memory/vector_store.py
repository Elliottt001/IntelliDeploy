from __future__ import annotations

from dataclasses import dataclass
import math
import re
from collections import Counter
from typing import Any, Iterable

from pydantic import BaseModel, Field


class ReadmeDocument(BaseModel):
    repo_id: str
    full_name: str
    description: str = ""
    readme_content: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)


@dataclass(frozen=True)
class ReadmeSearchResult:
    document: ReadmeDocument
    score: float


class BM25ReadmeStore:
    """Small BM25 store for crawled GitHub README text.

    This is intentionally dependency-free so the retrieval pipeline can run in
    local development. It can be replaced by Elasticsearch, Meilisearch, or
    pgvector/tsvector behind the same interface.
    """

    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self._documents: dict[str, ReadmeDocument] = {}
        self._term_frequencies: dict[str, Counter[str]] = {}
        self._document_frequencies: Counter[str] = Counter()
        self._document_lengths: dict[str, int] = {}
        self._avg_doc_length = 0.0

    def upsert_many(self, documents: Iterable[ReadmeDocument]) -> None:
        for document in documents:
            self.upsert(document)

    def upsert(self, document: ReadmeDocument) -> None:
        if document.repo_id in self._documents:
            old_terms = set(self._term_frequencies.get(document.repo_id, Counter()))
            for term in old_terms:
                self._document_frequencies[term] -= 1
                if self._document_frequencies[term] <= 0:
                    del self._document_frequencies[term]

        tokens = self._tokenize_document(document)
        term_frequency = Counter(tokens)
        for term in term_frequency:
            self._document_frequencies[term] += 1

        self._documents[document.repo_id] = document
        self._term_frequencies[document.repo_id] = term_frequency
        self._document_lengths[document.repo_id] = len(tokens)
        self._recompute_average_length()

    def search(self, keywords: Iterable[str], top_k: int = 10) -> list[ReadmeSearchResult]:
        query_terms = self._tokenize(" ".join(keywords))
        if not query_terms or not self._documents:
            return []

        scored: list[ReadmeSearchResult] = []
        for repo_id, document in self._documents.items():
            score = self._score_document(repo_id, query_terms)
            if score > 0:
                scored.append(ReadmeSearchResult(document=document, score=score))

        scored.sort(key=lambda item: item.score, reverse=True)
        return scored[:top_k]

    def all_documents(self) -> list[ReadmeDocument]:
        return list(self._documents.values())

    def _score_document(self, repo_id: str, query_terms: list[str]) -> float:
        frequencies = self._term_frequencies.get(repo_id, Counter())
        doc_length = self._document_lengths.get(repo_id, 0)
        if doc_length == 0:
            return 0.0

        total_docs = max(len(self._documents), 1)
        score = 0.0
        for term in query_terms:
            term_count = frequencies.get(term, 0)
            if term_count == 0:
                continue

            docs_with_term = self._document_frequencies.get(term, 0)
            idf = math.log(1 + (total_docs - docs_with_term + 0.5) / (docs_with_term + 0.5))
            numerator = term_count * (self.k1 + 1)
            denominator = term_count + self.k1 * (
                1 - self.b + self.b * doc_length / max(self._avg_doc_length, 1.0)
            )
            score += idf * numerator / denominator
        return score

    def _recompute_average_length(self) -> None:
        if not self._document_lengths:
            self._avg_doc_length = 0.0
            return
        self._avg_doc_length = sum(self._document_lengths.values()) / len(
            self._document_lengths
        )

    def _tokenize_document(self, document: ReadmeDocument) -> list[str]:
        text = f"{document.full_name} {document.description} {document.readme_content}"
        return self._tokenize(clean_readme_text(text))

    @staticmethod
    def _tokenize(text: str) -> list[str]:
        normalized = text.lower()
        tokens = re.findall(r"[a-z0-9][a-z0-9_.+-]*|[\u4e00-\u9fff]", normalized)
        return [token for token in tokens if token not in _STOP_WORDS and len(token) > 1]


def clean_readme_text(content: str) -> str:
    text = re.sub(r"```.*?```", " ", content, flags=re.DOTALL)
    text = re.sub(r"!\[[^\]]*\]\([^)]+\)", " ", text)
    text = re.sub(r"\[[^\]]+\]\([^)]+\)", " ", text)
    text = re.sub(r"https?://\S+", " ", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"[\*_`#>\-|]+", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


_STOP_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "for",
    "in",
    "is",
    "of",
    "on",
    "or",
    "the",
    "to",
    "with",
}

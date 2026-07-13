from __future__ import annotations

import html
import re
import unicodedata
from dataclasses import dataclass
from functools import lru_cache
from typing import Iterable


_TOKEN_EDGE = r"a-z0-9_"


def normalize_text(value: object, *, remove_diacritics: bool = False) -> str:
    text = html.unescape(str(value or ""))
    text = re.sub(r"<[^>]+>", " ", text)
    text = unicodedata.normalize("NFC", text).casefold()
    if remove_diacritics:
        decomposed = unicodedata.normalize("NFD", text)
        text = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")
        text = unicodedata.normalize("NFC", text).replace("đ", "d")
    # Punctuation is a separator. Keeping letters/digits makes matching deterministic
    # for Vietnamese phrases and codes such as TOEIC, MOS, B1 and THCB.
    text = re.sub(r"[^\w]+", " ", text, flags=re.UNICODE)
    return re.sub(r"\s+", " ", text).strip()


def remove_accents(value: object) -> str:
    return normalize_text(value, remove_diacritics=True)


@lru_cache(maxsize=2048)
def _term_pattern(normalized_term: str) -> re.Pattern[str]:
    return re.compile(
        rf"(?<![{_TOKEN_EDGE}]){re.escape(normalized_term)}(?![{_TOKEN_EDGE}])",
        flags=re.UNICODE,
    )


@lru_cache(maxsize=2048)
def _normalized_term(value: str, remove_diacritics: bool = False) -> str:
    return normalize_text(value, remove_diacritics=remove_diacritics)


@dataclass(frozen=True)
class KeywordMatch:
    keyword: str
    mode: str
    confidence_factor: float


def match_keyword(text: object, keyword: object) -> KeywordMatch | None:
    keyword_text = str(keyword or "")
    term = _normalized_term(keyword_text)
    if not term:
        return None
    normalized = normalize_text(text)
    if _term_pattern(term).search(normalized):
        return KeywordMatch(str(keyword), "exact_diacritic", 1.0)

    plain_term = _normalized_term(keyword_text, True)
    plain_text = normalize_text(text, remove_diacritics=True)
    if plain_term and _term_pattern(plain_term).search(plain_text):
        return KeywordMatch(str(keyword), "accent_insensitive", 0.92)
    return None


def find_keyword_matches(text: object, keywords: Iterable[object]) -> list[KeywordMatch]:
    # Prefer the most specific phrase while retaining all distinct matches for audit.
    ordered = sorted(
        (keyword for keyword in keywords if str(keyword or "").strip()),
        key=lambda value: len(_normalized_term(str(value))),
        reverse=True,
    )
    result: list[KeywordMatch] = []
    seen: set[str] = set()
    accepted_terms: list[str] = []
    for keyword in ordered:
        match = match_keyword(text, keyword)
        key = _normalized_term(str(keyword), True)
        # Keep only the most specific nested phrase. Example: a match for
        # "lịch thi TOEIC" suppresses "thi TOEIC" and "TOEIC" for the same text.
        if match and any(_term_pattern(key).search(accepted) for accepted in accepted_terms):
            continue
        if match and key not in seen:
            seen.add(key)
            accepted_terms.append(key)
            result.append(match)
    return result

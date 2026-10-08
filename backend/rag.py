"""Repository-scoped hybrid retrieval with a bounded, attributed context."""
import json
from collections import defaultdict

MAX_CONTEXT_CHARS = 18000


def retrieve_context(supabase, repo_id, query, embedding):
    vector = supabase.rpc('match_code_chunks', {'query_embedding': embedding,
        'match_threshold': 0.25, 'match_count': 10, 'repo_id': repo_id}).execute().data
    lexical = supabase.rpc('search_code_chunks', {'search_query': query,
        'match_count': 10, 'repo_id': repo_id}).execute().data
    scores, chunks = defaultdict(float), {}
    for results in (vector, lexical):
        for rank, chunk in enumerate(results or []):
            key = chunk.get('id') or (chunk['file_path'], chunk.get('chunk_index', 0))
            scores[key] += 1 / (60 + rank)
            chunks[key] = chunk
    parts, citations, sources, used = [], [], [], 0
    for key in sorted(scores, key=scores.get, reverse=True)[:8]:
        chunk = chunks[key]
        available = MAX_CONTEXT_CHARS - used
        if available <= 0:
            break
        text = (chunk.get('chunk_text') or '')[:min(3000, available)]
        path = chunk['file_path']
        start, end = chunk.get('line_start'), chunk.get('line_end')
        # Truncation must not cite lines excluded from context.
        if start is not None and len(text) < len(chunk.get('chunk_text') or ''):
            end = start + text.count('\n')
        label = f'{path}:{start}–{end}' if start is not None and end is not None else path
        sources.append({'file_path': path, 'line_start': start, 'line_end': end,
                        'chunk_id': str(chunk.get('id') or ''), 'language': chunk.get('language')})
        if label not in citations:
            citations.append(label)
        # JSON encoding prevents source text from breaking delimiter structure.
        parts.append(json.dumps({'source': label, 'untrusted_code': text}, ensure_ascii=False))
        used += len(text)
    return '\n'.join(parts), citations, sources

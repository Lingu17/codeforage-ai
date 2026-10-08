"""Validate model suggestions against added lines in an actual unified diff."""
import re


def added_lines(diff: str) -> dict[str, set[int]]:
    files: dict[str, set[int]] = {}
    path = None
    line = None
    for row in diff.splitlines():
        if row.startswith('+++ b/'):
            path = row[6:]
            if path.startswith('/') or '..' in path.split('/'):
                raise ValueError('Invalid diff path')
            files.setdefault(path, set())
            line = None
        elif row.startswith('@@'):
            match = re.match(r'@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@', row)
            line = int(match.group(1)) if match else None
        elif path is not None and line is not None:
            if row.startswith('+'):
                files[path].add(line)
                line += 1
            elif row.startswith(' '):
                line += 1
    return files


def validate_review(data: dict, diff: str) -> dict:
    files = added_lines(diff)
    if not isinstance(data, dict) or data.get('risk_level') not in {'Low', 'Medium', 'High'}:
        raise ValueError('Invalid review')
    if not isinstance(data.get('summary'), str) or not 1 <= len(data['summary']) <= 5000:
        raise ValueError('Invalid summary')
    recommendations = data.get('recommendations')
    if not isinstance(recommendations, list) or len(recommendations) > 50:
        raise ValueError('Invalid recommendations')
    for item in recommendations:
        if not isinstance(item, dict) or item.get('type') not in {'BUG', 'SECURITY', 'PERFORMANCE', 'MAINTAINABILITY', 'STYLE'}:
            raise ValueError('Invalid category')
        if type(item.get('line')) is not int or item['line'] not in files.get(item.get('file'), set()):
            raise ValueError('Suggestion is outside added lines')
        if not isinstance(item.get('description'), str) or not 1 <= len(item['description']) <= 5000:
            raise ValueError('Invalid description')
    return data
